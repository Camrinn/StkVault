import { getDashboardData } from "@/lib/db/queries";
import { StockMiniCard } from "@/components/stocks/stock-mini-card";
import { AlertCard } from "@/components/dashboard/alert-card";
import { EarningsRow } from "@/components/dashboard/earnings-row";
import { formatPercent, timeAgo } from "@/lib/utils";

export async function DashboardContent() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6 pb-4">
      {/* Last refresh */}
      {data.last_refresh && (
        <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))]">
          Last refresh: {timeAgo(data.last_refresh)}
        </p>
      )}

      {/* ─── Alerts ──────────────────────────────────────── */}
      {data.recent_alerts.length > 0 && (
        <section>
          <h2 className="section-label">◆ ACTIVE ALERTS</h2>
          <div className="space-y-2">
            {data.recent_alerts.slice(0, 4).map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Top Movers ──────────────────────────────────── */}
      <section>
        <h2 className="section-label">◆ TOP MOVERS TODAY</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
          {data.top_movers.map((stock) => (
            <StockMiniCard key={stock.symbol} stock={stock} className="snap-start" />
          ))}
        </div>
      </section>

      {/* ─── Best Setups ─────────────────────────────────── */}
      {data.best_setups.length > 0 && (
        <section>
          <h2 className="section-label">◆ STRONGEST SETUPS</h2>
          <div className="space-y-2">
            {data.best_setups.map((stock) => (
              <a
                key={stock.symbol}
                href={`/stocks/${stock.symbol}`}
                className="card-interactive flex items-center justify-between"
              >
                <div>
                  <span className="font-mono font-bold text-sm">{stock.symbol}</span>
                  <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {stock.company_name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-bold ${stock.change_1d >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {formatPercent(stock.change_1d)}
                  </span>
                  <span className="score-pill bg-emerald-500/15 border-emerald-500/30 text-emerald-400">
                    {Math.round(stock.total_score)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ─── Upcoming Earnings ───────────────────────────── */}
      {data.upcoming_earnings.length > 0 && (
        <section>
          <h2 className="section-label">◆ UPCOMING EARNINGS</h2>
          <div className="card-interactive space-y-0 p-0 overflow-hidden">
            {data.upcoming_earnings.slice(0, 6).map((e, i) => (
              <EarningsRow key={e.id} event={e} isLast={i === Math.min(5, data.upcoming_earnings.length - 1)} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Strongest Trends ────────────────────────────── */}
      <section>
        <h2 className="section-label">◆ TREND LEADERS</h2>
        <div className="grid grid-cols-2 gap-2">
          {data.strongest_trends.slice(0, 4).map((stock) => (
            <a
              key={stock.symbol}
              href={`/stocks/${stock.symbol}`}
              className="card-interactive"
            >
              <div className="font-mono font-bold text-sm">{stock.symbol}</div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2 truncate">
                {stock.sector}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono font-bold text-lg">
                  ${stock.price.toFixed(2)}
                </span>
                <span className={`text-xs font-mono font-bold ${stock.change_1m >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {formatPercent(stock.change_1m, 1)} 1M
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
