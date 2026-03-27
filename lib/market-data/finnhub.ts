/**
 * Finnhub market data — real-time stock quotes.
 * Free tier: 60 API calls/minute.
 */

const BASE = "https://finnhub.io/api/v1";

function getKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");
  return key;
}

export interface FinnhubQuote {
  symbol: string;
  price: number;       // current price
  change: number;      // absolute change
  change_pct: number;  // % change
  high: number;        // day high
  low: number;         // day low
  open: number;        // day open
  prev_close: number;  // previous close
}

export async function getQuote(symbol: string): Promise<FinnhubQuote> {
  const res = await fetch(
    `${BASE}/quote?symbol=${symbol}&token=${getKey()}`
  );

  if (!res.ok) throw new Error(`Finnhub quote failed for ${symbol}: ${res.status}`);

  const data = await res.json();

  if (!data.c || data.c === 0) {
    throw new Error(`No quote data for ${symbol}`);
  }

  return {
    symbol,
    price: data.c,
    change: data.d ?? 0,
    change_pct: data.dp ?? 0,
    high: data.h ?? data.c,
    low: data.l ?? data.c,
    open: data.o ?? data.c,
    prev_close: data.pc ?? data.c,
  };
}

export async function getQuotes(symbols: string[]): Promise<FinnhubQuote[]> {
  const results = await Promise.allSettled(symbols.map(getQuote));
  return results
    .filter((r): r is PromiseFulfilledResult<FinnhubQuote> => r.status === "fulfilled")
    .map((r) => r.value);
}
