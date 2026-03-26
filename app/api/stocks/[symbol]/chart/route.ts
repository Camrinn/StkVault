import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import * as polygon from "@/lib/market-data/polygon";
import { cache, CacheKeys } from "@/lib/cache";

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireAuth();
    const { symbol } = await params;
    const range = req.nextUrl.searchParams.get("range") ?? "3m";

    const daysMap: Record<string, number> = {
      "1w": 7, "1m": 30, "3m": 90, "6m": 180, "1y": 365, "2y": 730,
    };
    const days = daysMap[range] ?? 90;

    const data = await cache.getOrSet(
      CacheKeys.chart(symbol, range),
      async () => {
        const bars = await polygon.getDailyBars(symbol, days);
        return bars.map((b) => ({
          time: new Date(b.t).toISOString().split("T")[0],
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
          volume: b.v,
        }));
      },
      range === "1w" ? 300 : 1800
    );

    return NextResponse.json(data);
  }
);
