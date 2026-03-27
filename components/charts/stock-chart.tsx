"use client";

import { useEffect, useRef, useState } from "react";
import type { PriceLevel } from "@/types";

interface OHLCV {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Indicator calculations ────────────────────────────────────────────────────

function calcMA(data: OHLCV[], period: number) {
  const result: { time: string; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, d) => a + d.close, 0);
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

function calcEMA(data: OHLCV[], period: number) {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, d) => a + d.close, 0) / period;
  const result: { time: string; value: number }[] = [{ time: data[period - 1].time, value: ema }];
  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

function calcVWAP(data: OHLCV[]) {
  const result: { time: string; value: number }[] = [];
  let tpv = 0;
  let vol = 0;
  for (const d of data) {
    const tp = (d.high + d.low + d.close) / 3;
    tpv += tp * d.volume;
    vol += d.volume;
    if (vol > 0) result.push({ time: d.time, value: tpv / vol });
  }
  return result;
}

function calcRSI(data: OHLCV[], period = 14) {
  if (data.length < period + 2) return [];
  const changes = data.slice(1).map((d, i) => d.close - data[i].close);
  let avgGain = changes.slice(0, period).reduce((a, c) => a + (c > 0 ? c : 0), 0) / period;
  let avgLoss = changes.slice(0, period).reduce((a, c) => a + (c < 0 ? -c : 0), 0) / period;
  const rsi0 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  const result: { time: string; value: number }[] = [{ time: data[period].time, value: rsi0 }];
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? -changes[i] : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: data[i + 1].time, value: rsi });
  }
  return result;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGES = ["1d", "5d", "1w", "1m", "3m", "6m", "1y"] as const;

const IND_CONFIG = {
  ma20:  { label: "MA20",  color: "#f59e0b" },
  ma50:  { label: "MA50",  color: "#3b82f6" },
  ma200: { label: "MA200", color: "#8b5cf6" },
  ema20: { label: "EMA20", color: "#06b6d4" },
  vwap:  { label: "VWAP",  color: "#ec4899" },
  rsi:   { label: "RSI",   color: "#10b981" },
} as const;

type IndKey = keyof typeof IND_CONFIG;

// ── Component ─────────────────────────────────────────────────────────────────

