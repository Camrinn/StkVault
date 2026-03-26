/**
 * Fundamentals Refresh Cron Job
 *
 * Runs every 6 hours. Updates financial metrics, valuation ratios,
 * and company profiles from FMP.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import { getActiveSymbols } from "@/lib/db/queries";
import * as fmp from "@/lib/market-data/fmp";

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
      // Fetch profile, metrics, and ratios in parallel
      const [profile, metrics, ratios, growth] = await Promise.all([
        fmp.getProfile(sym.symbol),
        fmp.getKeyMetricsTTM(sym.symbol),
        fmp.getRatiosTTM(sym.symbol),
        fmp.getFinancialGrowth(sym.symbol, "quarter", 1).then((g) => g?.[0]),
      ]);

      if (!profile) {
        results.push({ symbol: sym.symbol, status: "no_profile" });
        continue;
      }

      // Update tracked symbol info
      await db
        .from("tracked_symbols")
        .update({
          company_name: profile.companyName,
          sector: profile.sector,
          industry: profile.industry,
          primary_exchange: profile.exchange,
          updated_at: new Date().toISOString(),
        })
        .eq("symbol", sym.symbol);

      // Upsert financial metrics
      const today = new Date().toISOString().split("T")[0];
      await db.from("financial_metrics").upsert(
        {
          symbol: sym.symbol,
          as_of_date: today,
          revenue: growth?.revenueGrowth ? undefined : undefined, // from income stmt
          revenue_growth: (growth?.revenueGrowth ?? 0) * 100,
          gross_margin: (ratios?.grossProfitMarginTTM ?? 0) * 100,
          operating_margin: (ratios?.operatingProfitMarginTTM ?? 0) * 100,
          net_margin: (ratios?.netProfitMarginTTM ?? 0) * 100,
          eps: metrics?.netIncomePerShare ?? 0,
          pe_ratio: metrics?.peRatio ?? 0,
          ps_ratio: metrics?.priceToSalesRatio ?? 0,
          ev_to_revenue: ratios?.enterpriseValueOverRevenueTTM ?? 0,
          debt_to_equity: metrics?.debtToEquity ?? 0,
          free_cash_flow: metrics?.freeCashFlowPerShare ?? 0,
          source: "fmp",
        },
        { onConflict: "symbol,as_of_date,source" }
      );

      // Update market cap on latest snapshot
      if (profile.mktCap) {
        await db
          .from("symbol_snapshots")
          .update({ market_cap: profile.mktCap })
          .eq("symbol", sym.symbol)
          .order("snapshot_time", { ascending: false })
          .limit(1);
      }

      results.push({ symbol: sym.symbol, status: "ok" });
    } catch (err: any) {
      console.error(`Fundamentals error for ${sym.symbol}:`, err);
      results.push({ symbol: sym.symbol, status: "error" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
