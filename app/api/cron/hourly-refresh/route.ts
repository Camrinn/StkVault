/**
 * Technical Refresh — one symbol per call.
 * Called by cron-job.org once per symbol, staggered 15s apart.
 * Completes in ~3s per symbol — well within Vercel's 10s Hobby limit.
 *
 * Route: GET /api/cron/hourly-refresh?symbol=AAPL
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import { getActiveSymbols } from "@/lib/db/queries";
import * as polygon from "@/lib/market-data/polygon";
import { computeTotalScore } from "@/lib/scoring";
import { computeEntryZone } from "@/lib/entry-zones";
import { cache, CacheKeys } from "@/lib/cache";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbolParam = request.nextUrl.searchParams.get("symbol")?.toUpperCase();

  const db = createServiceClient();
  const allSymbols = await getActiveSymbols();

  // Determine which symbols to process
  const toProcess = symbolParam
    ? allSymbols.filter((s) => s.symbol === symbolParam)
    : allSymbols;

  if (toProcess.length === 0) {
    return NextResponse.json({ error: `Symbol not found: ${symbolParam}` }, { status: 404 });
  }

  const results: { symbol: string; status: string; error?: string }[] = [];

  for (const sym of toProcess) {
    try {
      const dailyBars = await polygon.getDailyBars(sym.symbol, 365);

      if (dailyBars.length < 2) {
        results.push({ symbol: sym.symbol, status: "skipped", error: "Insufficient bar data" });
        continue;
      }

      const latest = dailyBars[dailyBars.length - 1];
      const prev = dailyBars[dailyBars.length - 2];

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
        trend_score: 50,
        setup_score: 50,
        valuation_score: 50,
        earnings_score: 50,
        industry_score: 50,
        risk_score: 50,
        total_score: 50,
      };

      const [financials, earnings, benchmark] = await Promise.all([
        db.from("financial_metrics").select("*").eq("symbol", sym.symbol)
          .order("as_of_date", { ascending: false }).limit(1).single().then((r) => r.data),
        db.from("earnings_events").select("*").eq("symbol", sym.symbol)
          .order("report_date", { ascending: false }).limit(4).then((r) => r.data ?? []),
        db.from("industry_benchmarks").select("*").eq("industry", sym.industry)
          .order("as_of_date", { ascending: false }).limit(1).single().then((r) => r.data),
      ]);

      const scores = computeTotalScore(snapshotRecord as any, financials, earnings, [], benchmark);

      snapshotRecord.trend_score = scores.trend_score;
      snapshotRecord.earnings_score = scores.earnings_score;
      snapshotRecord.valuation_score = scores.valuation_score;
      snapshotRecord.industry_score = scores.industry_score;
      snapshotRecord.risk_score = scores.risk_score;
      snapshotRecord.setup_score = scores.quality_score;
      snapshotRecord.total_score = scores.total_score;

      const { error: snapError } = await db.from("symbol_snapshots").insert(snapshotRecord);
      if (snapError) throw snapError;

      const entryZone = computeEntryZone({
        symbol: sym.symbol,
        price,
        ma_20: ma20,
        ma_50: ma50,
        ma_200: ma200,
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

      await generateAlerts(db, sym.symbol, snapshotRecord, entryZone, scores);

      await cache.del(CacheKeys.stockSnapshot(sym.symbol));
      await cache.del(CacheKeys.stockDetail(sym.symbol));
      await cache.del(CacheKeys.entryZone(sym.symbol));

      results.push({ symbol: sym.symbol, status: "ok" });
    } catch (err: any) {
      console.error(`Error refreshing ${sym.symbol}:`, err);
      results.push({ symbol: sym.symbol, status: "error", error: err.message });
    }
  }

  await cache.del(CacheKeys.dashboard());
  return NextResponse.json({ ok: true, results });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeReturns(bars: polygon.PolygonBar[], currentPrice: number) {
  const getReturn = (daysAgo: number) => {
    const idx = bars.length - daysAgo;
    if (idx < 0 || !bars[idx]) return 0;
    return ((currentPrice - bars[idx].c) / bars[idx].c) * 100;
  };
  return { w1: getReturn(5), m1: getReturn(21), m3: getReturn(63), y1: getReturn(252) };
}

function computeRSI(bars: polygon.PolygonBar[], period = 14): number {
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
  return bars.slice(-period).reduce((s, b) => s + b.c, 0) / period;
}

function computeVolatility(bars: polygon.PolygonBar[]): number {
  if (bars.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < bars.length; i++) returns.push(Math.log(bars[i].c / bars[i - 1].c));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252) * 100;
}

function computeAvgVolume(bars: polygon.PolygonBar[]): number {
  if (bars.length === 0) return 0;
  return Math.round(bars.reduce((s, b) => s + b.v, 0) / bars.length);
}

async function generateAlerts(db: any, symbol: string, snap: any, entryZone: any, scores: any) {
  const alerts: any[] = [];

  if (scores.total_score >= 85) {
    alerts.push({
      symbol, alert_type: "score",
      title: `${symbol} reached Prime Setup (${scores.total_score})`,
      body: "Total score is 85+ across all dimensions.",
      severity: "watch",
    });
  }
  if (scores.total_score < 40 && scores.total_score > 0) {
    alerts.push({
      symbol, alert_type: "score",
      title: `${symbol} score dropped to Avoid zone (${scores.total_score})`,
      body: "Total score fell below 40. Review risk factors.",
      severity: "warning",
    });
  }
  if (entryZone.current_zone === "pullback") {
    alerts.push({
      symbol, alert_type: "entry_zone",
      title: `${symbol} pulled back to area of interest`,
      body: entryZone.summary, severity: "watch",
    });
  }
  if (entryZone.current_zone === "support_test") {
    alerts.push({
      symbol, alert_type: "entry_zone",
      title: `${symbol} testing support`,
      body: entryZone.summary, severity: "warning",
    });
  }
  if (snap.volume > snap.avg_volume * 2) {
    alerts.push({
      symbol, alert_type: "volume",
      title: `${symbol} unusual volume (${(snap.volume / snap.avg_volume).toFixed(1)}x average)`,
      body: `Volume of ${snap.volume.toLocaleString()} vs average ${snap.avg_volume.toLocaleString()}.`,
      severity: "info",
    });
  }
  if (Math.abs(snap.change_1d) > 5) {
    alerts.push({
      symbol, alert_type: "price_move",
      title: `${symbol} moved ${snap.change_1d > 0 ? "+" : ""}${snap.change_1d.toFixed(1)}% today`,
      body: `Price at $${snap.price.toFixed(2)}. Significant single-day move.`,
      severity: Math.abs(snap.change_1d) > 10 ? "critical" : "warning",
    });
  }

  if (alerts.length > 0) {
    await db.from("alerts").update({ is_active: false }).eq("symbol", symbol).eq("is_active", true);
    await db.from("alerts").insert(alerts);
  }
}
