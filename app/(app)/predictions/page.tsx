export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/db/supabase";
import {
  PredictionsBoard,
  type LeaderboardEntry,
  type PredictionRow,
  type SymbolOption,
} from "@/components/predictions/predictions-board";

export default async function PredictionsPage() {
  const db = createServiceClient();

  // Auto-resolve any expired predictions on page load
  const today = new Date().toISOString().split("T")[0];
  const { data: expired } = await db
    .from("predictions")
    .select("*")
    .is("resolved_at", null)
    .lte("target_date", today);

  if (expired?.length) {
    const symbols = [...new Set(expired.map((p) => p.symbol))];
    const { data: snaps } = await db
      .from("symbol_snapshots")
      .select("symbol, price")
      .in("symbol", symbols)
      .order("snapshot_time", { ascending: false });

    const priceMap: Record<string, number> = {};
    for (const s of snaps ?? []) {
      if (!priceMap[s.symbol]) priceMap[s.symbol] = s.price;
    }

    for (const pred of expired) {
      const cp = priceMap[pred.symbol];
      if (!cp) continue;
      const ret = ((cp - pred.price_at_call) / pred.price_at_call) * 100;
      await db
        .from("predictions")
        .update({
          resolved_at: new Date().toISOString(),
          price_at_resolve: cp,
          return_pct: Math.round(ret * 100) / 100,
          was_correct: pred.direction === "bull" ? ret > 0 : ret < 0,
        })
        .eq("id", pred.id);
    }
  }

  // Fetch all predictions
  const { data: all } = await db
    .from("predictions")
    .select("*")
    .order("created_at", { ascending: false });

  const allPredictions = (all ?? []) as PredictionRow[];

  // Fetch current prices for active predictions
  const activeSymbols = [
    ...new Set(
      allPredictions.filter((p) => p.was_correct === null).map((p) => p.symbol)
    ),
  ];
  const currentPrices: Record<string, number> = {};
  if (activeSymbols.length > 0) {
    const { data: snaps } = await db
      .from("symbol_snapshots")
      .select("symbol, price")
      .in("symbol", activeSymbols)
      .order("snapshot_time", { ascending: false });
    for (const s of snaps ?? []) {
      if (!currentPrices[s.symbol]) currentPrices[s.symbol] = s.price;
    }
  }

  // Compute leaderboard
  const playerStats: Record<
    string,
    { total: number; resolved: number; correct: number; returnSum: number; lastActive: string }
  > = {};

  for (const p of allPredictions) {
    if (!playerStats[p.player_name]) {
      playerStats[p.player_name] = { total: 0, resolved: 0, correct: 0, returnSum: 0, lastActive: p.created_at };
    }
    const s = playerStats[p.player_name];
    s.total++;
    if (p.created_at > s.lastActive) s.lastActive = p.created_at;
    if (p.was_correct !== null) {
      s.resolved++;
      if (p.was_correct) {
        s.correct++;
        s.returnSum += p.return_pct ?? 0;
      }
    }
  }

  const leaderboard: LeaderboardEntry[] = Object.entries(playerStats)
    .map(([name, s]) => ({
      player_name: name,
      total_calls: s.total,
      resolved_calls: s.resolved,
      correct_calls: s.correct,
      win_rate: s.resolved > 0 ? s.correct / s.resolved : 0,
      avg_return: s.correct > 0 ? s.returnSum / s.correct : 0,
      ranked: s.resolved >= 3,
      last_active: s.lastActive,
    }))
    .sort((a, b) => {
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
      if (a.ranked) return b.win_rate - a.win_rate || b.avg_return - a.avg_return;
      return b.total_calls - a.total_calls;
    });

  // Symbol options for the call form
  const { data: symData } = await db
    .from("tracked_symbols")
    .select("symbol, company_name")
    .eq("is_active", true)
    .order("display_order");

  const symbols: SymbolOption[] = (symData ?? []).map((s: any) => ({
    symbol: s.symbol,
    company_name: s.company_name ?? s.symbol,
  }));

  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="text-lg font-mono font-extrabold tracking-wider mb-1">PREDICTIONS</h1>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4 font-mono">
        Make your call · track your record · climb the board
      </p>
      <PredictionsBoard
        leaderboard={leaderboard}
        predictions={allPredictions}
        currentPrices={currentPrices}
        symbols={symbols}
      />
    </div>
  );
}
