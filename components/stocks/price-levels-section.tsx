"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PriceLevel } from "@/types";

export function PriceLevelsSection({
  symbol,
  initialLevels,
}: {
  symbol: string;
  initialLevels: PriceLevel[];
}) {
  const router = useRouter();
  const [levels, setLevels] = useState(initialLevels);
  const [isOpen, setIsOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [initials, setInitials] = useState("");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    const priceNum = parseFloat(price);
    if (!priceNum || !initials.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/stocks/${symbol}/levels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: priceNum, initials: initials.trim().slice(0, 2), direction }),
      });
      if (res.ok) {
        const newLevel = await res.json();
        setLevels((prev) => [...prev, newLevel].sort((a, b) => a.price - b.price));
        setPrice("");
        setInitials("");
        setDirection("up");
        setIsOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to save level:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/stocks/${symbol}/levels?id=${id}`, { method: "DELETE" });
      setLevels((prev) => prev.filter((l) => l.id !== id));
      router.refresh();
    } catch (err) {
      console.error("Failed to delete level:", err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-label mb-0">◆ SUPPORT / RESISTANCE</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-[10px] font-mono font-bold text-[hsl(var(--accent))] tracking-wider"
        >
          {isOpen ? "CANCEL" : "+ ADD LEVEL"}
        </button>
      </div>

      {isOpen && (
        <div className="card-interactive mb-3 space-y-3 animate-slide-up">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">
                Price
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 150.00"
                step="0.01"
                className="w-full bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[hsl(var(--accent))]/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">
                Initials (2 chars)
              </label>
              <input
                type="text"
                value={initials}
                onChange={(e) => setInitials(e.target.value.slice(0, 2).toUpperCase())}
                placeholder="e.g. AB"
                maxLength={2}
                className="w-full bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-[hsl(var(--accent))]/40"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">
              Direction
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection("up")}
                className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg border transition-colors ${
                  direction === "up"
                    ? "bg-bullish/15 border-bullish/40 text-bullish"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                ↑ BULLISH
              </button>
              <button
                onClick={() => setDirection("down")}
                className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg border transition-colors ${
                  direction === "down"
                    ? "bg-bearish/15 border-bearish/40 text-bearish"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                ↓ BEARISH
              </button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={saving || !price || !initials.trim()}
            className="w-full py-2.5 bg-[hsl(var(--accent))] text-white text-xs font-mono font-bold tracking-wider rounded-lg disabled:opacity-40 transition-opacity"
          >
            {saving ? "SAVING..." : "ADD LEVEL"}
          </button>
        </div>
      )}

      {levels.length === 0 && !isOpen ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">
          No levels yet. Add support or resistance zones.
        </p>
      ) : (
        <div className="space-y-2">
          {levels.map((lvl) => (
            <div key={lvl.id} className="card-interactive flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-mono font-extrabold ${
                    lvl.direction === "up" ? "text-bullish" : "text-bearish"
                  }`}
                >
                  {lvl.direction === "up" ? "↑" : "↓"}
                </span>
                <span className="font-mono font-bold text-sm">${Number(lvl.price).toFixed(2)}</span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    lvl.direction === "up"
                      ? "bg-bullish/15 text-bullish"
                      : "bg-bearish/15 text-bearish"
                  }`}
                >
                  {lvl.initials}
                </span>
              </div>
              <button
                onClick={() => handleDelete(lvl.id)}
                disabled={deletingId === lvl.id}
                className="text-[hsl(var(--muted-foreground))] hover:text-bearish transition-colors disabled:opacity-40"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
