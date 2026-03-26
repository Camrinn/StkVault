import { NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { getActiveSymbols, getLatestSnapshot, getLatestEntryZone } from "@/lib/db/queries";
import type { StockCardData } from "@/types";

export const GET = withErrorHandler(async () => {
  await requireAuth();

  const symbols = await getActiveSymbols();
  const cards: StockCardData[] = [];

  for (const sym of symbols) {
    const [snap, ez] = await Promise.all([
      getLatestSnapshot(sym.symbol),
      getLatestEntryZone(sym.symbol),
    ]);

    if (snap) {
      cards.push({
        symbol: sym.symbol,
        company_name: sym.company_name,
        sector: sym.sector,
        industry: sym.industry,
        price: snap.price,
        change_1d: snap.change_1d,
        change_1w: snap.change_1w,
        change_1m: snap.change_1m,
        change_3m: snap.change_3m,
        change_1y: snap.change_1y,
        volume: snap.volume,
        avg_volume: snap.avg_volume,
        market_cap: snap.market_cap,
        fifty_two_week_high: snap.fifty_two_week_high,
        fifty_two_week_low: snap.fifty_two_week_low,
        total_score: snap.total_score,
        trend_score: snap.trend_score,
        current_zone: ez?.current_zone ?? "fair",
        risk_label: ez?.risk_label ?? "moderate",
        next_earnings_date: null,
        latest_alert: null,
      });
    }
  }

  return NextResponse.json(cards);
});
