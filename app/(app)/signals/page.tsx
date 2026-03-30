export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/db/supabase";
import * as fmp from "@/lib/market-data/fmp";
import {
  SignalsBoard,
  type InsiderRow,
  type ShortSqueezeRow,
  type PatternRow,
  type EntrySignalRow,
  type AnalystRow,
} from "@/components/signals/signals-board";

export default async function SignalsPage() {
  const db = createServiceClient();

  // ── Insider Buying ─────────────────────────────────────────────────────────
  const { data: insiderRaw } = await db
    .from("insider_transactions")
    .select("*, tracked_symbols(company_name)")
    .eq("transaction_type", "P")
    .gte("transaction_date", new Date(Date.now() - 60 * 86_400_000).toISOString().split("T")[0])
    .order("total_value", { ascending: false })
    .limit(50);

  const insiderBuys: InsiderRow[] = (insiderRaw ?? []).map((r: any) => ({
    id: r.id,
    symbol: r.symbol,
    company_name: r.tracked_symbols?.company_name ?? r.symbol,
    insider_name: r.insider_name,
    insider_title: r.insider_title,
    shares: r.shares,
    price_per_share: r.price_per_share,
    total_value: r.total_value,
    transaction_date: r.transaction_date,
    sec_link: r.sec_link ?? "",
  }));

  // ── Analyst Consensus (live from FMP) ─────────────────────────────────────
  const { data: trackedRaw } = await db
    .from("tracked_symbols")
    .select("symbol, company_name")
    .eq("is_active", true);

  const analystActions: AnalystRow[] = (
    await Promise.all(
      (trackedRaw ?? []).map(async (sym: any) => {
        const [cResult, tResult] = await Promise.allSettled([
          fmp.getGradesConsensus(sym.symbol),
          fmp.getPriceTargetSummary(sym.symbol),
        ]);
        const c = cResult.status === "fulfilled" ? cResult.value : null;
        const t = tResult.status === "fulfilled" ? tResult.value : null;
        const total = (c?.strongBuy ?? 0) + (c?.buy ?? 0) + (c?.hold ?? 0) + (c?.sell ?? 0) + (c?.strongSell ?? 0);
        if (!c || total === 0) return null;
        return {
          symbol: sym.symbol,
          company_name: sym.company_name ?? sym.symbol,
          consensus: c.consensus,
          strongBuy: c.strongBuy,
          buy: c.buy,
          hold: c.hold,
          sell: c.sell,
          strongSell: c.strongSell,
          totalAnalysts: total,
          lastMonthTarget: t?.lastMonthAvgPriceTarget ?? null,
          lastQuarterTarget: t?.lastQuarterAvgPriceTarget ?? null,
          numberOfAnalysts: t?.lastMonthCount ?? null,
        } satisfies AnalystRow;
      })
    )
  ).filter(Boolean) as AnalystRow[];

  // ── Short Squeeze Watch ────────────────────────────────────────────────────
  const { data: shortRaw } = await db
    .from("latest_short_interest")
    .select("symbol, short_float_pct, short_ratio");

  const squeezeWatch: ShortSqueezeRow[] = [];
  for (const si of (shortRaw ?? []) as any[]) {
    if (si.short_float_pct < 10) continue;

    const [snapRes, ezRes, infoRes] = await Promise.all([
      db
        .from("symbol_snapshots")
        .select("total_score, rs_vs_spy")
        .eq("symbol", si.symbol)
        .order("snapshot_time", { ascending: false })
        .limit(1)
        .single(),
      db
        .from("entry_zones")
        .select("current_zone")
        .eq("symbol", si.symbol)
        .order("as_of_time", { ascending: false })
        .limit(1)
        .single(),
      db.from("tracked_symbols").select("company_name").eq("symbol", si.symbol).single(),
    ]);

    squeezeWatch.push({
      symbol: si.symbol,
      company_name: infoRes.data?.company_name ?? si.symbol,
      short_float_pct: si.short_float_pct,
      short_ratio: si.short_ratio,
      total_score: snapRes.data?.total_score ?? 0,
      rs_vs_spy: snapRes.data?.rs_vs_spy ?? null,
      current_zone: ezRes.data?.current_zone ?? "fair",
    });
  }
  squeezeWatch.sort((a, b) => b.short_float_pct - a.short_float_pct);

  // ── Chart Patterns ─────────────────────────────────────────────────────────
  const { data: patternsRaw } = await db
    .from("chart_patterns")
    .select("*, tracked_symbols(company_name)")
    .eq("is_active", true)
    .order("confidence", { ascending: false })
    .limit(30);

  const patterns: PatternRow[] = (patternsRaw ?? []).map((r: any) => ({
    id: r.id,
    symbol: r.symbol,
    company_name: r.tracked_symbols?.company_name ?? r.symbol,
    pattern_type: r.pattern_type,
    confidence: r.confidence,
    price_at_detection: r.price_at_detection,
    description: r.description,
    detected_at: r.detected_at,
  }));

  // ── Entry Signals ──────────────────────────────────────────────────────────
  const { data: ezRaw } = await db
    .from("latest_entry_zones")
    .select("*")
    .in("current_zone", ["pullback", "support_test"])
    .order("current_zone");

  const entrySignals: EntrySignalRow[] = [];
  for (const ez of (ezRaw ?? []) as any[]) {
    const [snapRes, infoRes] = await Promise.all([
      db
        .from("symbol_snapshots")
        .select("total_score, price, rs_vs_spy")
        .eq("symbol", ez.symbol)
        .order("snapshot_time", { ascending: false })
        .limit(1)
        .single(),
      db.from("tracked_symbols").select("company_name").eq("symbol", ez.symbol).single(),
    ]);

    entrySignals.push({
      symbol: ez.symbol,
      company_name: infoRes.data?.company_name ?? ez.symbol,
      current_zone: ez.current_zone,
      risk_label: ez.risk_label,
      total_score: snapRes.data?.total_score ?? 0,
      price: snapRes.data?.price ?? 0,
      rs_vs_spy: snapRes.data?.rs_vs_spy ?? null,
      aggressive_entry_low: ez.aggressive_entry_low,
      aggressive_entry_high: ez.aggressive_entry_high,
      patient_entry_low: ez.patient_entry_low,
      patient_entry_high: ez.patient_entry_high,
      summary: ez.summary,
    });
  }

  entrySignals.sort((a, b) => {
    if (a.current_zone !== b.current_zone) return a.current_zone === "support_test" ? -1 : 1;
    return b.total_score - a.total_score;
  });

  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="text-lg font-mono font-extrabold tracking-wider mb-1">SIGNALS</h1>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4 font-mono">
        Insider buys · Analyst actions · Squeeze watch · Patterns · Entry zones
      </p>
      <SignalsBoard
        insiderBuys={insiderBuys}
        analystActions={analystActions}
        squeezeWatch={squeezeWatch}
        patterns={patterns}
        entrySignals={entrySignals}
      />
    </div>
  );
}
