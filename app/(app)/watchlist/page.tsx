"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatPercent, getChangeColor, getScoreColor } from "@/lib/utils";

interface WatchlistStock {
  symbol: string;
  company_name: string;
  sector: string;
  price: number;
  change_1d: number;
  total_score: number;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function removeFromWatchlist(symbol: string) {
    await fetch(`/api/watchlist/${symbol}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.symbol !== symbol));
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="text-lg font-mono font-extrabold tracking-wider mb-1">MY WATCHLIST</h1>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-5">
        Your starred stocks and saved theses
      </p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-3xl mb-3">⭐</div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No stocks in your watchlist yet.
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Star stocks from their detail page to track them here.
          </p>
          <a
            href="/stocks"
            className="inline-block mt-4 px-4 py-2 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] text-xs font-mono font-bold tracking-wider rounded-lg border border-[hsl(var(--accent))]/30"
          >
            BROWSE STOCKS →
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.symbol} className="card-interactive flex items-center justify-between">
              <a href={`/stocks/${item.symbol}`} className="flex-1">
                <div className="font-mono font-bold text-sm">{item.symbol}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {item.tracked_symbols?.company_name} · {item.tracked_symbols?.sector}
                </div>
              </a>
              <button
                onClick={() => removeFromWatchlist(item.symbol)}
                className="text-bearish text-xs font-mono px-2 py-1 rounded hover:bg-bearish/10 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
