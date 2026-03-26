/**
 * Hourly Refresh Cron Job
 *
 * Runs every hour via Vercel cron. Pulls fresh market data,
 * computes technicals, updates scores, and generates alerts.
 *
 * Route: GET /api/cron/hourly-refresh
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import { getActiveSymbols } from "@/lib/db/queries";
import * as polygon from "@/lib/market-data/polygon";
import * as fmp from "@/lib/market-data/fmp";
import { computeTotalScore } from "@/lib/scoring";
import { computeEntryZone } from "@/lib/entry-zones";
import { cache, CacheKeys } from "@/lib/cache";

export const maxDuration = 300; // Allow up to 5 min for rate-limited free tier

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron call
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const startedAt = new Date().toISOString();

  // Log job start
  const { data: job } = await db
    .from("refresh_jobs")
    .insert({ job_type: "hourly", started_at: startedAt, status: "running" })
    .select("id")
    .single();

  try {
    const symbols = await getActiveSymbols();
    const tickers = symbols.map((s) => s.symbol);

    if (tickers.length === 0) {
      await completeJob(db, job!.id, "completed", { message: "No active symbols" });
      return NextResponse.json({ ok: true, message: "No symbols to refresh" });
    }

    // ─── 1. Process each ticker using Polygon daily bars (free tier) ──────
    const results: { symbol: string; status: string; error?: string }[] = [];

    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      // Polygon free tier: 5 req/min — wait 13s between each call
      if (i > 0) await new Promise((r) => setTimeout(r, 13000));

      try {
        // Fetch 1 year of daily bars — all technicals computed from this
        const dailyBars = await polygon.getDailyBars(sym.symbol, 365);

        if (dailyBars.length < 2) {
          results.push({ symbol: sym.symbol, status: "skipped", error: "Insufficient bar data" });
          continue;
        }

        const latest = dailyBars[dailyBars.length - 1];
        const prev = dailyBars[dailyBars.length - 2];

        // Compute all technicals from bars
        const price = latest.c;
        const change1d = prev.c > 0 ? ((latest.c - prev.c) / prev.c) * 100 : 0;
        const rsi = computeRSI(dailyBars);
        const ma20 = computeSMA(dailyBars, 20) ?? price;
        const ma50 = computeSMA(dailyBars, 50) ?? price;
        const ma200 = computeSMA(dailyBars, 200) ?? price;
        const high52 = Math.max(...dailyBars.map((b) => b.h));
        const low52 = Math.min(...dailyBars.map((b) => b.l));
        const drawdown = ((price - high52) / high52) * 100;
        const returns = computeReturns(dailyBars, price);
        const volatility = computeVolatility(dailyBars.slice(-30));

        // Build snapshot record
        const snapshotRecord = {
          symbol: sym.symbol,
          snapshot_time: new Date().toISOString(),
          price,
          change_1d: change1d,
          change_1w: returns.w1,
          change_1m: returns.m1,
          change_3m: returns.m3,
          change_1y: returns.y1,
          volume: Math.round(latest.v),
          avg_volume: Math.round(computeAvgVolume(dailyBars.slice(-20))),
          market_cap: 0,
          fifty_two_week_high: high52,
          fifty_two_week_low: low52,
          rsi,
          ma_20: ma20,
          ma_50: ma50,
          ma_200: ma200,
          volatility_30d: volatility,
          drawdown_from_high: drawdown,
          // Scores will be computed next
          trend_score: 50,
          setup_score: 50,
          valuation_score: 50,
          earnings_score: 50,
          industry_score: 50,
          risk_score: 50,
          total_score: 50,
        };

        // ─── 3. Compute scores ──────────────────────────────────────────────
        // Fetch supporting data for scoring
        const [financials, earnings, benchmark] = await Promise.all([
          db.from("financial_metrics")
            .select("*").eq("symbol", sym.symbol)
            .order("as_of_date", { ascending: false }).limit(1).single()
            .then((r) => r.data),
          db.from("earnings_events")
            .select("*").eq("symbol", sym.symbol)
            .order("report_date", { ascending: false }).limit(4)
            .then((r) => r.data ?? []),
          db.from("industry_benchmarks")
            .select("*").eq("industry", sym.industry)
            .order("as_of_date", { ascending: false }).limit(1).single()
            .then((r) => r.data),
        ]);

        const scores = computeTotalScore(
          snapshotRecord as any,
          financials,
          earnings,
          [], // peers — computed in a separate pass
          benchmark
        );

        // Apply scores
        snapshotRecord.trend_score = scores.trend_score;
        snapshotRecord.earnings_score = scores.earnings_score;
        snapshotRecord.valuation_score = scores.valuation_score;
        snapshotRecord.industry_score = scores.industry_score;
        snapshotRecord.risk_score = scores.risk_score;
        snapshotRecord.setup_score = scores.quality_score;
        snapshotRecord.total_score = scores.total_score;

        // ─── 4. Insert snapshot ─────────────────────────────────────────────
        const { error: snapError } = await db.from("symbol_snapshots").insert(snapshotRecord);
        if (snapError) throw snapError;

        // ─── 5. Compute & store entry zone ──────────────────────────────────
        const entryZone = computeEntryZone({
          symbol: sym.symbol,
          price,
          ma_20: ma20 ?? price,
          ma_50: ma50 ?? price,
          ma_200: ma200 ?? price,
          fifty_two_week_high: high52,
          fifty_two_week_low: low52,
          rsi: rsi ?? 50,
          volatility_30d: volatility,
        });

        await db.from("entry_zones").insert({
          symbol: sym.symbol,
          as_of_time: new Date().toISOString(),
          ...entryZone,
        });

        // ─── 6. Generate alerts if needed ───────────────────────────────────
        await generateAlerts(db, sym.symbol, snapshotRecord, entryZone, scores);

        // ─── 7. Invalidate cache ────────────────────────────────────────────
        await cache.del(CacheKeys.stockSnapshot(sym.symbol));
        await cache.del(CacheKeys.stockDetail(sym.symbol));
        await cache.del(CacheKeys.entryZone(sym.symbol));

        results.push({ symbol: sym.symbol, status: "ok" });
      } catch (err: any) {
        console.error(`Error refreshing ${sym.symbol}:`, err);
        results.push({ symbol: sym.symbol, status: "error", error: err.message });
      }
    }

    // Invalidate dashboard cache
    await cache.del(CacheKeys.dashboard());

    await completeJob(db, job!.id, "completed", {
      processed: results.length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error("Hourly refresh failed:", err);
    await completeJob(db, job!.id, "failed", { error: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function completeJob(db: any, jobId: string, status: string, details: any) {
  await db
    .from("refresh_jobs")
    .update({ finished_at: new Date().toISOString(), status, details })
    .eq("id", jobId);
}

function computeReturns(bars: polygon.PolygonBar[], currentPrice: number) {
  const getReturn = (daysAgo: number) => {
    const idx = bars.length - daysAgo;
    if (idx < 0 || !bars[idx]) return 0;
    return ((currentPrice - bars[idx].c) / bars[idx].c) * 100;
  };
  return {
    w1: getReturn(5),
    m1: getReturn(21),
    m3: getReturn(63),
    y1: getReturn(252),
  };
}

function computeRSI(bars: polygon.PolygonBar[], period: number = 14): number {
  if (bars.length < period + 1) return 50;
  const closes = bars.slice(-(period + 1)).map((b) => b.c);
  let gains = 0, losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function computeSMA(bars: polygon.PolygonBar[], period: number): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  return slice.reduce((sum, b) => sum + b.c, 0) / period;
}

function computeVolatility(bars: polygon.PolygonBar[]): number {
  if (bars.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < bars.length; i++) {
    returns.push(Math.log(bars[i].c / bars[i - 1].c));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252) * 100; // Annualized, as percentage
}

function computeAvgVolume(bars: polygon.PolygonBar[]): number {
  if (bars.length === 0) return 0;
  return Math.round(bars.reduce((s, b) => s + b.v, 0) / bars.length);
}

async function generateAlerts(
  db: any,
  symbol: string,
  snap: any,
  entryZone: any,
  scores: any
) {
  const alerts: any[] = [];

  // Score threshold alerts
  if (scores.total_score >= 85) {
    alerts.push({
      symbol,
      alert_type: "score",
      title: `${symbol} reached Prime Setup (${scores.total_score})`,
      body: "Total score is 85+ across all dimensions.",
      severity: "watch",
    });
  }

  if (scores.total_score < 40 && scores.total_score > 0) {
    alerts.push({
      symbol,
      alert_type: "score",
      title: `${symbol} score dropped to Avoid zone (${scores.total_score})`,
      body: "Total score fell below 40. Review risk factors.",
      severity: "warning",
    });
  }

  // Entry zone alerts
  if (entryZone.current_zone === "pullback") {
    alerts.push({
      symbol,
      alert_type: "entry_zone",
      title: `${symbol} pulled back to area of interest`,
      body: entryZone.summary,
      severity: "watch",
    });
  }

  if (entryZone.current_zone === "support_test") {
    alerts.push({
      symbol,
      alert_type: "entry_zone",
      title: `${symbol} testing support`,
      body: entryZone.summary,
      severity: "warning",
    });
  }

  // Volume spike
  if (snap.volume > snap.avg_volume * 2) {
    alerts.push({
      symbol,
      alert_type: "volume",
      title: `${symbol} unusual volume (${(snap.volume / snap.avg_volume).toFixed(1)}x average)`,
      body: `Volume of ${snap.volume.toLocaleString()} vs average ${snap.avg_volume.toLocaleString()}.`,
      severity: "info",
    });
  }

  // Big daily move
  if (Math.abs(snap.change_1d) > 5) {
    alerts.push({
      symbol,
      alert_type: "price_move",
      title: `${symbol} moved ${snap.change_1d > 0 ? "+" : ""}${snap.change_1d.toFixed(1)}% today`,
      body: `Price at $${snap.price.toFixed(2)}. This is a significant single-day move.`,
      severity: Math.abs(snap.change_1d) > 10 ? "critical" : "warning",
    });
  }

  if (alerts.length > 0) {
    // Deactivate old alerts for this symbol before inserting new ones
    await db
      .from("alerts")
      .update({ is_active: false })
      .eq("symbol", symbol)
      .eq("is_active", true);

    await db.from("alerts").insert(alerts);
  }
}
