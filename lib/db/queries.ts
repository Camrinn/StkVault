import { createServiceClient } from "./supabase";
import type {
  TrackedSymbol,
  SymbolSnapshot,
  FinancialMetrics,
  EarningsEvent,
  EntryZoneData,
  Alert,
  Note,
  IndustryBenchmark,
  StockCardData,
  DashboardData,
  PeerComparison,
} from "@/types";

const db = () => createServiceClient();

// ─── Tracked Symbols ────────────────────────────────────────────────────────

export async function getActiveSymbols(): Promise<TrackedSymbol[]> {
  const { data, error } = await db()
    .from("tracked_symbols")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  if (error) throw error;
  return data ?? [];
}

export async function getSymbolByTicker(symbol: string): Promise<TrackedSymbol | null> {
  const { data, error } = await db()
    .from("tracked_symbols")
    .select("*")
    .eq("symbol", symbol)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// ─── Snapshots ──────────────────────────────────────────────────────────────

export async function getLatestSnapshot(symbol: string): Promise<SymbolSnapshot | null> {
  const { data, error } = await db()
    .from("symbol_snapshots")
    .select("*")
    .eq("symbol", symbol)
    .order("snapshot_time", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getSnapshotHistory(
  symbol: string,
  days: number = 90
): Promise<SymbolSnapshot[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await db()
    .from("symbol_snapshots")
    .select("*")
    .eq("symbol", symbol)
    .gte("snapshot_time", since)
    .order("snapshot_time");
  if (error) throw error;
  return data ?? [];
}

export async function upsertSnapshot(snapshot: Omit<SymbolSnapshot, "id">) {
  const { error } = await db().from("symbol_snapshots").insert(snapshot);
  if (error) throw error;
}

// ─── Financials ─────────────────────────────────────────────────────────────

export async function getLatestFinancials(symbol: string): Promise<FinancialMetrics | null> {
  const { data, error } = await db()
    .from("financial_metrics")
    .select("*")
    .eq("symbol", symbol)
    .order("as_of_date", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// ─── Earnings ───────────────────────────────────────────────────────────────

export async function getEarningsHistory(symbol: string, limit = 8): Promise<EarningsEvent[]> {
  const { data, error } = await db()
    .from("earnings_events")
    .select("*")
    .eq("symbol", symbol)
    .order("report_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getUpcomingEarnings(): Promise<(EarningsEvent & { company_name: string })[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await db()
    .from("earnings_events")
    .select("*, tracked_symbols(company_name)")
    .is("actual_eps", null)
    .gte("report_date", today)
    .order("report_date")
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    ...e,
    company_name: e.tracked_symbols?.company_name ?? e.symbol,
  }));
}

// ─── Entry Zones ────────────────────────────────────────────────────────────

export async function getLatestEntryZone(symbol: string): Promise<EntryZoneData | null> {
  const { data, error } = await db()
    .from("entry_zones")
    .select("*")
    .eq("symbol", symbol)
    .order("as_of_time", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// ─── Alerts ─────────────────────────────────────────────────────────────────

export async function getActiveAlerts(symbol?: string): Promise<Alert[]> {
  let query = db()
    .from("alerts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (symbol) query = query.eq("symbol", symbol);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export async function getNotesForSymbol(symbol: string): Promise<Note[]> {
  const { data, error } = await db()
    .from("notes")
    .select("*, users(name)")
    .eq("symbol", symbol)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((n: any) => ({
    ...n,
    user_name: n.users?.name ?? "Unknown",
  }));
}

// ─── Peers ──────────────────────────────────────────────────────────────────

export async function getPeerComparisons(symbol: string): Promise<PeerComparison[]> {
  // Get peer symbols
  const { data: peers } = await db()
    .from("symbol_peers")
    .select("peer_symbol")
    .eq("symbol", symbol);

  if (!peers?.length) return [];

  const peerSymbols = peers.map((p) => p.peer_symbol);
  const allSymbols = [symbol, ...peerSymbols];

  // Get latest snapshots + financials for all
  const results: PeerComparison[] = [];
  for (const s of allSymbols) {
    const [snap, fin, info] = await Promise.all([
      getLatestSnapshot(s),
      getLatestFinancials(s),
      getSymbolByTicker(s),
    ]);
    if (snap) {
      results.push({
        symbol: s,
        company_name: info?.company_name ?? s,
        price: snap.price,
        change_1m: snap.change_1m,
        pe_ratio: fin?.pe_ratio ?? 0,
        revenue_growth: fin?.revenue_growth ?? 0,
        total_score: snap.total_score,
        is_leader: false,
      });
    }
  }

  // Mark leader
  if (results.length > 0) {
    const best = results.reduce((a, b) => (a.total_score > b.total_score ? a : b));
    const leader = results.find((r) => r.symbol === best.symbol);
    if (leader) leader.is_leader = true;
  }

  return results;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboardData(): Promise<DashboardData> {
  const symbols = await getActiveSymbols();
  const cards: StockCardData[] = [];

  for (const sym of symbols) {
    const [snap, ez, alert] = await Promise.all([
      getLatestSnapshot(sym.symbol),
      getLatestEntryZone(sym.symbol),
      getActiveAlerts(sym.symbol).then((a) => a[0] ?? null),
    ]);

    if (snap) {
      cards.push({
        symbol: sym.symbol,
        company_name: sym.company_name,
        sector: sym.sector,
        industry: sym.industry,
        price: snap.price,
        change_1d: snap.change_1d,
        change_1w: snap.change_1w,
        change_1m: snap.change_1m,
        change_3m: snap.change_3m,
        change_1y: snap.change_1y,
        volume: snap.volume,
        avg_volume: snap.avg_volume,
        market_cap: snap.market_cap,
        fifty_two_week_high: snap.fifty_two_week_high,
        fifty_two_week_low: snap.fifty_two_week_low,
        total_score: snap.total_score,
        trend_score: snap.trend_score,
        current_zone: ez?.current_zone ?? "fair",
        risk_label: ez?.risk_label ?? "moderate",
        next_earnings_date: null,
        latest_alert: alert,
      });
    }
  }

  const sorted = [...cards].sort((a, b) => b.total_score - a.total_score);
  const movers = [...cards].sort((a, b) => Math.abs(b.change_1d) - Math.abs(a.change_1d));

  // Get last refresh time
  const { data: lastJob } = await db()
    .from("refresh_jobs")
    .select("finished_at")
    .eq("status", "completed")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  return {
    top_movers: movers.slice(0, 5),
    upcoming_earnings: await getUpcomingEarnings(),
    strongest_trends: sorted.slice(0, 5),
    best_setups: sorted.filter((c) => c.total_score >= 70).slice(0, 5),
    recent_alerts: await getActiveAlerts(),
    last_refresh: lastJob?.finished_at ?? null,
  };
}
