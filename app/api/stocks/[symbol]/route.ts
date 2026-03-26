import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import {
  getSymbolByTicker,
  getLatestSnapshot,
  getLatestFinancials,
  getEarningsHistory,
  getLatestEntryZone,
  getPeerComparisons,
  getActiveAlerts,
  getNotesForSymbol,
} from "@/lib/db/queries";
import { createServiceClient } from "@/lib/db/supabase";
import { cache, CacheKeys } from "@/lib/cache";

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireAuth();
    const { symbol } = await params;

    const data = await cache.getOrSet(
      CacheKeys.stockDetail(symbol),
      async () => {
        const [info, snapshot, financials, earnings, entryZone, peers, alerts, notes] =
          await Promise.all([
            getSymbolByTicker(symbol),
            getLatestSnapshot(symbol),
            getLatestFinancials(symbol),
            getEarningsHistory(symbol),
            getLatestEntryZone(symbol),
            getPeerComparisons(symbol),
            getActiveAlerts(symbol),
            getNotesForSymbol(symbol),
          ]);

        if (!info) {
          return null;
        }

        // Get industry benchmark
        const db = createServiceClient();
        const { data: benchmark } = await db
          .from("industry_benchmarks")
          .select("*")
          .eq("industry", info.industry)
          .order("as_of_date", { ascending: false })
          .limit(1)
          .single();

        return {
          info,
          snapshot,
          financials,
          earnings,
          entry_zone: entryZone,
          peers,
          alerts,
          notes,
          industry_benchmark: benchmark,
        };
      },
      600 // 10 min cache
    );

    if (!data) {
      return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);
