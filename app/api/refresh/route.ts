import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase";
import { getActiveSymbols } from "@/lib/db/queries";
import { getQuotes } from "@/lib/market-data/finnhub";
import { cache, CacheKeys } from "@/lib/cache";

const AUTH_TOKEN = "stkvault_ok";

export async function GET(request: NextRequest) {
  if (request.cookies.get("sv_auth")?.value !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  try {
    const symbols = await getActiveSymbols();
    const quotes = await getQuotes(symbols.map((s) => s.symbol));

    await Promise.all(
      quotes.map(async (q) => {
        const { data: latest } = await db
          .from("symbol_snapshots")
          .select("id")
          .eq("symbol", q.symbol)
          .order("snapshot_time", { ascending: false })
          .limit(1)
          .single();

        if (!latest?.id) return;

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
