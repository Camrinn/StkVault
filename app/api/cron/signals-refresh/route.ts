/**
 * Signals Refresh — one symbol per call.
 * Runs daily after market close.
 *
 * For each symbol:
 *   1. Chart pattern detection (Polygon bars) — breakout, bull flag, cup & handle
 *   2. MA crossovers (snapshot history) — golden cross, death cross
 *   3. Relative strength vs S&P 500 (Polygon bars, SPY cached daily)
 *   4. Short interest (Finviz scrape)
 *   5. Insider transactions (SEC EDGAR Form 4)
 *   6. Alert generation for significant signals
 *
 * Route: GET /api/cron/signals-refresh?symbol=AAPL
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import { getActiveSymbols } from "@/lib/db/queries";
import * as polygon from "@/lib/market-data/polygon";
import { detectPatterns, detectMACrossover } from "@/lib/patterns";
import { getShortInterest } from "@/lib/market-data/finviz";
import { getInsiderTransactions } from "@/lib/market-data/sec";
import { cache } from "@/lib/cache";

const INSIDER_BUY_ALERT_THRESHOLD = 100_000;   // $100K → alert
const INSIDER_BUY_BIG_THRESHOLD   = 1_000_000; // $1M  → "major" badge
const SHORT_SQUEEZE_THRESHOLD     = 10;          // 10% short float → watch
const SPY_CACHE_KEY               = "signals:spy_3m_return";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbolParam = request.nextUrl.searchParams.get("symbol")?.toUpperCase();
  const db = createServiceClient();
  const allSymbols = await getActiveSymbols();

  const toProcess = symbolParam
    ? allSymbols.filter((s) => s.symbol === symbolParam)
    : allSymbols;

  if (toProcess.length === 0) {
    return NextResponse.json({ error: `Symbol not found: ${symbolParam}` }, { status: 404 });
  }

  // ── SPY 3m return — cached 24h so each per-symbol call reuses it ─────────
  const spy3mReturn = await cache.getOrSet(
    SPY_CACHE_KEY,
    async () => {
      const spyBars = await polygon.getDailyBars("SPY", 90).catch(() => []);
      if (spyBars.length < 40) return 0;
      const lookback = Math.min(spyBars.length - 1, 63);
      const start = spyBars[spyBars.length - 1 - lookback].c;
      const end   = spyBars[spyBars.length - 1].c;
      return start > 0 ? ((end - start) / start) * 100 : 0;
    },
    86_400 // 24h TTL
  );

  const results: { symbol: string; status: string; details?: object; error?: string }[] = [];

  for (const sym of toProcess) {
    try {
      const symbolResults: Record<string, unknown> = {};

      // Fetch everything in parallel
      const [bars, shortData, insiderTxns, snapHistory] =
        await Promise.all([
          polygon.getDailyBars(sym.symbol, 90).catch(() => []),
          getShortInterest(sym.symbol).catch(() => null),
          getInsiderTransactions(sym.symbol, 60).catch(() => []),
          db
            .from("symbol_snapshots")
            .select("ma_50, ma_200, snapshot_time, total_score")
            .eq("symbol", sym.symbol)
            .order("snapshot_time", { ascending: false })
            .limit(48) // 2 days of hourly snapshots
            .then((r) => r.data ?? []),
        ]);

      // ── 1. Chart Patterns (bars) ────────────────────────────────────────
      if (bars.length >= 20) {
        const currentPrice = bars[bars.length - 1].c;
        const detectedPatterns = detectPatterns(bars);

        await db
          .from("chart_patterns")
          .update({ is_active: false })
          .eq("symbol", sym.symbol)
          .eq("is_active", true)
          .not("pattern_type", "in", '("golden_cross","death_cross")'); // keep crossovers

        if (detectedPatterns.length > 0) {
          await db.from("chart_patterns").insert(
            detectedPatterns.map((p) => ({
              symbol: sym.symbol,
              pattern_type: p.pattern_type,
              confidence: p.confidence,
              price_at_detection: currentPrice,
              description: p.description,
              is_active: true,
            }))
          );

          const PATTERN_LABELS: Record<string, string> = {
            breakout: "Breakout",
            bull_flag: "Bull Flag",
            cup_and_handle: "Cup & Handle",
          };

          for (const p of detectedPatterns) {
            if (p.confidence >= 70) {
              await db.from("alerts").insert({
                symbol: sym.symbol,
                alert_type: "pattern",
                title: `${sym.symbol} — ${PATTERN_LABELS[p.pattern_type] ?? p.pattern_type} (${p.confidence}% confidence)`,
                body: p.description,
                severity: p.confidence >= 85 ? "watch" : "info",
              });
            }
          }
        }

        symbolResults.patterns = detectedPatterns.length;

        // ── 2. MA Crossovers (snapshot history) ──────────────────────────
        if (snapHistory.length >= 2) {
          const latest = snapHistory[0];
          const dayAgo = snapHistory.find(
            (s) =>
              new Date(s.snapshot_time).toDateString() !==
              new Date(latest.snapshot_time).toDateString()
          );

          if (dayAgo) {
            const crossover = detectMACrossover(
              latest.ma_50,
              latest.ma_200,
              dayAgo.ma_50,
              dayAgo.ma_200
            );

            if (crossover) {
              // Deactivate old crossover of this type
              await db
                .from("chart_patterns")
                .update({ is_active: false })
                .eq("symbol", sym.symbol)
                .eq("pattern_type", crossover.pattern_type);

              await db.from("chart_patterns").insert({
                symbol: sym.symbol,
                pattern_type: crossover.pattern_type,
                confidence: crossover.confidence,
                price_at_detection: currentPrice,
                description: crossover.description,
                is_active: true,
              });

              await db.from("alerts").insert({
                symbol: sym.symbol,
                alert_type: "ma_crossover",
                title: `${sym.symbol} — ${crossover.pattern_type === "golden_cross" ? "Golden Cross" : "Death Cross"}`,
                body: crossover.description,
                severity: crossover.pattern_type === "golden_cross" ? "watch" : "warning",
              });

              symbolResults.crossover = crossover.pattern_type;
            }
          }
        }

        // ── 3. Relative Strength vs S&P 500 ──────────────────────────────
        if (bars.length >= 40 && spy3mReturn !== null) {
          // Use up to 63 trading days (~3 months); fall back to available bars
          const lookback = Math.min(bars.length - 1, 63);
          const start = bars[bars.length - 1 - lookback].c;
          const end   = bars[bars.length - 1].c;
          const stock3mReturn = start > 0 ? ((end - start) / start) * 100 : 0;
          const rsVsSpy = stock3mReturn - (spy3mReturn as number);

          // Stamp rs_vs_spy onto the latest snapshot row
          const latestSnapId = snapHistory[0] ? undefined : null; // use update by symbol+time
          await db
            .from("symbol_snapshots")
            .update({ rs_vs_spy: Math.round(rsVsSpy * 10) / 10 })
            .eq("symbol", sym.symbol)
            .eq("snapshot_time", snapHistory[0]?.snapshot_time ?? "");

          symbolResults.rs_vs_spy = Math.round(rsVsSpy * 10) / 10;
        }
      }

      // ── 4. Short Interest ───────────────────────────────────────────────
      if (shortData) {
        await db.from("short_interest").insert({
          symbol: sym.symbol,
          short_float_pct: shortData.short_float_pct,
          short_ratio: shortData.short_ratio,
        });

        if (shortData.short_float_pct >= SHORT_SQUEEZE_THRESHOLD) {
          const score = snapHistory[0]?.total_score ?? 0;
          if (score >= 65) {
            await db.from("alerts").insert({
              symbol: sym.symbol,
              alert_type: "short_squeeze",
              title: `${sym.symbol} — Squeeze watch (${shortData.short_float_pct.toFixed(1)}% float short)`,
              body: `${shortData.short_float_pct.toFixed(1)}% of the float is short (${shortData.short_ratio.toFixed(1)} days to cover). Score: ${score}.`,
              severity: shortData.short_float_pct >= 20 ? "warning" : "watch",
            });
          }
        }

        symbolResults.short_float = shortData.short_float_pct;
      }

      // ── 5. Insider Transactions ─────────────────────────────────────────
      if (insiderTxns.length > 0) {
        for (const tx of insiderTxns) {
          await db
            .from("insider_transactions")
            .upsert(tx, {
              onConflict: "symbol,insider_name,transaction_date,shares",
              ignoreDuplicates: true,
            });
        }

        for (const buy of insiderTxns.filter((t) => t.total_value >= INSIDER_BUY_ALERT_THRESHOLD)) {
          const isMajor = buy.total_value >= INSIDER_BUY_BIG_THRESHOLD;
          await db.from("alerts").insert({
            symbol: sym.symbol,
            alert_type: "insider_buy",
            title: `${sym.symbol} — ${buy.insider_title} bought $${fmtVal(buy.total_value)}`,
            body: `${buy.insider_name} (${buy.insider_title}) purchased ${buy.shares.toLocaleString()} shares at $${buy.price_per_share.toFixed(2)} on ${buy.transaction_date}. Total: $${fmtVal(buy.total_value)}.`,
            severity: isMajor ? "watch" : "info",
          });
        }

        symbolResults.insider_buys = insiderTxns.length;
      }

      results.push({ symbol: sym.symbol, status: "ok", details: symbolResults });
    } catch (err: any) {
      console.error(`Signals refresh error for ${sym.symbol}:`, err);
      results.push({ symbol: sym.symbol, status: "error", error: err.message });
    }
  }

  return NextResponse.json({ ok: true, results });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtVal(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}
