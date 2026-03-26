import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { getPeerComparisons, getSymbolByTicker } from "@/lib/db/queries";
import { createServiceClient } from "@/lib/db/supabase";

export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireAuth();
    const { symbol } = await params;

    const [peers, info] = await Promise.all([
      getPeerComparisons(symbol),
      getSymbolByTicker(symbol),
    ]);

    let benchmark = null;
    if (info?.industry) {
      const db = createServiceClient();
      const { data } = await db
        .from("industry_benchmarks")
        .select("*")
        .eq("industry", info.industry)
        .order("as_of_date", { ascending: false })
        .limit(1)
        .single();
      benchmark = data;
    }

    return NextResponse.json({ peers, benchmark, industry: info?.industry, sector: info?.sector });
  }
);
