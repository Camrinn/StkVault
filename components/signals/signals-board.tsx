"use client";

import { useState } from "react";

type PatternType = "bull_flag" | "breakout" | "cup_and_handle" | "golden_cross" | "death_cross";

export interface InsiderRow {
  id: string;
  symbol: string;
  company_name: string;
  insider_name: string;
  insider_title: string;
  shares: number;
  price_per_share: number;
  total_value: number;
  transaction_date: string;
  sec_link: string;
}

export interface AnalystRow {
  symbol: string;
  company_name: string;
  consensus: string;      // "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell"
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  totalAnalysts: number;
  lastMonthTarget: number | null;
  lastQuarterTarget: number | null;
  numberOfAnalysts: number | null;
}

export interface ShortSqueezeRow {
  symbol: string;
  company_name: string;
  short_float_pct: number;
  short_ratio: number;
  total_score: number;
  rs_vs_spy: number | null;
  current_zone: string;
}

export interface PatternRow {
  id: string;
  symbol: string;
  company_name: string;
  pattern_type: PatternType;
  confidence: number;
  price_at_detection: number;
  description: string;
  detected_at: string;
}

export interface EntrySignalRow {
  symbol: string;
  company_name: string;
  current_zone: string;
  risk_label: string;
  total_score: number;
  price: number;
  rs_vs_spy: number | null;
  aggressive_entry_low: number;
  aggressive_entry_high: number;
  patient_entry_low: number;
  patient_entry_high: number;
  summary: string;
}

interface Props {
  insiderBuys: InsiderRow[];
  analystActions: AnalystRow[];
  squeezeWatch: ShortSqueezeRow[];
  patterns: PatternRow[];
  entrySignals: EntrySignalRow[];
}

type Tab = "analyst" | "insider" | "squeeze" | "patterns" | "entry";

