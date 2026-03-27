import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import * as polygon from "@/lib/market-data/polygon";
import { cache, CacheKeys } from "@/lib/cache";

const RANGE_CONFIG: Record<string, {
  multiplier: number;
  timespan: string;
  lookback: number;
  intraday: boolean;
  cacheSecs: number;
}> = {
  "1d":  { multiplier: 5,  timespan: "minute", lookback: 3,   intraday: true,  cacheSecs: 120  },
  "5d":  { multiplier: 30, timespan: "minute", lookback: 10,  intraday: true,  cacheSecs: 300  },
  "1w":  { multiplier: 1,  timespan: "day",    lookback: 7,   intraday: false, cacheSecs: 300  },
  "1m":  { multiplier: 1,  timespan: "day",    lookback: 30,  intraday: false, cacheSecs: 1800 },
  "3m":  { multiplier: 1,  timespan: "day",    lookback: 90,  intraday: false, cacheSecs: 1800 },
  "6m":  { multiplier: 1,  timespan: "day",    lookback: 180, intraday: false, cacheSecs: 1800 },
  "1y":  { multiplier: 1,  timespan: "day",    lookback: 365, intraday: false, cacheSecs: 1800 },
};

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireAuth();
    const { symbol } = await params;
    const range = req.nextUrl.searchParams.get("range") ?? "3m";

    const cfg = RANGE_CONFIG[range] ?? RANGE_CONFIG["3m"];

    const data = await cache.getOrSet(
      CacheKeys.chart(symbol, range),
      async () => {
        const to = new Date().toISOString().split("T")[0];
        const from = new Date(Date.now() - cfg.lookback * 86400000).toISOString().split("T")[0];
        const bars = await polygon.getAggregates(symbol, cfg.multiplier, cfg.timespan, from, to);

        if (cfg.intraday) {
          let barsToUse = bars;
          // For 1d: keep only the most recent trading day
          if (range === "1d" && bars.length > 0) {
            const lastDay = new Date(bars[bars.length - 1].t).toISOString().split("T")[0];
            barsToUse = bars.filter((b) => new Date(b.t).toISOString().split("T")[0] === lastDay);
          }
          return barsToUse.map((b) => ({
            time: Math.floor(b.t / 1000), // Unix seconds for intraday
            open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
          }));
        }

        return bars.map((b) => ({
          time: new Date(b.t).toISOString().split("T")[0],
          open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
        }));
      },
      cfg.cacheSecs
    );

    return NextResponse.json(data);
  }
);
