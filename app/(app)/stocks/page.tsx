export const dynamic = "force-dynamic";

import { getActiveSymbols, getLatestSnapshot, getLatestEntryZone } from "@/lib/db/queries";
import { StocksList } from "@/components/stocks/stocks-list";

export default async function StocksPage() {
  const symbols = await getActiveSymbols();

  const stocks = (
    await Promise.all(
      symbols.map(async (sym) => {
        const [snap, ez] = await Promise.all([
          getLatestSnapshot(sym.symbol),
          getLatestEntryZone(sym.symbol),
        ]);
        if (!snap) return null;
        return {
          symbol: sym.symbol,
          company_name: sym.company_name,
          sector: sym.sector,
          industry: sym.industry,
          price: snap.price,
          change_1d: snap.change_1d,
          change_1w: snap.change_1w,
          change_1m: snap.change_1m,
          total_score: snap.total_score,
          volume: snap.volume,
          market_cap: snap.market_cap,
          fifty_two_week_high: snap.fifty_two_week_high,
          fifty_two_week_low: snap.fifty_two_week_low,
          zone: ez?.current_zone ?? "fair",
        };
      })
    )
  ).filter(Boolean) as any[];

  return (
    <div className="px-4 pt-4">
      <h1 className="text-lg font-mono font-extrabold tracking-wider mb-1">TRACKED STOCKS</h1>
      <StocksList stocks={stocks} />
    </div>
  );
}