export function SignalsBoard({
  insiderBuys,
  analystActions,
  squeezeWatch,
  patterns,
  entrySignals,
}: Props) {
  const [tab, setTab] = useState<Tab>("analyst");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "analyst",  label: "ANALYST",  count: analystActions.length },
    { id: "insider",  label: "INSIDER",  count: insiderBuys.length },
    { id: "squeeze",  label: "SQUEEZE",  count: squeezeWatch.length },
    { id: "patterns", label: "PATTERNS", count: patterns.length },
    { id: "entry",    label: "ENTRY",    count: entrySignals.length },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[hsl(var(--border))] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 text-[10px] font-mono font-bold tracking-wider transition-colors ${
              tab === t.id
                ? "text-[hsl(var(--accent))] border-b-2 border-[hsl(var(--accent))] -mb-px"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Analyst Actions */}
      {tab === "analyst" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            Wall Street consensus — buy/hold/sell ratings &amp; price targets
          </p>
          {analystActions.length === 0 ? (
            <Empty label="No analyst consensus data available. Check FMP API key." />
          ) : (
            analystActions.map((row) => <AnalystCard key={row.symbol} row={row} />)
          )}
        </div>
      )}

      {/* Insider Buying */}
      {tab === "insider" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            SEC Form 4 purchases by officers &amp; directors — last 60 days
          </p>
          {insiderBuys.length === 0 ? (
            <Empty label="No insider purchases recorded yet. Run signals-refresh to populate." />
          ) : (
            insiderBuys.map((row) => <InsiderCard key={row.id} row={row} />)
          )}
        </div>
      )}

      {/* Short Squeeze Watch */}
      {tab === "squeeze" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            High short interest on strong-scoring stocks — potential squeeze setups
          </p>
          {squeezeWatch.length === 0 ? (
            <Empty label="No squeeze candidates at current thresholds." />
          ) : (
            squeezeWatch.map((row) => <SqueezeCard key={row.symbol} row={row} />)
          )}
        </div>
      )}

      {/* Chart Patterns */}
      {tab === "patterns" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            Breakouts · Bull flags · Cup &amp; handles · Golden/death crosses
          </p>
          {patterns.length === 0 ? (
            <Empty label="No active chart patterns detected. Run signals-refresh to scan." />
          ) : (
            patterns.map((row) => <PatternCard key={row.id} row={row} />)
          )}
        </div>
      )}

      {/* Entry Signals */}
      {tab === "entry" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            Stocks in pullback or support-test entry zones
          </p>
          {entrySignals.length === 0 ? (
            <Empty label="No stocks in actionable entry zones right now." />
          ) : (
            entrySignals.map((row) => <EntryCard key={row.symbol} row={row} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function AnalystCard({ row }: { row: AnalystRow }) {
  const consensusColor =
    row.consensus === "Strong Buy" || row.consensus === "Buy"
      ? "bg-emerald-500/20 text-emerald-400"
      : row.consensus === "Sell" || row.consensus === "Strong Sell"
      ? "bg-red-500/20 text-red-400"
      : "bg-blue-500/20 text-blue-400";

  const bullish = row.strongBuy + row.buy;
  const bearish = row.sell + row.strongSell;
  const total = row.totalAnalysts || 1;
  const bullPct = Math.round((bullish / total) * 100);
  const holdPct = Math.round((row.hold / total) * 100);
  const bearPct = 100 - bullPct - holdPct;

  return (
    <a
      href={`/stocks/${row.symbol}`}
      className="block rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 hover:border-[hsl(var(--accent))]/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono font-bold text-sm">{row.symbol}</span>
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] truncate">
              {row.company_name}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider ${consensusColor}`}>
              {row.consensus.toUpperCase()}
            </span>
          </div>
          {/* Buy/Hold/Sell bar */}
          <div className="flex h-1.5 rounded-full overflow-hidden w-full max-w-48 mt-1.5 mb-1">
            <div className="bg-emerald-500" style={{ width: `${bullPct}%` }} />
            <div className="bg-blue-500" style={{ width: `${holdPct}%` }} />
            <div className="bg-red-500" style={{ width: `${bearPct}%` }} />
          </div>
          <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
            <span className="text-emerald-400">{bullish} buy</span>
            {row.hold > 0 && <span className="text-blue-400"> · {row.hold} hold</span>}
            {bearish > 0 && <span className="text-red-400"> · {bearish} sell</span>}
            <span> · {row.totalAnalysts} analysts</span>
          </p>
        </div>
        {row.lastMonthTarget && (
          <div className="text-right shrink-0">
            <p className="font-mono font-bold text-sm text-[hsl(var(--foreground))]">
              ${row.lastMonthTarget.toFixed(0)}
            </p>
            <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">PT 1mo avg</p>
            {row.lastQuarterTarget && (
              <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
                ${row.lastQuarterTarget.toFixed(0)} 1q
              </p>
            )}
          </div>
        )}
      </div>
    </a>
  );
}

function InsiderCard({ row }: { row: InsiderRow }) {
  const isMajor = row.total_value >= 1_000_000;
  return (
    <a
      href={row.sec_link || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 hover:border-[hsl(var(--accent))]/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono font-bold text-sm">{row.symbol}</span>
            {isMajor && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 tracking-wider">
                $1M+
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))]">
            {row.insider_name} — {row.insider_title}
          </p>
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] mt-0.5">
            {row.shares.toLocaleString()} shares @ ${row.price_per_share.toFixed(2)} · {row.transaction_date}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-mono font-bold text-sm ${isMajor ? "text-emerald-400" : "text-[hsl(var(--foreground))]"}`}>
            ${fmtVal(row.total_value)}
          </p>
          <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] mt-0.5">PURCHASE</p>
        </div>
      </div>
    </a>
  );
}

function SqueezeCard({ row }: { row: ShortSqueezeRow }) {
  const isHot = row.short_float_pct >= 20;
  return (
    <a
      href={`/stocks/${row.symbol}`}
      className="block rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 hover:border-[hsl(var(--accent))]/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-sm">{row.symbol}</span>
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] truncate">
              {row.company_name}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Pill label="SHORT FLOAT" value={`${row.short_float_pct.toFixed(1)}%`} hot={isHot} />
            <Pill label="DAYS CVR" value={row.short_ratio.toFixed(1)} />
            <Pill label="SCORE" value={String(row.total_score)} />
            {row.rs_vs_spy !== null && (
              <Pill
                label="RS vs SPY"
                value={`${row.rs_vs_spy >= 0 ? "+" : ""}${row.rs_vs_spy.toFixed(1)}%`}
                hot={row.rs_vs_spy > 10}
              />
            )}
          </div>
        </div>
        <ZoneBadge zone={row.current_zone} />
      </div>
    </a>
  );
}

