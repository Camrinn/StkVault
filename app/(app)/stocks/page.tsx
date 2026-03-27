export const dynamic = "force-dynamic";

import { getActiveSymbols, getLatestSnapshot, getLatestEntryZone } from "@/lib/db/queries";
import { formatCurrency, formatPercent, formatNumber, getChangeColor, getScoreColor, getScoreBg, getZoneColor } from "@/lib/utils";
import type { StockCardData } from "@/types";

export default async function StocksPage() {
  const symbols = await getActiveSymbols();

  const stocks: (StockCardData & { zone: string })[] = [];
  for (const sym of symbols) {
    const [snap, ez] = await Promise.all([
      getLatestSnapshot(sym.symbol),
      getLatestEntryZone(sym.symbol),
    ]);
    if (snap) {
      stocks.push({
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
        zone: ez?.current_zone ?? "fair",
      });
    }
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="text-lg font-mono font-extrabold tracking-wider mb-1">TRACKED STOCKS</h1>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-5">
        {stocks.length} stocks in active universe
      </p>

      <div className="space-y-3">
        {stocks.map((stock) => (
          <a
            key={stock.symbol}
            href={`/stocks/${stock.symbol}`}
            className="card-interactive block"
          >
            {/* Row 1: Ticker, Name, Score */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-base">{stock.symbol}</span>
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${getZoneColor(stock.zone)}`}>
                    {stock.zone.replace("_", " ")}
                  </span>
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {stock.company_name} · {stock.sector}
                </div>
              </div>
              <div className={`score-pill ${getScoreBg(stock.total_score)} ${getScoreColor(stock.total_score)}`}>
                {Math.round(stock.total_score)}
              </div>
            </div>

            {/* Row 2: Price and returns */}
            <div className="flex items-baseline justify-between">
              <span className="font-mono font-bold text-xl">
                {formatCurrency(stock.price)}
              </span>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className={getChangeColor(stock.change_1d)}>
                  1D {formatPercent(stock.change_1d, 1)}
                </span>
                <span className={getChangeColor(stock.change_1w)}>
                  1W {formatPercent(stock.change_1w, 1)}
                </span>
                <span className={getChangeColor(stock.change_1m)}>
                  1M {formatPercent(stock.change_1m, 1)}
                </span>
              </div>
            </div>

            {/* Row 3: Meta */}
            <div className="flex items-center gap-4 mt-2 text-[10px] text-[hsl(var(--muted-foreground))] font-mono">
              <span>MCap {formatNumber(stock.market_cap, true)}</span>
              <span>Vol {formatNumber(stock.volume, true)}</span>
              <span>
                52W {formatPercent(((stock.price - stock.fifty_two_week_low) / (stock.fifty_two_week_high - stock.fifty_two_week_low || 1)) * 100 - 50, 0)}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
