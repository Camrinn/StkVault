"use client";

import { useState } from "react";
import { formatCurrency, formatPercent, formatNumber, getChangeColor, getScoreColor, getScoreBg, getZoneColor } from "@/lib/utils";

interface StockRow {
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  price: number;
  change_1d: number;
  change_1w: number;
  change_1m: number;
  total_score: number;
  volume: number;
  market_cap: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  zone: string;
}

export function StocksList({ stocks }: { stocks: StockRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(query.toLowerCase()) ||
          s.company_name.toLowerCase().includes(query.toLowerCase()) ||
          s.sector.toLowerCase().includes(query.toLowerCase()) ||
          s.industry.toLowerCase().includes(query.toLowerCase())
      )
    : stocks;

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticker, name, sector..."
          className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--accent))]/50 transition-colors placeholder:text-[hsl(var(--muted-foreground))] font-mono"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-foreground"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] mb-3">
        {filtered.length} of {stocks.length} stocks
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No stocks match &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((stock) => (
            <a key={stock.symbol} href={`/stocks/${stock.symbol}`} className="card-interactive block">
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

              <div className="flex items-baseline justify-between">
                <span className="font-mono font-bold text-xl">{formatCurrency(stock.price)}</span>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className={getChangeColor(stock.change_1d)}>1D {formatPercent(stock.change_1d, 1)}</span>
                  <span className={getChangeColor(stock.change_1w)}>1W {formatPercent(stock.change_1w, 1)}</span>
                  <span className={getChangeColor(stock.change_1m)}>1M {formatPercent(stock.change_1m, 1)}</span>
                </div>
              </div>

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
      )}
    </>
  );
}