function PatternCard({ row }: { row: PatternRow }) {
  const PATTERN_LABEL: Record<PatternType, string> = {
    breakout:       "BREAKOUT",
    bull_flag:      "BULL FLAG",
    cup_and_handle: "CUP & HANDLE",
    golden_cross:   "GOLDEN CROSS",
    death_cross:    "DEATH CROSS",
  };
  const PATTERN_COLOR: Record<PatternType, string> = {
    breakout:       "bg-blue-500/20 text-blue-400",
    bull_flag:      "bg-amber-500/20 text-amber-400",
    cup_and_handle: "bg-violet-500/20 text-violet-400",
    golden_cross:   "bg-emerald-500/20 text-emerald-400",
    death_cross:    "bg-red-500/20 text-red-400",
  };

  return (
    <a
      href={`/stocks/${row.symbol}`}
      className="block rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 hover:border-[hsl(var(--accent))]/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-sm">{row.symbol}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider ${
                PATTERN_COLOR[row.pattern_type] ?? "bg-[hsl(var(--muted))]/30 text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {PATTERN_LABEL[row.pattern_type] ?? row.pattern_type.toUpperCase()}
            </span>
          </div>
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] leading-relaxed">
            {row.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <ConfidenceBar value={row.confidence} />
          <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] mt-1">
            ${row.price_at_detection.toFixed(2)}
          </p>
        </div>
      </div>
    </a>
  );
}

function EntryCard({ row }: { row: EntrySignalRow }) {
  return (
    <a
      href={`/stocks/${row.symbol}`}
      className="block rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 hover:border-[hsl(var(--accent))]/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-sm">{row.symbol}</span>
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] truncate">
              {row.company_name}
            </span>
          </div>
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] leading-relaxed">
            {row.summary}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
              AGG ${row.aggressive_entry_low.toFixed(2)}–${row.aggressive_entry_high.toFixed(2)}
            </span>
            <span className="text-[hsl(var(--border))]">·</span>
            <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
              PAT ${row.patient_entry_low.toFixed(2)}–${row.patient_entry_high.toFixed(2)}
            </span>
            {row.rs_vs_spy !== null && (
              <>
                <span className="text-[hsl(var(--border))]">·</span>
                <span
                  className={`text-[9px] font-mono font-bold ${
                    row.rs_vs_spy >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  RS {row.rs_vs_spy >= 0 ? "+" : ""}{row.rs_vs_spy.toFixed(1)}% vs SPY
                </span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <ZoneBadge zone={row.current_zone} />
          <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
            SCORE {row.total_score}
          </span>
        </div>
      </div>
    </a>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-6 text-center">
      <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))]">{label}</p>
    </div>
  );
}

function Pill({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] tracking-wider">
        {label}
      </span>
      <span
        className={`text-[11px] font-mono font-bold ${
          hot ? "text-orange-400" : "text-[hsl(var(--foreground))]"
        }`}
      >
        {value}
      </span>
    </span>
  );
}

function ZoneBadge({ zone }: { zone: string }) {
  const styles: Record<string, string> = {
    pullback:     "bg-emerald-500/20 text-emerald-400",
    support_test: "bg-amber-500/20 text-amber-400",
    fair:         "bg-blue-500/20 text-blue-400",
    extended:     "bg-red-500/20 text-red-400",
  };
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider ${
        styles[zone] ?? "bg-[hsl(var(--muted))]/30 text-[hsl(var(--muted-foreground))]"
      }`}
    >
      {zone.replace("_", " ").toUpperCase()}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-[hsl(var(--muted))]";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-[hsl(var(--border))]">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">{value}%</span>
    </div>
  );
}

function fmtVal(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}
