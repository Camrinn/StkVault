"use client";

import { useEffect, useState } from "react";
import type { TrackedSymbol } from "@/types";

export default function AdminPage() {
  const [symbols, setSymbols] = useState<TrackedSymbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSymbols();
  }, []);

  async function loadSymbols() {
    try {
      const res = await fetch("/api/admin/tracked-symbols");
      if (res.status === 403) {
        setError("Admin access required.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSymbols(data);
    } catch {
      setError("Failed to load.");
    }
    setLoading(false);
  }

  async function addSymbol() {
    if (!newSymbol.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tracked-symbols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: newSymbol.toUpperCase(),
          company_name: newName || newSymbol.toUpperCase(),
          sector: "",
          industry: "",
        }),
      });
      if (res.ok) {
        await loadSymbols();
        setNewSymbol("");
        setNewName("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add");
      }
    } catch {
      setError("Failed to add symbol");
    }
    setAdding(false);
  }

  async function removeSymbol(symbol: string) {
    if (!confirm(`Remove ${symbol} from tracking?`)) return;
    await fetch(`/api/admin/tracked-symbols/${symbol}`, { method: "DELETE" });
    await loadSymbols();
  }

  async function toggleActive(symbol: string, isActive: boolean) {
    await fetch(`/api/admin/tracked-symbols/${symbol}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    });
    await loadSymbols();
  }

  async function triggerRefresh(type: string) {
    setRefreshing(type);
    try {
      await fetch("/api/admin/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
    } catch {
      setError("Refresh failed");
    }
    setRefreshing(null);
  }

  if (loading) {
    return (
      <div className="px-4 pt-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-40 bg-[hsl(var(--muted))] rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]" />
          ))}
        </div>
      </div>
    );
  }

  if (error === "Admin access required.") {
    return (
      <div className="px-4 pt-4 text-center py-16">
        <div className="text-3xl mb-3">🔒</div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Admin access required to manage the stock universe.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="text-lg font-mono font-extrabold tracking-wider mb-1">ADMIN</h1>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-5">
        Manage active stock universe and refresh data
      </p>

      {error && error !== "Admin access required." && (
        <div className="mb-4 p-3 bg-bearish/10 border border-bearish/30 rounded-lg text-sm text-bearish">
          {error}
        </div>
      )}

      {/* Add symbol */}
      <section className="mb-6">
        <h2 className="section-label">◆ ADD STOCK ({symbols.length}/10)</h2>
        <div className="card-interactive space-y-3">
          <div className="flex gap-2">
            <input
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="TICKER"
              maxLength={5}
              className="flex-1 bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))] rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[hsl(var(--accent))]/40"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Company name (optional)"
              className="flex-[2] bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--accent))]/40"
            />
          </div>
          <button
            onClick={addSymbol}
            disabled={adding || !newSymbol.trim() || symbols.length >= 10}
            className="w-full py-2.5 bg-[hsl(var(--accent))] text-white text-xs font-mono font-bold tracking-wider rounded-lg disabled:opacity-40 transition-opacity"
          >
            {adding ? "ADDING..." : "+ ADD TO UNIVERSE"}
          </button>
        </div>
      </section>

      {/* Active symbols */}
      <section className="mb-6">
        <h2 className="section-label">◆ TRACKED SYMBOLS</h2>
        <div className="space-y-2">
          {symbols.map((sym) => (
            <div key={sym.id} className="card-interactive flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleActive(sym.symbol, sym.is_active)}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-mono transition-colors ${
                    sym.is_active
                      ? "bg-bullish/15 border-bullish/30 text-bullish"
                      : "bg-[hsl(var(--muted))]/30 border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  {sym.is_active ? "✓" : "—"}
                </button>
                <div>
                  <div className="font-mono font-bold text-sm">{sym.symbol}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {sym.company_name} · {sym.sector || "No sector"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeSymbol(sym.symbol)}
                className="w-8 h-8 rounded-lg border border-bearish/30 text-bearish flex items-center justify-center text-xs hover:bg-bearish/10 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Refresh controls */}
      <section>
        <h2 className="section-label">◆ MANUAL REFRESH</h2>
        <div className="grid grid-cols-1 gap-2">
          {[
            { type: "hourly", label: "HOURLY REFRESH", desc: "Prices, technicals, scores, alerts" },
            { type: "fundamentals", label: "FUNDAMENTALS", desc: "Financials, ratios, profiles" },
            { type: "earnings", label: "EARNINGS", desc: "Earnings calendar, surprises, reactions" },
          ].map(({ type, label, desc }) => (
            <button
              key={type}
              onClick={() => triggerRefresh(type)}
              disabled={refreshing !== null}
              className="card-interactive text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-bold tracking-wider">{label}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{desc}</div>
                </div>
                {refreshing === type ? (
                  <div className="w-5 h-5 border-2 border-[hsl(var(--border))] border-t-[hsl(var(--accent))] rounded-full animate-spin" />
                ) : (
                  <span className="text-xs font-mono text-[hsl(var(--accent))]">RUN →</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
