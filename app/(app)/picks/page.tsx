export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/db/supabase";
import { PicksBoard } from "@/components/picks/picks-board";

export default async function PicksPage() {
  const db = createServiceClient();

  // Auto-resolve expired sessions using latest snapshot prices
  const { data: expiredSessions } = await db
    .from("ai_pick_sessions")
    .select("id")
    .eq("is_resolved", false)
    .lte("resolve_date", new Date().toISOString());

  for (const session of expiredSessions ?? []) {
    const { data: picks } = await db
      .from("ai_picks")
      .select("id, symbol, price_at_pick")
      .eq("session_id", session.id);

    if (!picks?.length) continue;

    const symbols = picks.map((p) => p.symbol);
    const { data: snapshots } = await db
      .from("symbol_snapshots")
      .select("symbol, price")
      .in("symbol", symbols)
      .order("snapshot_time", { ascending: false });

    const priceMap: Record<string, number> = {};
    for (const s of snapshots ?? []) {
      if (!priceMap[s.symbol]) priceMap[s.symbol] = s.price;
    }

    // Resolve each pick
    let wins = 0;
    let totalPct = 0;
    for (const pick of picks) {
      const currentPrice = priceMap[pick.symbol];
      if (!currentPrice) continue;
      const pct = ((currentPrice - pick.price_at_pick) / pick.price_at_pick) * 100;
      const isWinner = pct > 0;
      if (isWinner) wins++;
      totalPct += pct;

      await db
        .from("ai_picks")
        .update({ resolved_price: currentPrice, resolved_pct: pct, is_winner: isWinner })
        .eq("id", pick.id);
    }

    await db
      .from("ai_pick_sessions")
      .update({
        is_resolved: true,
        win_count: wins,
        avg_return_pct: totalPct / picks.length,
      })
      .eq("id", session.id);
  }

  // Fetch all sessions with picks, newest first
  const { data: sessions } = await db
    .from("ai_pick_sessions")
    .select("*, ai_picks(*)")
    .order("pick_date", { ascending: false })
    .limit(10);

  // Fetch current snapshot prices for active pick symbols
  const activeSessions = (sessions ?? []).filter((s) => !s.is_resolved);
  const activeSymbols = [
    ...new Set(activeSessions.flatMap((s) => (s.ai_picks ?? []).map((p: any) => p.symbol))),
  ] as string[];

  const priceMap: Record<string, number> = {};
  if (activeSymbols.length > 0) {
    const { data: snaps } = await db
      .from("symbol_snapshots")
      .select("symbol, price")
      .in("symbol", activeSymbols)
      .order("snapshot_time", { ascending: false });

    for (const s of snaps ?? []) {
      if (!priceMap[s.symbol]) priceMap[s.symbol] = s.price;
    }
  }

  // Lifetime record across all resolved sessions
  const resolved = (sessions ?? []).filter((s) => s.is_resolved);
  const lifetimePicks = resolved.flatMap((s) => s.ai_picks ?? []);
  const lifetimeRecord = {
    totalSessions: resolved.length,
    totalPicks: lifetimePicks.length,
    wins: lifetimePicks.filter((p: any) => p.is_winner).length,
    avgReturn:
      lifetimePicks.length > 0
        ? lifetimePicks.reduce((a: number, p: any) => a + (p.resolved_pct ?? 0), 0) / lifetimePicks.length
        : 0,
    bestPick: lifetimePicks.reduce(
      (best: any, p: any) => (!best || (p.resolved_pct ?? 0) > (best.resolved_pct ?? 0) ? p : best),
      null as any
    ),
  };

  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="text-lg font-mono font-extrabold tracking-wider mb-1">AI PICKS</h1>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4 font-mono">
        Claude analyzes all tracked stocks and selects 3–4 for a given timeline.
      </p>
      <PicksBoard
        sessions={sessions ?? []}
        currentPrices={priceMap}
        lifetimeRecord={lifetimeRecord}
      />
    </div>
  );
}
