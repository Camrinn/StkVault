import { getDashboardData } from "@/lib/db/queries";
import { createServiceClient } from "@/lib/db/supabase";
import { StockMiniCard } from "@/components/stocks/stock-mini-card";
import { AlertCard } from "@/components/dashboard/alert-card";
import { EarningsRow } from "@/components/dashboard/earnings-row";
import { formatPercent, timeAgo } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

async function getLeaderboard() {
  const db = createServiceClient();
  const { data: all } = await db
    .from("predictions")
    .select("player_name, was_correct, return_pct, created_at");

  const playerStats: Record<string, { resolved: number; correct: number; returnSum: number }> = {};
  for (const p of all ?? []) {
    if (!playerStats[p.player_name]) playerStats[p.player_name] = { resolved: 0, correct: 0, returnSum: 0 };
    const s = playerStats[p.player_name];
    if (p.was_correct !== null) {
      s.resolved++;
      if (p.was_correct) { s.correct++; s.returnSum += p.return_pct ?? 0; }
    }
  }

  return Object.entries(playerStats)
    .filter(([, s]) => s.resolved >= 3)
    .map(([name, s]) => ({
      player_name: name,
      resolved: s.resolved,
      correct: s.correct,
      win_rate: s.correct / s.resolved,
      avg_return: s.correct > 0 ? s.returnSum / s.correct : 0,
    }))
    .sort((a, b) => b.win_rate - a.win_rate || b.avg_return - a.avg_return)
    .slice(0, 5);
}

export async function DashboardContent() {
  const [data, leaderboard] = await Promise.all([getDashboardData(), getLeaderboard()]);

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

      {/* ─── Leaderboard ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-label">◆ LEADERBOARD</h2>
          <a href="/predictions" className="text-[10px] font-mono text-[hsl(var(--accent))] hover:underline">
            See all →
          </a>
        </div>
        {leaderboard.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-5 text-center">
            <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))]">
              No ranked players yet — make 3+ calls to get on the board
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const winPct = (entry.win_rate * 100).toFixed(0);
              const medal = i < 3 ? MEDALS[i] : `#${i + 1}`;
              return (
                <div key={entry.player_name} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-lg w-7 shrink-0 text-center">{medal}</span>
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-sm truncate">{entry.player_name}</p>
                        <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                          {entry.correct}/{entry.resolved} correct
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono font-bold text-sm ${Number(winPct) >= 60 ? "text-emerald-400" : Number(winPct) >= 45 ? "text-amber-400" : "text-red-400"}`}>
                        {winPct}% W
                      </p>
                      <p className={`text-[10px] font-mono ${entry.avg_return >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {entry.avg_return >= 0 ? "+" : ""}{entry.avg_return.toFixed(1)}% avg
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-[hsl(var(--border))] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${Number(winPct) >= 60 ? "bg-emerald-500" : Number(winPct) >= 45 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${winPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