export function StockChart({
  symbol,
  levels = [],
}: {
  symbol: string;
  levels?: PriceLevel[];
}) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const rsiChartRef = useRef<any>(null);
  const seriesRefs = useRef<Record<string, any>>({});

  const [range, setRange] = useState<string>("3m");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Record<IndKey, boolean>>({
    ma20: false, ma50: false, ma200: false, ema20: false, vwap: false, rsi: false,
  });

  const levelsKey = JSON.stringify(levels.map((l) => l.id));

  // Full chart rebuild: triggered by symbol, range, rsi toggle, or levels change
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    async function loadChart() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${symbol}/chart?range=${range}`);
        const data: OHLCV[] = await res.json();
        if (cancelled || !mainRef.current) return;

        const { createChart, ColorType, LineStyle } = await import("lightweight-charts");

        // Cleanup previous
        if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
        if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null; }
        seriesRefs.current = {};

        const baseOpts = {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#5c6078",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
          },
          grid: {
            vertLines: { color: "#1e203012" },
            horzLines: { color: "#1e203012" },
          },
          crosshair: {
            vertLine: { color: "#6c8aff40", width: 1 as const },
            horzLine: { color: "#6c8aff40", width: 1 as const },
          },
          rightPriceScale: { borderColor: "#1e2030" },
          timeScale: { borderColor: "#1e2030" },
        };

        const mainHeight = active.rsi ? 230 : 290;
        const chart = createChart(mainRef.current, {
          ...baseOpts,
          width: mainRef.current.clientWidth,
          height: mainHeight,
        });

        // Candlestick
        const candleSeries = chart.addCandlestickSeries({
          upColor: "#34d399", downColor: "#f87171",
          borderUpColor: "#34d399", borderDownColor: "#f87171",
          wickUpColor: "#34d399", wickDownColor: "#f87171",
        });
        candleSeries.setData(data);

        // Price level lines
        for (const lvl of levels) {
          candleSeries.createPriceLine({
            price: lvl.price,
            color: lvl.direction === "up" ? "#34d399" : "#f87171",
            lineWidth: 1 as const,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `${lvl.initials}${lvl.direction === "up" ? "↑" : "↓"}`,
          });
        }

        // Volume
        const volSeries = chart.addHistogramSeries({
          priceFormat: { type: "volume" as const },
          priceScaleId: "volume",
        });
        chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
        volSeries.setData(
          data.map((d) => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? "#34d39925" : "#f8717125",
          }))
        );

        // MA/EMA/VWAP overlays
        const lineDefaults = { priceLineVisible: false, lastValueVisible: false };

        const ma20S = chart.addLineSeries({ ...lineDefaults, color: "#f59e0b", lineWidth: 1 as const, visible: active.ma20 });
        ma20S.setData(calcMA(data, 20));
        seriesRefs.current.ma20 = ma20S;

        const ma50S = chart.addLineSeries({ ...lineDefaults, color: "#3b82f6", lineWidth: 1 as const, visible: active.ma50 });
        ma50S.setData(calcMA(data, 50));
        seriesRefs.current.ma50 = ma50S;

        const ma200S = chart.addLineSeries({ ...lineDefaults, color: "#8b5cf6", lineWidth: 1 as const, visible: active.ma200 });
        ma200S.setData(calcMA(data, 200));
        seriesRefs.current.ma200 = ma200S;

        const ema20S = chart.addLineSeries({
          ...lineDefaults, color: "#06b6d4", lineWidth: 1 as const,
          lineStyle: LineStyle.Dashed, visible: active.ema20,
        });
        ema20S.setData(calcEMA(data, 20));
        seriesRefs.current.ema20 = ema20S;

        const vwapS = chart.addLineSeries({ ...lineDefaults, color: "#ec4899", lineWidth: 1 as const, visible: active.vwap });
        vwapS.setData(calcVWAP(data));
        seriesRefs.current.vwap = vwapS;

        chart.timeScale().fitContent();
        chartRef.current = chart;

        // RSI sub-chart
        if (active.rsi && rsiRef.current) {
          const rsiChart = createChart(rsiRef.current, {
            ...baseOpts,
            width: rsiRef.current.clientWidth,
            height: 100,
            timeScale: { ...baseOpts.timeScale, visible: false },
          });

          const rsiSeries = rsiChart.addLineSeries({
            color: "#10b981",
            lineWidth: 1 as const,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          rsiSeries.setData(calcRSI(data));

          rsiSeries.createPriceLine({ price: 70, color: "#f8717170", lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" });
          rsiSeries.createPriceLine({ price: 30, color: "#34d39970", lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" });
          rsiSeries.createPriceLine({ price: 50, color: "#5c607840", lineWidth: 1 as const, lineStyle: LineStyle.Solid, axisLabelVisible: false, title: "" });

          rsiChart.priceScale("right").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });

          // Sync time scales (mutual subscription with loop guard)
          let syncing = false;
          chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
            if (syncing || !r) return;
            syncing = true;
            try { rsiChart.timeScale().setVisibleLogicalRange(r); } finally { syncing = false; }
          });
          rsiChart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
            if (syncing || !r) return;
            syncing = true;
            try { chart.timeScale().setVisibleLogicalRange(r); } finally { syncing = false; }
          });

          rsiChart.timeScale().fitContent();
          rsiChartRef.current = rsiChart;
        }

        // Resize observer
        observer = new ResizeObserver((entries) => {
          const w = entries[0]?.contentRect.width;
          if (!w) return;
          chartRef.current?.applyOptions({ width: w });
          rsiChartRef.current?.applyOptions({ width: w });
        });
        observer.observe(mainRef.current);
      } catch (err) {
        console.error("Chart error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadChart();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, range, active.rsi, levelsKey]);

  // Update overlay visibility without rebuilding the chart
  useEffect(() => {
    for (const key of ["ma20", "ma50", "ma200", "ema20", "vwap"] as const) {
      seriesRefs.current[key]?.applyOptions({ visible: active[key] });
    }
  }, [active.ma20, active.ma50, active.ma200, active.ema20, active.vwap]);

  function toggle(key: IndKey) {
    setActive((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div>
      {/* Range + indicator toggles */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider rounded-md transition-colors ${
              range === r
                ? "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/30"
                : "text-[hsl(var(--muted-foreground))] border border-transparent hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {(Object.entries(IND_CONFIG) as [IndKey, (typeof IND_CONFIG)[IndKey]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="px-2 py-1 text-[10px] font-mono font-bold tracking-wider rounded-md border transition-all"
            style={
              active[key]
                ? { borderColor: cfg.color + "60", backgroundColor: cfg.color + "20", color: cfg.color }
                : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
            }
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="relative rounded-xl overflow-hidden border border-[hsl(var(--border))]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--card))] z-10">
            <div className="w-6 h-6 border-2 border-[hsl(var(--border))] border-t-[hsl(var(--accent))] rounded-full animate-spin" />
          </div>
        )}
        <div ref={mainRef} className="w-full" style={{ minHeight: active.rsi ? 230 : 290 }} />
        {active.rsi && (
          <div
            ref={rsiRef}
            className="w-full border-t border-[hsl(var(--border))]"
            style={{ height: 100 }}
          />
        )}
      </div>
    </div>
  );
}
