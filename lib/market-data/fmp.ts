/**
 * Financial Modeling Prep (FMP) API client.
 * Handles: earnings, key metrics, ratios, profiles, financial statements.
 *
 * Docs: https://site.financialmodelingprep.com/developer/docs
 */

const BASE = "https://financialmodelingprep.com/api";
const API_KEY = process.env.FMP_API_KEY!;

async function fmpFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apikey", API_KEY);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
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
  mktCap: number;
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
  evToRevenue: number; // mapped from enterpriseValue / revenue
}

export interface FMPEarnings {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  revenue: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding: string;
  updatedFromDate: string;
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

export interface FMPEarningsCalendar {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  revenue: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding: string;
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

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * Batch quote for multiple tickers — price, change, volume, 52wk, SMAs.
 */
export async function getQuotes(symbols: string[]): Promise<FMPQuote[]> {
  return fmpFetch<FMPQuote[]>(`/v3/quote/${symbols.join(",")}`);
}

/**
 * Company profile with sector, industry, market cap.
 */
export async function getProfile(symbol: string): Promise<FMPProfile | null> {
  const data = await fmpFetch<FMPProfile[]>(`/v3/profile/${symbol}`);
  return data?.[0] ?? null;
}

/**
 * Key metrics (TTM).
 */
export async function getKeyMetricsTTM(symbol: string): Promise<FMPKeyMetrics | null> {
  const data = await fmpFetch<FMPKeyMetrics[]>(`/v3/key-metrics-ttm/${symbol}`);
  return data?.[0] ?? null;
}

/**
 * Historical key metrics (quarterly).
 */
export async function getKeyMetrics(
  symbol: string,
  period: "annual" | "quarter" = "quarter",
  limit: number = 8
): Promise<FMPKeyMetrics[]> {
  return fmpFetch<FMPKeyMetrics[]>(`/v3/key-metrics/${symbol}`, {
    period,
    limit: String(limit),
  });
}

/**
 * Historical earnings (actuals + estimates).
 */
export async function getEarningsHistory(
  symbol: string,
  limit: number = 12
): Promise<FMPEarnings[]> {
  return fmpFetch<FMPEarnings[]>(`/v3/historical/earning_calendar/${symbol}`, {
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
  return fmpFetch<FMPEarningsCalendar[]>(`/v3/earning_calendar`, { from, to });
}

/**
 * Income statements for margin analysis.
 */
export async function getIncomeStatements(
  symbol: string,
  period: "annual" | "quarter" = "quarter",
  limit: number = 8
): Promise<FMPIncomeStatement[]> {
  return fmpFetch<FMPIncomeStatement[]>(`/v3/income-statement/${symbol}`, {
    period,
    limit: String(limit),
  });
}

/**
 * Get financial ratios.
 */
export async function getRatiosTTM(symbol: string) {
  const data = await fmpFetch<any[]>(`/v3/ratios-ttm/${symbol}`);
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
  return fmpFetch<any[]>(`/v3/financial-growth/${symbol}`, {
    period,
    limit: String(limit),
  });
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

  return fmpFetch<any[]>(`/v3/stock-screener`, queryParams);
}
