"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getChangeColor } from "@/lib/utils";

const TIMELINES = [
  { value: "1w", label: "1 Week" },
  { value: "2w", label: "2 Weeks" },
  { value: "1m", label: "1 Month" },
] as const;

const CONFIDENCE_STYLE: Record<string, string> = {
  high:   "bg-bullish/15 text-bullish",
  medium: "bg-neutral/15 text-neutral",
  low:    "bg-[hsl(var(--muted-foreground))]/15 text-[hsl(var(--muted-foreground))]",
};

function daysUntil(dateStr: string) {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));
}

function timelineLabel(t: string) {
  return { "1w": "1 WEEK", "2w": "2 WEEKS", "1m": "1 MONTH" }[t] ?? t.toUpperCase();
}

function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Lifetime Record Banner ────────────────────────────────────────────────────

function LifetimeRecord({ record }: { record: any }) {
  if (record.totalPicks === 0) return null;
  const winRate = Math.round((record.wins / record.totalPicks) * 100);
  return (
    <div className="card-interactive grid grid-cols-4 gap-2 text-center mb-5">
      <div>
        <div className="text-lg font-mono font-extrabold">{record.totalSessions}</div>
        <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Sessions</div>
      </div>
      <div>
        <div className={`text-lg font-mono font-extrabold`}>
          {record.wins}W / {record.totalPicks - record.wins}L
        </div>
        <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Record</div>
      </div>
      <div>
        <div className={`text-lg font-mono font-extrabold ${getChangeColor(record.avgReturn)}`}>
          {record.avgReturn >= 0 ? "+" : ""}{Number(record.avgReturn).toFixed(2)}%
        </div>
        <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Avg Return</div>
      </div>
      <div>
        <div className={`text-lg font-mono font-extrabold ${winRate >= 50 ? "text-bullish" : "text-bearish"}`}>
          {winRate}%
        </div>
        <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Win Rate</div>
      </div>
      {record.bestPick && (
        <div className="col-span-4 border-t border-[hsl(var(--border))] pt-2 mt-1">
          <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            Best pick: <span className="font-bold text-bullish">{record.bestPick.symbol} +{Number(record.bestPick.resolved_pct).toFixed(2)}%</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main board ────────────────────────────────────────────────────────────────

export function PicksBoard({
  sessions,
  currentPrices,
  lifetimeRecord,
}: {
  sessions: any[];
  currentPrices: Record<string, number>;
  lifetimeRecord: any;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [timeline, setTimeline] = useState<"1w" | "2w" | "1m">("1w");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Auto-refresh every hour so P&L stays current without manual reloads
  useEffect(() => {
    setLastUpdated(new Date());
    const id = setInterval(() => {
      router.refresh();
      setLastUpdated(new Date());
    }, 60 * 60 * 1000); // 1 hour
    return () => clearInterval(id);
  }, [router]);

  const activeSessions = sessions.filter((s) => !s.is_resolved);
  const resolvedSessions = sessions.filter((s) => s.is_resolved);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/picks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed to generate picks");
      else router.refresh();
    } catch {
      setError("Network error — check your connection");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Lifetime record */}
      <LifetimeRecord record={lifetimeRecord} />

      {/* Auto-refresh status */}
      {lastUpdated && (
        <p suppressHydrationWarning className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] text-right -mb-3">
          Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · auto-refreshes hourly
        </p>
      )}

      {/* Generate panel */}
      <div className="card-interactive space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Timeline
          </span>
          <div className="flex gap-1 ml-auto">
            {TIMELINES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTimeline(t.value)}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider rounded-md border transition-colors ${
                  timeline === t.value
                    ? "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                {t.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full py-3 bg-[hsl(var(--accent))] text-white text-xs font-mono font-bold tracking-wider rounded-lg disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ASKING CLAUDE...
            </>
          ) : (
            "◆ GENERATE NEW PICKS"
          )}
        </button>

        {error && <p className="text-xs text-bearish font-mono text-center">{error}</p>}
      </div>

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <section>
          <h2 className="section-label">◆ ACTIVE PICKS</h2>
          <div className="space-y-4">
            {activeSessions.map((s) => (
              <ActiveSession key={s.id} session={s} currentPrices={currentPrices} />
            ))}
          </div>
        </section>
      )}

      {/* Resolved sessions */}
      {resolvedSessions.length > 0 && (
        <section>
          <h2 className="section-label">◆ PAST PICKS</h2>
          <div className="space-y-3">
            {resolvedSessions.map((s) => (
              <ResolvedSession key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}

      {sessions.length === 0 && (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🤖</p>
          <p className="text-sm font-mono text-[hsl(var(--muted-foreground))]">
            No picks yet. Generate your first AI pick session above.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Active session card ───────────────────────────────────────────────────────

function ActiveSession({ session, currentPrices }: { session: any; currentPrices: Record<string, number> }) {
  const [expanded, setExpanded] = useState(true);
  const picks: any[] = session.ai_picks ?? [];
  const daysLeft = daysUntil(session.resolve_date);

  const enriched = picks.map((p) => {
    const current = currentPrices[p.symbol];
    const pct = current ? ((current - p.price_at_pick) / p.price_at_pick) * 100 : null;
    return { ...p, currentPrice: current, pct };
  });

  const withPnl = enriched.filter((p) => p.pct !== null);
  const avgPct = withPnl.length ? withPnl.reduce((a, p) => a + p.pct!, 0) / withPnl.length : 0;
  const winners = withPnl.filter((p) => p.pct! > 0).length;

  return (
    <div className="card-interactive">
      {/* Header */}
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[hsl(var(--accent))]">
              {timelineLabel(session.timeline)}
            </span>
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
              Started {shortDate(session.pick_date)}
            </span>
          </div>
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] mt-0.5">
            {daysLeft === 0 ? "Resolving on next page load..." : `${daysLeft}d remaining`} · {winners}/{picks.length} profitable
          </p>
        </div>
        <div className="text-right">
          <div className={`text-xl font-mono font-extrabold ${getChangeColor(avgPct)}`}>
            {avgPct >= 0 ? "+" : ""}{avgPct.toFixed(2)}%
          </div>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">avg P&L</p>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] space-y-4">
          {session.overall_thesis && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] italic leading-relaxed">
              &ldquo;{session.overall_thesis}&rdquo;
            </p>
          )}

          {enriched.map((pick) => (
            <PickCard key={pick.id} pick={pick} mode="active" />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Resolved session card ─────────────────────────────────────────────────────

function ResolvedSession({ session }: { session: any }) {
  const [expanded, setExpanded] = useState(false);
  const picks: any[] = session.ai_picks ?? [];
  const wins = session.win_count ?? 0;
  const total = session.total_picks ?? picks.length;
  const avg = Number(session.avg_return_pct ?? 0);

  return (
    <div className="card-interactive">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[hsl(var(--muted-foreground))]">
              {timelineLabel(session.timeline)}
            </span>
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
              {shortDate(session.pick_date)} → {shortDate(session.resolve_date)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] font-mono">
              <span className="text-bullish font-bold">{wins}W</span>
              {" / "}
              <span className="text-bearish font-bold">{total - wins}L</span>
            </span>
            <span className={`text-[10px] font-mono font-bold ${getChangeColor(avg)}`}>
              {avg >= 0 ? "+" : ""}{avg.toFixed(2)}% avg
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < wins ? "bg-bullish" : "bg-bearish"}`} />
          ))}
          <svg className={`ml-1 text-[hsl(var(--muted-foreground))] transition-transform ${expanded ? "rotate-180" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] space-y-4">
          {session.overall_thesis && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] italic leading-relaxed">
              &ldquo;{session.overall_thesis}&rdquo;
            </p>
          )}
          {picks.map((pick) => (
            <PickCard key={pick.id} pick={pick} mode="resolved" />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single pick card ──────────────────────────────────────────────────────────

function PickCard({ pick, mode }: { pick: any; mode: "active" | "resolved" }) {
  const bullets: string[] = Array.isArray(pick.bull_points) ? pick.bull_points : [];
  const confidence: string = pick.confidence ?? "medium";
  const pct = mode === "active" ? pick.pct : pick.resolved_pct;
  const isWinner = mode === "active" ? (pick.pct ?? 0) > 0 : pick.is_winner;

  return (
    <div className="space-y-2">
      {/* Symbol row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {mode === "resolved" && (
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${isWinner ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"}`}>
              {isWinner ? "✓" : "✗"}
            </div>
          )}
          <a
            href={`/stocks/${pick.symbol}`}
            className="font-mono font-extrabold text-sm hover:text-[hsl(var(--accent))] transition-colors"
          >
            {pick.symbol}
          </a>
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${CONFIDENCE_STYLE[confidence] ?? CONFIDENCE_STYLE.medium}`}>
            {confidence}
          </span>
          <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            {mode === "active"
              ? `entry $${Number(pick.price_at_pick).toFixed(2)}${pick.currentPrice ? ` → $${Number(pick.currentPrice).toFixed(2)}` : ""}`
              : `$${Number(pick.price_at_pick).toFixed(2)} → $${Number(pick.resolved_price ?? 0).toFixed(2)}`}
          </span>
        </div>
        <div className="shrink-0">
          {pct !== null && pct !== undefined ? (
            <span className={`font-mono font-bold text-sm ${getChangeColor(pct)}`}>
              {pct >= 0 ? "+" : ""}{Number(pct).toFixed(2)}%
            </span>
          ) : (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">—</span>
          )}
        </div>
      </div>

      {/* Bull points */}
      {bullets.length > 0 && (
        <ul className="space-y-1 pl-1">
          {bullets.map((pt, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] leading-snug">
              <span className="text-bullish mt-px shrink-0">›</span>
              {pt}
            </li>
          ))}
        </ul>
      )}

      {/* Key risk */}
      {pick.key_risk && (
        <div className="flex items-start gap-1.5 text-[11px] leading-snug">
          <span className="text-bearish shrink-0 mt-px">⚠</span>
          <span className="text-[hsl(var(--muted-foreground))]">{pick.key_risk}</span>
        </div>
      )}
    </div>
  );
}
