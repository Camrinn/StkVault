/**
 * Financial Modeling Prep (FMP) API client.
 * Uses /stable/ endpoints (migrated from legacy /api/v3/ and /api/v4/).
 *
 * Docs: https://site.financialmodelingprep.com/developer/docs
 */

const BASE = "https://financialmodelingprep.com/stable";
const API_KEY = process.env.FMP_API_KEY!;

async function fmpFetch<T>(
  path: string,
  params?: Record<string, string>,
  revalidate: number = 0
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apikey", API_KEY);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`FMP API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FMPProfile {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;  // stable API uses marketCap (not mktCap)
  price: number;
  exchange: string;
  description: string;
  fullTimeEmployees: string;
  country: string;
}

export interface FMPKeyMetrics {
  date: string;
  symbol: string;
  revenuePerShare: number;
  netIncomePerShare: number;
  operatingCashFlowPerShare: number;
  freeCashFlowPerShare: number;
  peRatio: number;
  priceToSalesRatio: number;
  enterpriseValueOverEBITDA: number;
  debtToEquity: number;
  dividendYield: number;
  earningsYield: number;
  evToRevenue: number;
  // Margin fields (from /ratios-ttm, exposed here to avoid a duplicate fetch)
  grossProfitMargin: number;
  operatingProfitMargin: number;
  netProfitMargin: number;
}

// /stable/earnings returns epsActual / revenueActual (not eps / revenue)
export interface FMPEarnings {
  date: string;
  symbol: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
  period?: string;           // e.g. "Q1 2025"
  fiscalDateEnding?: string; // legacy field, may still be present
}

export interface FMPEarningsCalendar {
  date: string;
  symbol: string;
  epsEstimated: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding?: string;
}

export interface FMPIncomeStatement {
  date: string;
  symbol: string;
  revenue: number;
  grossProfit: number;
  grossProfitRatio: number;
  operatingIncome: number;
  operatingIncomeRatio: number;
  netIncome: number;
  netIncomeRatio: number;
  eps: number;
  epsdiluted: number;
}

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  volume: number;
  avgVolume: number;
  previousClose: number;
}

// ─── Analyst Types ───────────────────────────────────────────────────────────

export interface FMPGradesConsensus {
  symbol: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  consensus: string; // "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell"
}

