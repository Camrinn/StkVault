/**
 * Price Refresh — lightweight cron hit via cron-job.org every 5 min.
 * Fetches real-time quotes from Finnhub and patches the latest snapshot.
 * Completes in ~1s (parallel fetch, no delays needed).
 *
 * Route: GET /api/cron/price-refresh
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import { getActiveSymbols } from "@/lib/db/queries";
import { getQuotes } from "@/lib/market-data/finnhub";
import { cache, CacheKeys } from "@/lib/cache";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  try {
    const symbols = await getActiveSymbols();
    if (symbols.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const tickers = symbols.map((s) => s.symbol);
    const quotes = await getQuotes(tickers);

    await Promise.all(
      quotes.map(async (q) => {
        // Find the most recent snapshot row for this symbol
        const { data: latest } = await db
          .from("symbol_snapshots")
          .select("id")
          .eq("symbol", q.symbol)
          .order("snapshot_time", { ascending: false })
          .limit(1)
          .single();

        if (!latest?.id) return;

        // Patch price and change on that row
        await db
          .from("symbol_snapshots")
          .update({
            price: q.price,
            change_1d: q.change_pct,
            snapshot_time: new Date().toISOString(),
          })
          .eq("id", latest.id);

        await cache.del(CacheKeys.stockSnapshot(q.symbol));
        await cache.del(CacheKeys.stockDetail(q.symbol));
      })
    );

    await cache.del(CacheKeys.dashboard());

    return NextResponse.json({ ok: true, updated: quotes.length });
  } catch (err: any) {
    console.error("Price refresh failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
