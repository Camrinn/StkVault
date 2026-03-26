import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { getLatestFinancials, getPeerComparisons } from "@/lib/db/queries";
import { createServiceClient } from "@/lib/db/supabase";

export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireAuth();
    const { symbol } = await params;

    const [financials, peers] = await Promise.all([
      getLatestFinancials(symbol),
      getPeerComparisons(symbol),
    ]);

    // Get symbol info for industry benchmark
    const db = createServiceClient();
    const { data: info } = await db
      .from("tracked_symbols")
      .select("industry")
      .eq("symbol", symbol)
      .single();

    let benchmark = null;
    if (info?.industry) {
      const { data } = await db
        .from("industry_benchmarks")
        .select("*")
        .eq("industry", info.industry)
        .order("as_of_date", { ascending: false })
        .limit(1)
        .single();
      benchmark = data;
    }

    return NextResponse.json({ financials, peers, benchmark });
  }
);
