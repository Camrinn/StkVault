/**
 * STKVAULT Scoring Engine
 *
 * Computes a composite score (0–100) for each stock based on:
 *   30% Trend
 *   20% Earnings
 *   15% Valuation
 *   15% Industry
 *   10% Quality
 *   10% Risk
 *
 * Each sub-score is 0–100. The total is a weighted average.
 */

import type {
  SymbolSnapshot,
  FinancialMetrics,
  EarningsEvent,
  IndustryBenchmark,
  ScoreWeights,
  DEFAULT_SCORE_WEIGHTS,
} from "@/types";

// ─── Sub-score functions ────────────────────────────────────────────────────

/**
 * Trend Score (0–100)
 *
 * Factors:
 * - Price above 20/50/200 MA (+15 each)
 * - Positive 1M return (+10)
 * - Positive 3M return (+10)
 * - Volume above average (+10)
 * - RSI between 40-70 (sweet spot, +15)
 * - Low drawdown from highs (+10)
 */
export function computeTrendScore(snap: SymbolSnapshot): number {
  let score = 0;

  // MA alignment
  if (snap.price > snap.ma_20) score += 15;
  if (snap.price > snap.ma_50) score += 15;
  if (snap.price > snap.ma_200) score += 15;

  // Returns
  if (snap.change_1m > 0) score += 10;
  if (snap.change_3m > 0) score += 10;

  // Volume confirmation
  if (snap.volume > snap.avg_volume) score += 10;

  // RSI sweet spot (not overbought, not oversold)
  if (snap.rsi >= 40 && snap.rsi <= 70) {
    score += 15;
  } else if (snap.rsi >= 30 && snap.rsi <= 80) {
    score += 7;
  }
  // else extreme RSI gets 0

  // Low drawdown bonus
  if (snap.drawdown_from_high > -5) {
    score += 10;
  } else if (snap.drawdown_from_high > -15) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Earnings Score (0–100)
 *
 * Factors:
 * - Recent EPS beats
 * - Recent revenue beats
 * - Positive price reaction after earnings
 * - Consistent beats (streak bonus)
 */
export function computeEarningsScore(earnings: EarningsEvent[]): number {
  if (earnings.length === 0) return 50; // neutral if no data

  let score = 0;
  const recent = earnings.slice(0, 4); // last 4 quarters
  let beatStreak = 0;

  for (const e of recent) {
    if (e.actual_eps == null) continue;

    // EPS beat (+10 per quarter)
    if (e.eps_surprise != null && e.eps_surprise > 0) {
      score += 10;
      beatStreak++;
    }

    // Revenue beat (+7 per quarter)
    if (e.revenue_surprise != null && e.revenue_surprise > 0) {
      score += 7;
    }

    // Positive post-earnings reaction (+5 per quarter)
    if (e.price_reaction_1d != null && e.price_reaction_1d > 0) {
      score += 5;
    }
  }

  // Beat streak bonus (consecutive beats)
  if (beatStreak >= 4) score += 12;
  else if (beatStreak >= 3) score += 8;
  else if (beatStreak >= 2) score += 4;

  return Math.min(100, Math.max(0, score));
}

/**
 * Valuation Score (0–100)
 *
 * Compares the stock's valuation ratios to peer/industry medians.
 * Cheaper than median = higher score (with quality guard).
 */
export function computeValuationScore(
  fin: FinancialMetrics | null,
  benchmark: IndustryBenchmark | null
): number {
  if (!fin) return 50;

  let score = 50; // start neutral

  if (benchmark) {
    // P/E relative to peer median
    if (fin.pe_ratio > 0 && benchmark.median_pe_ratio > 0) {
      const ratio = fin.pe_ratio / benchmark.median_pe_ratio;
      if (ratio < 0.7) score += 20;       // significantly cheaper
      else if (ratio < 0.9) score += 10;   // slightly cheaper
      else if (ratio > 1.3) score -= 15;   // significantly more expensive
      else if (ratio > 1.1) score -= 5;    // slightly more expensive
    }

    // P/S relative to peer median
    if (fin.ps_ratio > 0 && benchmark.median_ps_ratio > 0) {
      const ratio = fin.ps_ratio / benchmark.median_ps_ratio;
      if (ratio < 0.7) score += 15;
      else if (ratio < 0.9) score += 7;
      else if (ratio > 1.3) score -= 10;
    }

    // Revenue growth vs peer median
    if (benchmark.median_revenue_growth > 0) {
      const growthDiff = (fin.revenue_growth ?? 0) - benchmark.median_revenue_growth;
      if (growthDiff > 10) score += 10;
      else if (growthDiff > 0) score += 5;
      else if (growthDiff < -10) score -= 10;
    }
  } else {
    // No benchmark — use absolute levels
    if (fin.pe_ratio > 0 && fin.pe_ratio < 15) score += 10;
    if (fin.pe_ratio > 0 && fin.pe_ratio < 25) score += 5;
    if (fin.pe_ratio > 50) score -= 10;
  }

  // Margin quality guard: don't reward "cheap" if margins are terrible
  if (fin.operating_margin < 0) score -= 10;
  if (fin.operating_margin > 20) score += 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Industry Score (0–100)
 *
 * How strong is the stock's sector/industry context?
 */
export function computeIndustryScore(
  snap: SymbolSnapshot,
  peers: { change_1m: number; total_score: number }[],
  benchmark: IndustryBenchmark | null
): number {
  let score = 50;

  // Is this stock the leader among peers?
  if (peers.length > 0) {
    const peerAvgReturn = peers.reduce((s, p) => s + p.change_1m, 0) / peers.length;
    if (snap.change_1m > peerAvgReturn) score += 15;
    else score -= 10;

    const peerAvgScore = peers.reduce((s, p) => s + p.total_score, 0) / peers.length;
    if (snap.total_score > peerAvgScore) score += 10;
  }

  // Industry strength
  if (benchmark) {
    if (benchmark.median_revenue_growth > 15) score += 15;
    else if (benchmark.median_revenue_growth > 5) score += 7;
    else if (benchmark.median_revenue_growth < 0) score -= 10;

    // Is this the leader?
    if (benchmark.leader_symbol === snap.symbol) score += 10;
    if (benchmark.laggard_symbol === snap.symbol) score -= 15;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Quality Score (0–100)
 *
 * Margin profile and cash flow health.
 */
export function computeQualityScore(fin: FinancialMetrics | null): number {
  if (!fin) return 50;
  let score = 50;

  // Gross margin
  if (fin.gross_margin > 60) score += 15;
  else if (fin.gross_margin > 40) score += 8;
  else if (fin.gross_margin < 20) score -= 10;

  // Operating margin
  if (fin.operating_margin > 25) score += 15;
  else if (fin.operating_margin > 10) score += 7;
  else if (fin.operating_margin < 0) score -= 15;

  // Free cash flow positive
  if (fin.free_cash_flow > 0) score += 10;
  else score -= 10;

  // Low debt
  if (fin.debt_to_equity < 0.5) score += 10;
  else if (fin.debt_to_equity > 2) score -= 10;

  return Math.min(100, Math.max(0, score));
}

/**
 * Risk Score (0–100)
 *
 * Higher = LESS risk (safer).
 * Lower = MORE risk.
 */
export function computeRiskScore(snap: SymbolSnapshot, earnings: EarningsEvent[]): number {
  let score = 70; // start somewhat positive

  // Drawdown
  if (snap.drawdown_from_high < -30) score -= 25;
  else if (snap.drawdown_from_high < -20) score -= 15;
  else if (snap.drawdown_from_high < -10) score -= 5;
  else score += 5;

  // Volatility
  if (snap.volatility_30d > 50) score -= 20;
  else if (snap.volatility_30d > 30) score -= 10;
  else if (snap.volatility_30d < 15) score += 10;

  // Post-earnings behavior (negative reactions = risk)
  const recentEarnings = earnings.slice(0, 2);
  for (const e of recentEarnings) {
    if (e.price_reaction_1d != null && e.price_reaction_1d < -5) {
      score -= 10;
    }
  }

  // RSI extremes
  if (snap.rsi > 80 || snap.rsi < 20) score -= 10;

  return Math.min(100, Math.max(0, score));
}

// ─── Composite Score ────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  trend_score: number;
  earnings_score: number;
  valuation_score: number;
  industry_score: number;
  quality_score: number;
  risk_score: number;
  total_score: number;
}

export function computeTotalScore(
  snap: SymbolSnapshot,
  financials: FinancialMetrics | null,
  earnings: EarningsEvent[],
  peers: { change_1m: number; total_score: number }[],
  benchmark: IndustryBenchmark | null,
  weights: ScoreWeights = {
    trend: 0.30,
    earnings: 0.20,
    valuation: 0.15,
    industry: 0.15,
    quality: 0.10,
    risk: 0.10,
  }
): ScoreBreakdown {
  const trend = computeTrendScore(snap);
  const earn = computeEarningsScore(earnings);
  const val = computeValuationScore(financials, benchmark);
  const ind = computeIndustryScore(snap, peers, benchmark);
  const qual = computeQualityScore(financials);
  const risk = computeRiskScore(snap, earnings);

  const total = Math.round(
    trend * weights.trend +
    earn * weights.earnings +
    val * weights.valuation +
    ind * weights.industry +
    qual * weights.quality +
    risk * weights.risk
  );

  return {
    trend_score: Math.round(trend),
    earnings_score: Math.round(earn),
    valuation_score: Math.round(val),
    industry_score: Math.round(ind),
    quality_score: Math.round(qual),
    risk_score: Math.round(risk),
    total_score: Math.min(100, Math.max(0, total)),
  };
}
