/**
 * Polygon.io API client for market data.
 * Handles: snapshots, aggregates (OHLCV bars), technicals.
 *
 * Docs: https://polygon.io/docs/stocks
 */

const BASE = "https://api.polygon.io";
const API_KEY = process.env.POLYGON_API_KEY!;

async function polygonFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", API_KEY);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Polygon API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PolygonSnapshot {
  ticker: string;
  day: {
    o: number; h: number; l: number; c: number; v: number; vw: number;
  };
  prevDay: {
    o: number; h: number; l: number; c: number; v: number; vw: number;
  };
  min: {
    o: number; h: number; l: number; c: number; v: number; vw: number;
  };
  todaysChange: number;
  todaysChangePerc: number;
  updated: number;
}

export interface PolygonBar {
  o: number; h: number; l: number; c: number; v: number; vw: number; t: number; n: number;
}

export interface PolygonTickerDetail {
  ticker: string;
  name: string;
  market_cap: number;
  sic_description: string;
  primary_exchange: string;
  type: string;
  weighted_shares_outstanding: number;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * Get current snapshot for a single ticker.
 */
export async function getSnapshot(symbol: string): Promise<PolygonSnapshot> {
  const data = await polygonFetch<{ ticker: PolygonSnapshot }>(
    `/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`
  );
  return data.ticker;
}

/**
 * Get snapshots for multiple tickers at once.
 */
export async function getSnapshots(symbols: string[]): Promise<PolygonSnapshot[]> {
  const data = await polygonFetch<{ tickers: PolygonSnapshot[] }>(
    `/v2/snapshot/locale/us/markets/stocks/tickers`,
    { tickers: symbols.join(",") }
  );
  return data.tickers ?? [];
}

/**
 * Get OHLCV bars (aggregates) for charting.
 * @param timespan - "minute" | "hour" | "day" | "week" | "month"
 */
export async function getAggregates(
  symbol: string,
  multiplier: number,
  timespan: string,
  from: string,  // YYYY-MM-DD
  to: string
): Promise<PolygonBar[]> {
  const data = await polygonFetch<{ results: PolygonBar[] }>(
    `/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`,
    { adjusted: "true", sort: "asc", limit: "5000" }
  );
  return data.results ?? [];
}

/**
 * Get daily bars for the last N days.
 */
export async function getDailyBars(symbol: string, days: number = 365): Promise<PolygonBar[]> {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  return getAggregates(symbol, 1, "day", from, to);
}

/**
 * Get ticker details (company info, market cap, etc.)
 */
export async function getTickerDetails(symbol: string): Promise<PolygonTickerDetail> {
  const data = await polygonFetch<{ results: PolygonTickerDetail }>(
    `/v3/reference/tickers/${symbol}`
  );
  return data.results;
}

/**
 * Get RSI for a ticker.
 */
export async function getRSI(
  symbol: string,
  window: number = 14,
  timespan: string = "day"
): Promise<number | null> {
  try {
    const data = await polygonFetch<{ results: { values: { value: number }[] } }>(
      `/v1/indicators/rsi/${symbol}`,
      { timespan, window: String(window), series_type: "close", limit: "1" }
    );
    return data.results?.values?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Get SMA for a ticker.
 */
export async function getSMA(
  symbol: string,
  window: number,
  timespan: string = "day"
): Promise<number | null> {
  try {
    const data = await polygonFetch<{ results: { values: { value: number }[] } }>(
      `/v1/indicators/sma/${symbol}`,
      { timespan, window: String(window), series_type: "close", limit: "1" }
    );
    return data.results?.values?.[0]?.value ?? null;
  } catch {
    return null;
  }
}