export interface FMPPriceTargetSummary {
  symbol: string;
  lastMonthAvgPriceTarget: number | null;
  lastMonthCount: number | null;
  lastQuarterAvgPriceTarget: number | null;
  lastQuarterCount: number | null;
  lastYearAvgPriceTarget: number | null;
  lastYearCount: number | null;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * Batch quote for multiple tickers — price, change, volume, 52wk, SMAs.
 */
export async function getQuotes(symbols: string[]): Promise<FMPQuote[]> {
  return fmpFetch<FMPQuote[]>(`/quote`, { symbol: symbols.join(",") });
}

/**
 * Company profile with sector, industry, market cap.
 */
export async function getProfile(symbol: string): Promise<FMPProfile | null> {
  const data = await fmpFetch<FMPProfile[]>(`/profile`, { symbol });
  return data?.[0] ?? null;
}

/**
 * Key metrics (TTM).
 * Merges /key-metrics-ttm and /ratios-ttm to reconstruct the legacy FMPKeyMetrics shape.
 */
export async function getKeyMetricsTTM(symbol: string): Promise<FMPKeyMetrics | null> {
  const [kmData, ratioData] = await Promise.all([
    fmpFetch<any[]>(`/key-metrics-ttm`, { symbol }).catch(() => []),
    fmpFetch<any[]>(`/ratios-ttm`, { symbol }).catch(() => []),
  ]);
  const km = kmData?.[0];
  const r = ratioData?.[0];
  if (!km && !r) return null;

  return {
    date: km?.date ?? "",
    symbol: km?.symbol ?? symbol,
    revenuePerShare: r?.revenuePerShareTTM ?? 0,
    netIncomePerShare: r?.netIncomePerShareTTM ?? 0,
    operatingCashFlowPerShare: r?.operatingCashFlowPerShareTTM ?? 0,
    freeCashFlowPerShare: r?.freeCashFlowPerShareTTM ?? 0,
    peRatio: r?.priceToEarningsRatioTTM ?? 0,
    priceToSalesRatio: r?.priceToSalesRatioTTM ?? 0,
    enterpriseValueOverEBITDA: km?.evToEBITDATTM ?? 0,
    debtToEquity: r?.debtToEquityRatioTTM ?? 0,
    dividendYield: r?.dividendYieldTTM ?? 0,
    earningsYield: 0,
    evToRevenue: km?.evToSalesTTM ?? 0,
    grossProfitMargin: r?.grossProfitMarginTTM ?? 0,
    operatingProfitMargin: r?.operatingProfitMarginTTM ?? 0,
    netProfitMargin: r?.netProfitMarginTTM ?? 0,
  };
}

/**
 * Historical key metrics (quarterly).
 */
export async function getKeyMetrics(
  symbol: string,
  period: "annual" | "quarter" = "quarter",
  limit: number = 8
): Promise<FMPKeyMetrics[]> {
  return fmpFetch<FMPKeyMetrics[]>(`/key-metrics`, {
    symbol,
    period,
    limit: String(limit),
  });
}

/**
 * Historical earnings (actuals + estimates).
 * Note: stable endpoint returns epsActual / revenueActual instead of eps / revenue.
 */
export async function getEarningsHistory(
  symbol: string,
  limit: number = 12
): Promise<FMPEarnings[]> {
  return fmpFetch<FMPEarnings[]>(`/earnings`, {
    symbol,
    limit: String(limit),
  });
}

/**
 * Upcoming earnings calendar (all stocks).
 */
export async function getEarningsCalendar(
  from: string,
  to: string
): Promise<FMPEarningsCalendar[]> {
  return fmpFetch<FMPEarningsCalendar[]>(`/earnings-calendar`, { from, to });
}

/**
 * Income statements for margin analysis.
 */
export async function getIncomeStatements(
  symbol: string,
  period: "annual" | "quarter" = "quarter",
  limit: number = 8
): Promise<FMPIncomeStatement[]> {
  return fmpFetch<FMPIncomeStatement[]>(`/income-statement`, {
    symbol,
    period,
    limit: String(limit),
  });
}

/**
 * Get financial ratios (TTM).
 */
export async function getRatiosTTM(symbol: string) {
  const data = await fmpFetch<any[]>(`/ratios-ttm`, { symbol });
  return data?.[0] ?? null;
}

/**
 * Get financial growth rates.
 */
export async function getFinancialGrowth(
  symbol: string,
  period: "annual" | "quarter" = "quarter",
  limit: number = 4
) {
  return fmpFetch<any[]>(`/financial-growth`, {
    symbol,
    period,
    limit: String(limit),
  });
}

/**
 * Analyst grades consensus (buy / hold / sell distribution).
 * Replaces per-event upgrades/downgrades which require a higher plan tier.
 */
export async function getGradesConsensus(
  symbol: string
): Promise<FMPGradesConsensus | null> {
  try {
    // Analyst ratings change slowly — cache 4 hours via Next.js fetch cache
    const data = await fmpFetch<FMPGradesConsensus[]>(`/grades-consensus`, { symbol }, 14_400);
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Price target summary (average targets over last month, quarter, year).
 */
export async function getPriceTargetSummary(
  symbol: string
): Promise<FMPPriceTargetSummary | null> {
  try {
    // Price targets change slowly — cache 4 hours via Next.js fetch cache
    const data = await fmpFetch<FMPPriceTargetSummary[]>(`/price-target-summary`, { symbol }, 14_400);
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Stock screener — useful for finding peers.
 */
export async function screenStocks(params: {
  sector?: string;
  industry?: string;
  marketCapMoreThan?: number;
  marketCapLessThan?: number;
  limit?: number;
}) {
  const queryParams: Record<string, string> = {};
  if (params.sector) queryParams.sector = params.sector;
  if (params.industry) queryParams.industry = params.industry;
  if (params.marketCapMoreThan) queryParams.marketCapMoreThan = String(params.marketCapMoreThan);
  if (params.marketCapLessThan) queryParams.marketCapLessThan = String(params.marketCapLessThan);
  queryParams.limit = String(params.limit ?? 20);

  return fmpFetch<any[]>(`/stock-screener`, queryParams);
}
