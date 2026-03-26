"use client";

import { useEffect, useRef, useState } from "react";

const RANGES = ["1w", "1m", "3m", "6m", "1y"] as const;

export function StockChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [range, setRange] = useState<string>("3m");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      setLoading(true);

      try {
        const res = await fetch(`/api/stocks/${symbol}/chart?range=${range}`);
        const data = await res.json();

        if (cancelled || !containerRef.current) return;

        // Dynamically import lightweight-charts
        const { createChart, ColorType } = await import("lightweight-charts");

        // Clean up existing chart
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }

        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: 260,
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#5c6078",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
          },
          grid: {
            vertLines: { color: "#1e203020" },
            horzLines: { color: "#1e203020" },
          },
          crosshair: {
            vertLine: { color: "#6c8aff40", width: 1 },
            horzLine: { color: "#6c8aff40", width: 1 },
          },
          rightPriceScale: {
            borderColor: "#1e2030",
          },
          timeScale: {
            borderColor: "#1e2030",
          },
        });

        const candleSeries = chart.addCandlestickSeries({
          upColor: "#34d399",
          downColor: "#f87171",
          borderUpColor: "#34d399",
          borderDownColor: "#f87171",
          wickUpColor: "#34d399",
          wickDownColor: "#f87171",
        });

        candleSeries.setData(data);

        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          color: "#6c8aff30",
        });

        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        volumeSeries.setData(
          data.map((d: any) => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? "#34d39930" : "#f8717130",
          }))
        );

        chart.timeScale().fitContent();
        chartRef.current = chart;

        // Handle resize
        const observer = new ResizeObserver((entries) => {
          if (entries[0] && chartRef.current) {
            chartRef.current.applyOptions({
              width: entries[0].contentRect.width,
            });
          }
        });
        observer.observe(containerRef.current);
      } catch (err) {
        console.error("Chart load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadChart();
    return () => { cancelled = true; };
  }, [symbol, range]);

  return (
    <div>
      {/* Range selector */}
      <div className="flex gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded-md transition-colors ${
              range === r
                ? "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/30"
                : "text-[hsl(var(--muted-foreground))] border border-transparent hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="relative rounded-xl overflow-hidden border border-[hsl(var(--border))]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--card))]">
            <div className="w-6 h-6 border-2 border-[hsl(var(--border))] border-t-[hsl(var(--accent))] rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="w-full" style={{ minHeight: 260 }} />
      </div>
    </div>
  );
}
