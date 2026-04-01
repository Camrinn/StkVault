"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export interface LeaderboardEntry {
  player_name: string;
  total_calls: number;
  resolved_calls: number;
  correct_calls: number;
  win_rate: number;
  avg_return: number;
  ranked: boolean;
  last_active: string;
}

export interface PredictionRow {
  id: string;
  player_name: string;
  symbol: string;
  direction: "bull" | "bear";
  timeframe: string;
  price_at_call: number;
  target_date: string;
  resolved_at: string | null;
  price_at_resolve: number | null;
  was_correct: boolean | null;
  return_pct: number | null;
  created_at: string;
}

export interface SymbolOption {
  symbol: string;
  company_name: string;
}

interface Props {
  leaderboard: LeaderboardEntry[];
  predictions: PredictionRow[];
  currentPrices: Record<string, number>;
  symbols: SymbolOption[];
}

type Tab = "leaderboard" | "active" | "history";

export function PredictionsBoard({ leaderboard, predictions, currentPrices, symbols }: Props) {
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [showForm, setShowForm] = useState(false);

  const active  = predictions.filter((p) => p.was_correct === null);
  const history = predictions.filter((p) => p.was_correct !== null);

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[hsl(var(--border))]">
        {(
          [
            { id: "leaderboard", label: "BOARD" },
            { id: "active",      label: "ACTIVE", count: active.length },
            { id: "history",     label: "HISTORY", count: history.length },
          ] as { id: Tab; label: string; count?: number }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[10px] font-mono font-bold tracking-wider transition-colors ${
              tab === t.id
                ? "text-[hsl(var(--accent))] border-b-2 border-[hsl(var(--accent))] -mb-px"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {tab === "leaderboard" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            Ranked after 3+ resolved calls · sorted by win rate
          </p>
          {leaderboard.length === 0 ? (
            <Empty label="No predictions yet. Be the first to make a call." />
          ) : (
            leaderboard.map((entry, i) => (
              <LeaderboardCard key={entry.player_name} entry={entry} rank={i + 1} />
            ))
          )}
        </div>
      )}

      {/* Active */}
      {tab === "active" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            Open calls — updates with live prices
          </p>
          {active.length === 0 ? (
            <Empty label="No active calls. Hit + to make one." />
          ) : (
            active
              .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())
              .map((p) => (
                <ActiveCard key={p.id} pred={p} currentPrice={currentPrices[p.symbol]} />
              ))
          )}
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            Resolved calls — the receipts
          </p>
          {history.length === 0 ? (
            <Empty label="No resolved calls yet." />
          ) : (
            history.slice(0, 50).map((p) => <HistoryCard key={p.id} pred={p} />)
          )}
        </div>
      )}

      {/* Make a call FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-[hsl(var(--accent))] text-black font-bold text-2xl shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
      >
        +
      </button>

      {/* Call form modal */}
      {showForm && (
        <CallForm
          symbols={symbols}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// ─── Leaderboard Card ─────────────────────────────────────────────────────────

const MEDALS = ["🥇", "🥈", "🥉"];

function LeaderboardCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isRanked = entry.ranked;
  const medal = isRanked && rank <= 3 ? MEDALS[rank - 1] : null;
  const winPct = (entry.win_rate * 100).toFixed(0);
  const avgRet = entry.avg_return;
  const record = `${entry.correct_calls}/${entry.resolved_calls}`;

  return (
    <div
      className={`rounded-lg border bg-[hsl(var(--card))] p-3 ${
        isRanked ? "border-[hsl(var(--border))]" : "border-dashed border-[hsl(var(--border))]/50 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-lg w-7 shrink-0 text-center">
            {medal ?? (isRanked ? `#${rank}` : "—")}
          </span>
          <div className="min-w-0">
            <p className="font-mono font-bold text-sm truncate">{entry.player_name}</p>
            <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
              {record} correct · {entry.total_calls} total
              {!isRanked && <span className="ml-1 text-[hsl(var(--accent))]">({3 - entry.resolved_calls} more to rank)</span>}
            </p>
          </div>
        </div>
        {isRanked && (
          <div className="text-right shrink-0 space-y-0.5">
            <p className={`font-mono font-bold text-sm ${Number(winPct) >= 60 ? "text-emerald-400" : Number(winPct) >= 45 ? "text-amber-400" : "text-red-400"}`}>
              {winPct}% W
            </p>
            <p className={`text-[10px] font-mono ${avgRet >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {avgRet >= 0 ? "+" : ""}{avgRet.toFixed(1)}% avg
            </p>
          </div>
        )}
      </div>

      {/* Win-rate bar */}
      {isRanked && (
        <div className="mt-2 h-1 rounded-full bg-[hsl(var(--border))] overflow-hidden">
          <div
            className={`h-full rounded-full ${
              Number(winPct) >= 60 ? "bg-emerald-500" : Number(winPct) >= 45 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${winPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Active Card ──────────────────────────────────────────────────────────────

function ActiveCard({ pred, currentPrice }: { pred: PredictionRow; currentPrice?: number }) {
  const daysLeft = Math.ceil(
    (new Date(pred.target_date).getTime() - Date.now()) / 86_400_000
  );
  const pnl = currentPrice
    ? ((currentPrice - pred.price_at_call) / pred.price_at_call) * 100
    : null;
  const winning =
    pnl !== null ? (pred.direction === "bull" ? pnl > 0 : pnl < 0) : null;

  return (
    <div
      className={`rounded-lg border bg-[hsl(var(--card))] p-3 ${
        winning === true
          ? "border-emerald-500/40"
          : winning === false
          ? "border-red-500/40"
          : "border-[hsl(var(--border))]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono font-bold text-sm">{pred.symbol}</span>
            <DirectionBadge direction={pred.direction} />
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
              by {pred.player_name}
            </span>
          </div>
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            locked ${pred.price_at_call.toFixed(2)} · {pred.timeframe} ·{" "}
            <span className={daysLeft <= 3 ? "text-amber-400 font-bold" : ""}>
              {daysLeft}d left
            </span>
          </p>
        </div>
        <div className="text-right shrink-0">
          {pnl !== null ? (
            <>
              <p className={`font-mono font-bold text-sm ${winning ? "text-emerald-400" : "text-red-400"}`}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
              </p>
              <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
                ${currentPrice!.toFixed(2)} now
              </p>
            </>
          ) : (
            <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">—</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({ pred }: { pred: PredictionRow }) {
  const ret = pred.return_pct ?? 0;

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <span className="text-base">{pred.was_correct ? "✅" : "❌"}</span>
          <span className="font-mono font-bold text-sm">{pred.symbol}</span>
          <DirectionBadge direction={pred.direction} />
          <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] truncate">
            {pred.player_name}
          </span>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-mono font-bold text-sm ${ret >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {ret >= 0 ? "+" : ""}{ret.toFixed(1)}%
          </p>
          <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
            ${pred.price_at_call.toFixed(2)} → ${pred.price_at_resolve?.toFixed(2) ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Call Form (bottom sheet) ─────────────────────────────────────────────────

function CallForm({ symbols, onClose }: { symbols: SymbolOption[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState(symbols[0]?.symbol ?? "");
  const [direction, setDirection] = useState<"bull" | "bear">("bull");
  const [timeframe, setTimeframe] = useState<"1W" | "1M" | "3M">("1M");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  // Persist name in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("prediction_name");
    if (saved) setName(saved);
    else setTimeout(() => nameRef.current?.focus(), 100);
  }, []);

  async function submit() {
    if (!name.trim()) { setError("Enter your name"); return; }
    if (!symbol) { setError("Pick a stock"); return; }
    setError("");
    setSubmitting(true);
    try {
      localStorage.setItem("prediction_name", name.trim());
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_name: name.trim(), symbol, direction, timeframe }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const targetDate = (() => {
    const d = new Date();
    if (timeframe === "1W") d.setDate(d.getDate() + 7);
    else if (timeframe === "1M") d.setDate(d.getDate() + 30);
    else d.setDate(d.getDate() + 90);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  })();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 inset-x-0 bg-[hsl(var(--card))] border-t border-[hsl(var(--border))] rounded-t-2xl z-50 p-5 pb-10 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-mono font-extrabold text-base tracking-wider">MAKE YOUR CALL</h2>
          <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] text-xl leading-none">×</button>
        </div>

        {/* Name */}
        <div>
          <label className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] tracking-wider mb-1 block">YOUR NAME</label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Beast"
            maxLength={20}
            className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[hsl(var(--accent))]"
          />
        </div>

        {/* Stock */}
        <div>
          <label className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] tracking-wider mb-1 block">STOCK</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[hsl(var(--accent))]"
          >
            {symbols.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} — {s.company_name}
              </option>
            ))}
          </select>
        </div>

        {/* Direction */}
        <div>
          <label className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] tracking-wider mb-2 block">DIRECTION</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDirection("bull")}
              className={`py-3 rounded-lg font-mono font-bold text-sm transition-colors ${
                direction === "bull"
                  ? "bg-emerald-500 text-black"
                  : "bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
              }`}
            >
              🐂 BULL
            </button>
            <button
              onClick={() => setDirection("bear")}
              className={`py-3 rounded-lg font-mono font-bold text-sm transition-colors ${
                direction === "bear"
                  ? "bg-red-500 text-white"
                  : "bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
              }`}
            >
              🐻 BEAR
            </button>
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <label className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] tracking-wider mb-2 block">TIMEFRAME</label>
          <div className="grid grid-cols-3 gap-2">
            {(["1W", "1M", "3M"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`py-2.5 rounded-lg font-mono font-bold text-sm transition-colors ${
                  timeframe === tf
                    ? "bg-[hsl(var(--accent))] text-black"
                    : "bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] px-3 py-2 text-[11px] font-mono text-[hsl(var(--muted-foreground))]">
          {name.trim() || "You"} calling{" "}
          <span className="text-[hsl(var(--foreground))] font-bold">{symbol}</span>{" "}
          <span className={direction === "bull" ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
            {direction.toUpperCase()}
          </span>
          {" "}· resolves <span className="text-[hsl(var(--foreground))]">{targetDate}</span>
        </div>

        {error && (
          <p className="text-[11px] font-mono text-red-400">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-3.5 bg-[hsl(var(--accent))] text-black font-mono font-extrabold text-sm rounded-lg tracking-wider disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {submitting ? "LOCKING IN..." : "LOCK IT IN"}
        </button>
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DirectionBadge({ direction }: { direction: "bull" | "bear" }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider ${
        direction === "bull"
          ? "bg-emerald-500/20 text-emerald-400"
          : "bg-red-500/20 text-red-400"
      }`}
    >
      {direction === "bull" ? "🐂 BULL" : "🐻 BEAR"}
    </span>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-8 text-center">
      <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))]">{label}</p>
    </div>
  );
}
