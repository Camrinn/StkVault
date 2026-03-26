import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import { getActiveSymbols, getLatestSnapshot, getLatestFinancials } from "@/lib/db/queries";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const symbols = await getActiveSymbols();

  // Group by industry
  const industries: Record<string, {
    sector: string;
    stocks: { symbol: string; revenue_growth: number; pe: number; ps: number; op_margin: number; score: number }[];
  }> = {};

  for (const sym of symbols) {
    const [snap, fin] = await Promise.all([
      getLatestSnapshot(sym.symbol),
      getLatestFinancials(sym.symbol),
    ]);
    if (!snap) continue;

    const key = sym.industry || sym.sector || "Other";
    if (!industries[key]) industries[key] = { sector: sym.sector, stocks: [] };
    industries[key].stocks.push({
      symbol: sym.symbol,
      revenue_growth: fin?.revenue_growth ?? 0,
      pe: fin?.pe_ratio ?? 0,
      ps: fin?.ps_ratio ?? 0,
      op_margin: fin?.operating_margin ?? 0,
      score: snap.total_score,
    });
  }

  const today = new Date().toISOString().split("T")[0];

  for (const [industry, data] of Object.entries(industries)) {
    if (data.stocks.length < 2) continue;

    const sorted = [...data.stocks].sort((a, b) => b.score - a.score);
    const median = (arr: number[]) => {
      const s = arr.filter((v) => v > 0).sort((a, b) => a - b);
      if (s.length === 0) return 0;
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };

    await db.from("industry_benchmarks").upsert(
      {
        sector: data.sector,
        industry,
        as_of_date: today,
        median_revenue_growth: median(data.stocks.map((s) => s.revenue_growth)),
        median_pe_ratio: median(data.stocks.map((s) => s.pe)),
        median_ps_ratio: median(data.stocks.map((s) => s.ps)),
        median_operating_margin: median(data.stocks.map((s) => s.op_margin)),
        leader_symbol: sorted[0]?.symbol ?? null,
        laggard_symbol: sorted[sorted.length - 1]?.symbol ?? null,
      },
      { onConflict: "industry,as_of_date" }
    );
  }

  return NextResponse.json({ ok: true, industries: Object.keys(industries).length });
}
