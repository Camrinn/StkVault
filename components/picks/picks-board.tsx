"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPercent, getChangeColor } from "@/lib/utils";

const TIMELINES = [
  { value: "1w", label: "1 Week" },
  { value: "2w", label: "2 Weeks" },
  { value: "1m", label: "1 Month" },
] as const;

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function timelineLabel(t: string) {
  return { "1w": "1 WEEK", "2w": "2 WEEKS", "1m": "1 MONTH" }[t] ?? t.toUpperCase();
}

export function PicksBoard({
  sessions,
  currentPrices,
}: {
  sessions: any[];
  currentPrices: Record<string, number>;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [timeline, setTimeline] = useState<"1w" | "2w" | "1m">("1w");

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
      if (!res.ok) {
        setError(data.error ?? "Failed to generate picks");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Generate panel */}
      <div className="card-interactive space-y-3">
        <div className="flex items-center gap-2 mb-1">
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

        {error && (
          <p className="text-xs text-bearish font-mono text-center">{error}</p>
        )}

        <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center font-mono">
          Requires ANTHROPIC_API_KEY in Vercel env vars
        </p>
      </div>

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <section>
          <h2 className="section-label">◆ ACTIVE PICKS</h2>
          <div className="space-y-4">
            {activeSessions.map((session) => (
              <ActiveSessionCard
                key={session.id}
                session={session}
                currentPrices={currentPrices}
              />
            ))}
          </div>
        </section>
      )}

      {/* Past sessions */}
      {resolvedSessions.length > 0 && (
        <section>
          <h2 className="section-label">◆ PAST PICKS</h2>
          <div className="space-y-3">
            {resolvedSessions.map((session) => (
              <ResolvedSessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}

      {sessions.length === 0 && (
        <div className="text-center py-16">
          <p className="text-2xl mb-2">🤖</p>
          <p className="text-sm font-mono text-[hsl(var(--muted-foreground))]">
            No picks yet. Generate your first AI pick session above.
          </p>
        </div>
      )}
    </div>
  );
}

function ActiveSessionCard({
  session,
  currentPrices,
}: {
  session: any;
  currentPrices: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(true);
  const picks: any[] = session.ai_picks ?? [];
  const daysLeft = daysUntil(session.resolve_date);

  const picksWithPnl = picks.map((p) => {
    const current = currentPrices[p.symbol];
    const pct = current ? ((current - p.price_at_pick) / p.price_at_pick) * 100 : null;
    return { ...p, currentPrice: current, pct };
  });

  const avgPct =
    picksWithPnl.filter((p) => p.pct !== null).reduce((a, p) => a + p.pct!, 0) /
    (picksWithPnl.filter((p) => p.pct !== null).length || 1);

  const winners = picksWithPnl.filter((p) => (p.pct ?? 0) > 0).length;

  return (
    <div className="card-interactive">
      {/* Session header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[hsl(var(--accent))]">
              {timelineLabel(session.timeline)}
            </span>
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
              {new Date(session.pick_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] mt-0.5">
            {daysLeft === 0 ? "Resolving..." : `${daysLeft}d remaining`} ·{" "}
            {winners}/{picks.length} up
          </p>
        </div>
        <div className="text-right">
          <div className={`text-base font-mono font-extrabold ${getChangeColor(avgPct)}`}>
            {avgPct >= 0 ? "+" : ""}{avgPct.toFixed(2)}%
          </div>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">avg return</p>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[hsl(var(--border))] pt-3">
          {session.overall_thesis && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] italic mb-3 leading-relaxed">
              &ldquo;{session.overall_thesis}&rdquo;
            </p>
          )}
          {picksWithPnl.map((pick) => (
            <div key={pick.id} className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={`/stocks/${pick.symbol}`}
                    className="font-mono font-extrabold text-sm hover:text-[hsl(var(--accent))] transition-colors"
                  >
                    {pick.symbol}
                  </a>
                  <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                    entry ${Number(pick.price_at_pick).toFixed(2)}
                  </span>
                  {pick.currentPrice && (
                    <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                      → ${Number(pick.currentPrice).toFixed(2)}
                    </span>
                  )}
                </div>
                {pick.reasoning && (
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-snug mt-0.5">
                    {pick.reasoning}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                {pick.pct !== null ? (
                  <span className={`font-mono font-bold text-sm ${getChangeColor(pick.pct)}`}>
                    {pick.pct >= 0 ? "+" : ""}{pick.pct.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResolvedSessionCard({ session }: { session: any }) {
  const [expanded, setExpanded] = useState(false);
  const picks: any[] = session.ai_picks ?? [];
  const wins = session.win_count ?? 0;
  const total = session.total_picks ?? picks.length;
  const avg = session.avg_return_pct ?? 0;

  return (
    <div className="card-interactive">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[hsl(var(--muted-foreground))]">
              {timelineLabel(session.timeline)}
            </span>
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
              {new Date(session.pick_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" → "}
              {new Date(session.resolve_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] font-mono">
              <span className="text-bullish font-bold">{wins}W</span>
              {" / "}
              <span className="text-bearish font-bold">{total - wins}L</span>
            </span>
            <span className={`text-[10px] font-mono font-bold ${getChangeColor(avg)}`}>
              {avg >= 0 ? "+" : ""}{Number(avg).toFixed(2)}% avg
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i < wins ? "bg-bullish" : "bg-bearish"}`}
            />
          ))}
          <svg
            className={`ml-1 text-[hsl(var(--muted-foreground))] transition-transform ${expanded ? "rotate-180" : ""}`}
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[hsl(var(--border))] pt-3">
          {session.overall_thesis && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] italic mb-3 leading-relaxed">
              &ldquo;{session.overall_thesis}&rdquo;
            </p>
          )}
          {picks.map((pick) => (
            <div key={pick.id} className="flex items-start gap-3">
              <div
                className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  pick.is_winner ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"
                }`}
              >
                {pick.is_winner ? "✓" : "✗"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={`/stocks/${pick.symbol}`}
                    className="font-mono font-extrabold text-sm hover:text-[hsl(var(--accent))] transition-colors"
                  >
                    {pick.symbol}
                  </a>
                  <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                    ${Number(pick.price_at_pick).toFixed(2)} → ${Number(pick.resolved_price ?? 0).toFixed(2)}
                  </span>
                </div>
                {pick.reasoning && (
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-snug mt-0.5">
                    {pick.reasoning}
                  </p>
                )}
              </div>
              <span className={`shrink-0 font-mono font-bold text-sm ${getChangeColor(pick.resolved_pct ?? 0)}`}>
                {(pick.resolved_pct ?? 0) >= 0 ? "+" : ""}{Number(pick.resolved_pct ?? 0).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
