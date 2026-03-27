// ─── Database Row Types ──────────────────────────────────────────────────────

export type UserRole = "admin" | "member";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface TrackedSymbol {
  id: string;
  symbol: string;
  company_name: string;
  is_active: boolean;
  display_order: number;
  sector: string;
  industry: string;
  primary_exchange: string;
  created_at: string;
  updated_at: string;
}

export interface SymbolPeer {
  id: string;
  symbol: string;
  peer_symbol: string;
  created_at: string;
}

export interface SymbolSnapshot {
  id: string;
  symbol: string;
  snapshot_time: string;
  price: number;
  change_1d: number;
  change_1w: number;
  change_1m: number;
  change_3m: number;
  change_1y: number;
  volume: number;
  avg_volume: number;
  market_cap: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  rsi: number;
  ma_20: number;
  ma_50: number;
  ma_200: number;
  volatility_30d: number;
  drawdown_from_high: number;
  trend_score: number;
  setup_score: number;
  valuation_score: number;
  earnings_score: number;
  industry_score: number;
  risk_score: number;
  total_score: number;
}

export interface FinancialMetrics {
  id: string;
  symbol: string;
  as_of_date: string;
  revenue: number;
  revenue_growth: number;
  gross_margin: number;
  operating_margin: number;
  net_margin: number;
  eps: number;
  pe_ratio: number;
  ps_ratio: number;
  ev_to_revenue: number;
  debt_to_equity: number;
  free_cash_flow: number;
  source: string;
  created_at: string;
}

export interface EarningsEvent {
  id: string;
  symbol: string;
  report_date: string;
  fiscal_period: string;
  estimated_eps: number;
  actual_eps: number | null;
  estimated_revenue: number;
  actual_revenue: number | null;
  eps_surprise: number | null;
  revenue_surprise: number | null;
  price_reaction_1d: number | null;
  price_reaction_5d: number | null;
  price_reaction_20d: number | null;
  created_at: string;
}

export interface IndustryBenchmark {
  id: string;
  sector: string;
  industry: string;
  as_of_date: string;
  median_revenue_growth: number;
  median_pe_ratio: number;
  median_ps_ratio: number;
  median_operating_margin: number;
  leader_symbol: string;
  laggard_symbol: string;
  created_at: string;
}

export type EntryZone = "extended" | "fair" | "pullback" | "support_test";
export type RiskLabel = "low" | "moderate" | "elevated" | "high";

export interface EntryZoneData {
  id: string;
  symbol: string;
  as_of_time: string;
  current_zone: EntryZone;
  aggressive_entry_low: number;
  aggressive_entry_high: number;
  patient_entry_low: number;
  patient_entry_high: number;
  invalidation_price: number;
  risk_label: RiskLabel;
  summary: string;
}

export type AlertSeverity = "info" | "watch" | "warning" | "critical";

export interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  title: string;
  body: string;
  severity: AlertSeverity;
  created_at: string;
  is_active: boolean;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  created_at: string;
}

export type NoteType = "general" | "bull_case" | "bear_case" | "catalyst" | "admin_thesis";

export interface Note {
  id: string;
  user_id: string;
  symbol: string;
  note_type: NoteType;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  // joined fields
  user_name?: string;
}

export interface PriceLevel {
  id: string;
  symbol: string;
  price: number;
  initials: string;
  direction: "up" | "down";
  created_at: string;
}

export interface RefreshJob {
  id: string;
  job_type: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "completed" | "failed";
  details: Record<string, unknown>;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface StockCardData {
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  price: number;
  change_1d: number;
  change_1w: number;
  change_1m: number;
  change_3m: number;
  change_1y: number;
  volume: number;
  avg_volume: number;
  market_cap: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  total_score: number;
  trend_score: number;
  current_zone: EntryZone;
  risk_label: RiskLabel;
  next_earnings_date: string | null;
  latest_alert: Alert | null;
}

export interface DashboardData {
  top_movers: StockCardData[];
  upcoming_earnings: (EarningsEvent & { company_name: string })[];
  strongest_trends: StockCardData[];
  best_setups: StockCardData[];
  recent_alerts: Alert[];
  last_refresh: string | null;
}

export interface StockDetailData {
  info: TrackedSymbol;
  snapshot: SymbolSnapshot;
  financials: FinancialMetrics;
  earnings: EarningsEvent[];
  entry_zone: EntryZoneData;
  peers: PeerComparison[];
  alerts: Alert[];
  notes: Note[];
  industry_benchmark: IndustryBenchmark | null;
}

export interface PeerComparison {
  symbol: string;
  company_name: string;
  price: number;
  change_1m: number;
  pe_ratio: number;
  revenue_growth: number;
  total_score: number;
  is_leader: boolean;
}

export interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Score Types ─────────────────────────────────────────────────────────────

export type ScoreLabel = "prime_setup" | "strong_watch" | "neutral" | "risky" | "avoid";

export function getScoreLabel(score: number): ScoreLabel {
  if (score >= 85) return "prime_setup";
  if (score >= 70) return "strong_watch";
  if (score >= 55) return "neutral";
  if (score >= 40) return "risky";
  return "avoid";
}

export function getScoreLabelDisplay(label: ScoreLabel): string {
  const map: Record<ScoreLabel, string> = {
    prime_setup: "Prime Setup",
    strong_watch: "Strong Watch",
    neutral: "Neutral",
    risky: "Risky",
    avoid: "Avoid",
  };
  return map[label];
}

export interface ScoreWeights {
  trend: number;
  earnings: number;
  valuation: number;
  industry: number;
  quality: number;
  risk: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  trend: 0.30,
  earnings: 0.20,
  valuation: 0.15,
  industry: 0.15,
  quality: 0.10,
  risk: 0.10,
};

// ─── API Request Types ───────────────────────────────────────────────────────

export interface AddTrackedSymbolRequest {
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  primary_exchange?: string;
  peers?: string[];
}

export interface CreateNoteRequest {
  symbol: string;
  note_type: NoteType;
  content: string;
  is_pinned?: boolean;
}

export interface UpdateNoteRequest {
  content?: string;
  note_type?: NoteType;
  is_pinned?: boolean;
}
