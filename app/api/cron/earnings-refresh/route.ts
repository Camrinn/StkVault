/**
 * Earnings Refresh Cron Job
 *
 * Runs every 4 hours. Updates earnings calendar, historical results,
 * and post-earnings price reactions.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import { getActiveSymbols } from "@/lib/db/queries";
import * as fmp from "@/lib/market-data/fmp";
import * as polygon from "@/lib/market-data/polygon";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const symbols = await getActiveSymbols();
  const results: { symbol: string; status: string }[] = [];

  for (const sym of symbols) {
    try {
      const earningsHistory = await fmp.getEarningsHistory(sym.symbol, 12);

      for (const e of earningsHistory) {
        // Calculate price reactions if earnings have been reported
        let priceReaction1d: number | null = null;
        let priceReaction5d: number | null = null;
        let priceReaction20d: number | null = null;

        if (e.epsActual !== null) {
          try {
            const reportDate = new Date(e.date);
            const after1d = new Date(reportDate.getTime() + 2 * 86400000);
            const after5d = new Date(reportDate.getTime() + 7 * 86400000);
            const after20d = new Date(reportDate.getTime() + 25 * 86400000);

            const bars = await polygon.getAggregates(
              sym.symbol, 1, "day",
              e.date,
              after20d.toISOString().split("T")[0]
            );

            if (bars.length >= 2) {
              const basePrice = bars[0].c;
              priceReaction1d = bars[1] ? ((bars[1].c - basePrice) / basePrice) * 100 : null;
              const bar5 = bars[Math.min(5, bars.length - 1)];
              priceReaction5d = bar5 ? ((bar5.c - basePrice) / basePrice) * 100 : null;
              const bar20 = bars[Math.min(20, bars.length - 1)];
              priceReaction20d = bar20 ? ((bar20.c - basePrice) / basePrice) * 100 : null;
            }
          } catch {
            // Price reaction calc is best-effort
          }
        }

        // Upsert earnings event
        await db.from("earnings_events").upsert(
          {
            symbol: sym.symbol,
            report_date: e.date,
            fiscal_period: e.period ?? e.fiscalDateEnding ?? "",
            estimated_eps: e.epsEstimated,
            actual_eps: e.epsActual,
            estimated_revenue: e.revenueEstimated,
            actual_revenue: e.revenueActual,
            eps_surprise: e.epsActual != null && e.epsEstimated != null
              ? ((e.epsActual - e.epsEstimated) / Math.abs(e.epsEstimated || 1)) * 100
              : null,
            revenue_surprise: e.revenueActual != null && e.revenueEstimated != null
              ? ((e.revenueActual - e.revenueEstimated) / Math.abs(e.revenueEstimated || 1)) * 100
              : null,
            price_reaction_1d: priceReaction1d,
            price_reaction_5d: priceReaction5d,
            price_reaction_20d: priceReaction20d,
          },
          { onConflict: "symbol,report_date,fiscal_period" }
        );
      }

      results.push({ symbol: sym.symbol, status: "ok" });
    } catch (err: any) {
      console.error(`Earnings error for ${sym.symbol}:`, err);
      results.push({ symbol: sym.symbol, status: "error" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
