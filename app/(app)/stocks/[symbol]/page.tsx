import { notFound } from "next/navigation";
import {
  getSymbolByTicker,
  getLatestSnapshot,
  getLatestFinancials,
  getEarningsHistory,
  getLatestEntryZone,
  getPeerComparisons,
  getActiveAlerts,
  getNotesForSymbol,
} from "@/lib/db/queries";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatDate,
  getChangeColor,
  getScoreColor,
  getScoreBg,
  getZoneColor,
  getRiskColor,
} from "@/lib/utils";
import { getScoreLabel, getScoreLabelDisplay } from "@/types";
import { StockChart } from "@/components/charts/stock-chart";
import { NotesSection } from "@/components/stocks/notes-section";

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;

  const [info, snap, financials, earnings, entryZone, peers, alerts, notes] =
    await Promise.all([
      getSymbolByTicker(symbol.toUpperCase()),
      getLatestSnapshot(symbol.toUpperCase()),
      getLatestFinancials(symbol.toUpperCase()),
      getEarningsHistory(symbol.toUpperCase()),
      getLatestEntryZone(symbol.toUpperCase()),
      getPeerComparisons(symbol.toUpperCase()),
      getActiveAlerts(symbol.toUpperCase()),
      getNotesForSymbol(symbol.toUpperCase()),
    ]);

  if (!info || !snap) notFound();

  const scoreLabel = getScoreLabel(snap.total_score);

  return (
    <div className="px-4 pt-4 pb-8 space-y-5">
      {/* ─── Top Section ───────────────────────────────────────── */}
      <div>
        <a href="/stocks" className="text-xs font-mono text-[hsl(var(--accent))] mb-3 block">
          ← BACK
        </a>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-mono font-extrabold">{info.symbol}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{info.company_name}</p>
            <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] mt-0.5">
              {info.sector} · {info.industry} · {info.primary_exchange}
            </p>
          </div>
          <div className="text-right">
            <div className={`score-pill ${getScoreBg(snap.total_score)} ${getScoreColor(snap.total_score)} text-sm`}>
              {Math.round(snap.total_score)}
            </div>
            <div className={`text-[10px] mt-1 font-mono ${getScoreColor(snap.total_score)}`}>
              {getScoreLabelDisplay(scoreLabel)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-3xl font-mono font-extrabold">
            {formatCurrency(snap.price)}
          </span>
          <span className={`text-sm font-mono font-bold ${getChangeColor(snap.change_1d)}`}>
            {formatPercent(snap.change_1d)} today
          </span>
        </div>

        {/* Period returns */}
        <div className="flex gap-3 mt-2">
          {[
            { label: "1W", value: snap.change_1w },
            { label: "1M", value: snap.change_1m },
            { label: "3M", value: snap.change_3m },
            { label: "1Y", value: snap.change_1y },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">{label}</div>
              <div className={`text-xs font-mono font-bold ${getChangeColor(value)}`}>
                {formatPercent(value, 1)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Chart ─────────────────────────────────────────────── */}
      <section>
        <h2 className="section-label">◆ CHART</h2>
        <StockChart symbol={info.symbol} />
      </section>

      {/* ─── Score Breakdown ───────────────────────────────────── */}
      <section>
        <h2 className="section-label">◆ SCORE BREAKDOWN</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Trend", score: snap.trend_score },
            { label: "Earnings", score: snap.earnings_score },
            { label: "Valuation", score: snap.valuation_score },
            { label: "Industry", score: snap.industry_score },
            { label: "Quality", score: snap.setup_score },
            { label: "Risk", score: snap.risk_score },
          ].map(({ label, score }) => (
            <div key={label} className="card-interactive text-center py-3">
              <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                {label}
              </div>
              <div className={`text-xl font-mono font-extrabold mt-1 ${getScoreColor(score)}`}>
                {Math.round(score)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Entry Zones ──────────────────────────────────────── */}
      {entryZone && (
        <section>
          <h2 className="section-label">◆ ENTRY ZONE</h2>
          <div className="card-interactive space-y-3">
            <div className="flex items-center justify-between">
              <span className={`font-mono font-bold text-sm uppercase ${getZoneColor(entryZone.current_zone)}`}>
                {entryZone.current_zone.replace("_", " ")}
              </span>
              <span className={`text-xs font-mono ${getRiskColor(entryZone.risk_label)}`}>
                Risk: {entryZone.risk_label.toUpperCase()}
              </span>
            </div>

            <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
              {entryZone.summary}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[hsl(var(--muted))]/30 rounded-lg p-3">
                <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                  Aggressive Entry
                </div>
                <div className="font-mono font-bold text-bullish">
                  ${entryZone.aggressive_entry_low} – ${entryZone.aggressive_entry_high}
                </div>
              </div>
              <div className="bg-[hsl(var(--muted))]/30 rounded-lg p-3">
                <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
                  Patient Entry
                </div>
                <div className="font-mono font-bold text-[hsl(var(--accent))]">
                  ${entryZone.patient_entry_low} – ${entryZone.patient_entry_high}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
              <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">INVALIDATION</span>
              <span className="font-mono font-bold text-bearish">${entryZone.invalidation_price}</span>
            </div>
          </div>
        </section>
      )}

      {/* ─── Key Metrics ──────────────────────────────────────── */}
      <section>
        <h2 className="section-label">◆ KEY METRICS</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Market Cap", value: formatNumber(snap.market_cap, true) },
            { label: "52W High", value: formatCurrency(snap.fifty_two_week_high) },
            { label: "52W Low", value: formatCurrency(snap.fifty_two_week_low) },
            { label: "RSI", value: snap.rsi.toFixed(1) },
            { label: "20 MA", value: formatCurrency(snap.ma_20) },
            { label: "50 MA", value: formatCurrency(snap.ma_50) },
            { label: "200 MA", value: formatCurrency(snap.ma_200) },
            { label: "Volatility", value: `${snap.volatility_30d.toFixed(1)}%` },
            { label: "Vol / Avg", value: `${(snap.volume / (snap.avg_volume || 1)).toFixed(2)}x` },
            { label: "Drawdown", value: formatPercent(snap.drawdown_from_high, 1) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 px-3 bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))]">
              <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{label}</span>
              <span className="text-sm font-mono font-bold">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Valuation ────────────────────────────────────────── */}
      {financials && (
        <section>
          <h2 className="section-label">◆ VALUATION</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "P/E", value: financials.pe_ratio?.toFixed(1) ?? "N/A" },
              { label: "P/S", value: financials.ps_ratio?.toFixed(1) ?? "N/A" },
              { label: "EV/Rev", value: financials.ev_to_revenue?.toFixed(1) ?? "N/A" },
              { label: "D/E", value: financials.debt_to_equity?.toFixed(2) ?? "N/A" },
              { label: "Gross Margin", value: `${financials.gross_margin?.toFixed(1) ?? 0}%` },
              { label: "Op Margin", value: `${financials.operating_margin?.toFixed(1) ?? 0}%` },
              { label: "Rev Growth", value: `${financials.revenue_growth?.toFixed(1) ?? 0}%` },
              { label: "EPS", value: formatCurrency(financials.eps ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 px-3 bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))]">
                <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{label}</span>
                <span className="text-sm font-mono font-bold">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Earnings History ─────────────────────────────────── */}
      {earnings.length > 0 && (
        <section>
          <h2 className="section-label">◆ EARNINGS HISTORY</h2>
          <div className="card-interactive p-0 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-5 gap-1 px-3 py-2 border-b border-[hsl(var(--border))] text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              <span>Date</span>
              <span className="text-right">Est EPS</span>
              <span className="text-right">Act EPS</span>
              <span className="text-right">Surprise</span>
              <span className="text-right">1D Rxn</span>
            </div>
            {earnings.slice(0, 8).map((e, i) => (
              <div
                key={e.id}
                className={`grid grid-cols-5 gap-1 px-3 py-2.5 text-xs font-mono ${
                  i < earnings.length - 1 ? "border-b border-[hsl(var(--border))]" : ""
                }`}
              >
                <span className="text-[hsl(var(--muted-foreground))]">{formatDate(e.report_date)}</span>
                <span className="text-right">{e.estimated_eps?.toFixed(2) ?? "—"}</span>
                <span className="text-right font-bold">{e.actual_eps?.toFixed(2) ?? "—"}</span>
                <span className={`text-right ${(e.eps_surprise ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {e.eps_surprise != null ? formatPercent(e.eps_surprise, 1) : "—"}
                </span>
                <span className={`text-right ${(e.price_reaction_1d ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {e.price_reaction_1d != null ? formatPercent(e.price_reaction_1d, 1) : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Peer Comparison ──────────────────────────────────── */}
      {peers.length > 0 && (
        <section>
          <h2 className="section-label">◆ PEER COMPARISON</h2>
          <div className="space-y-2">
            {peers.map((peer) => (
              <a
                key={peer.symbol}
                href={`/stocks/${peer.symbol}`}
                className={`card-interactive flex items-center justify-between ${
                  peer.symbol === symbol.toUpperCase() ? "border-[hsl(var(--accent))]/40" : ""
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{peer.symbol}</span>
                    {peer.is_leader && (
                      <span className="text-[9px] font-mono bg-bullish/15 text-bullish px-1.5 py-0.5 rounded">
                        LEADER
                      </span>
                    )}
                    {peer.symbol === symbol.toUpperCase() && (
                      <span className="text-[9px] font-mono bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] px-1.5 py-0.5 rounded">
                        THIS
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {peer.company_name}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-right">
                    <div className="text-[hsl(var(--muted-foreground))]">P/E</div>
                    <div className="font-bold">{peer.pe_ratio?.toFixed(1) ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[hsl(var(--muted-foreground))]">1M</div>
                    <div className={`font-bold ${getChangeColor(peer.change_1m)}`}>
                      {formatPercent(peer.change_1m, 1)}
                    </div>
                  </div>
                  <span className={`font-bold ${getScoreColor(peer.total_score)}`}>
                    {Math.round(peer.total_score)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ─── Notes ────────────────────────────────────────────── */}
      <NotesSection symbol={info.symbol} initialNotes={notes} />
    </div>
  );
}
