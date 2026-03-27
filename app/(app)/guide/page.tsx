export const dynamic = "force-dynamic";

const weights = [
  { label: "Trend", pct: "30%", color: "text-blue-400" },
  { label: "Earnings", pct: "20%", color: "text-emerald-400" },
  { label: "Valuation", pct: "15%", color: "text-yellow-400" },
  { label: "Industry", pct: "15%", color: "text-purple-400" },
  { label: "Quality", pct: "10%", color: "text-orange-400" },
  { label: "Risk", pct: "10%", color: "text-red-400" },
];

const tiers = [
  { range: "85 – 100", label: "PRIME SETUP", color: "text-emerald-400", desc: "All systems aligned. Strong candidate." },
  { range: "70 – 84", label: "STRONG", color: "text-blue-400", desc: "Most factors positive. Worth watching closely." },
  { range: "50 – 69", label: "NEUTRAL", color: "text-[hsl(var(--muted-foreground))]", desc: "Mixed signals. No clear edge." },
  { range: "40 – 49", label: "WEAK", color: "text-yellow-400", desc: "More negatives than positives." },
  { range: "0 – 39", label: "AVOID", color: "text-red-400", desc: "Multiple risk flags. Stay out." },
];

const sections = [
  {
    label: "TREND",
    pct: "30%",
    color: "border-blue-500/40",
    dot: "bg-blue-400",
    items: [
      { signal: "Price above 20-day MA", points: "+15" },
      { signal: "Price above 50-day MA", points: "+15" },
      { signal: "Price above 200-day MA", points: "+15" },
      { signal: "Positive 1-month return", points: "+10" },
      { signal: "Positive 3-month return", points: "+10" },
      { signal: "Volume above average", points: "+10" },
      { signal: "RSI 40–70 (sweet spot)", points: "+15" },
      { signal: "RSI 30–80 (acceptable)", points: "+7" },
      { signal: "Drawdown < 5% from high", points: "+10" },
      { signal: "Drawdown < 15% from high", points: "+5" },
    ],
  },
  {
    label: "EARNINGS",
    pct: "20%",
    color: "border-emerald-500/40",
    dot: "bg-emerald-400",
    items: [
      { signal: "EPS beat (per quarter, last 4)", points: "+10" },
      { signal: "Revenue beat (per quarter)", points: "+7" },
      { signal: "Positive post-earnings reaction", points: "+5" },
      { signal: "4 consecutive EPS beats", points: "+12 bonus" },
      { signal: "3 consecutive EPS beats", points: "+8 bonus" },
      { signal: "2 consecutive EPS beats", points: "+4 bonus" },
    ],
  },
  {
    label: "VALUATION",
    pct: "15%",
    color: "border-yellow-500/40",
    dot: "bg-yellow-400",
    items: [
      { signal: "P/E < 70% of industry median", points: "+20" },
      { signal: "P/E < 90% of industry median", points: "+10" },
      { signal: "P/E > 130% of industry median", points: "−15" },
      { signal: "P/S < 70% of industry median", points: "+15" },
      { signal: "Revenue growth above peers by 10%+", points: "+10" },
      { signal: "Operating margin < 0%", points: "−10" },
      { signal: "Operating margin > 20%", points: "+5" },
    ],
  },
  {
    label: "INDUSTRY",
    pct: "15%",
    color: "border-purple-500/40",
    dot: "bg-purple-400",
    items: [
      { signal: "1M return above peer average", points: "+15" },
      { signal: "Total score above peer average", points: "+10" },
      { signal: "Industry revenue growth > 15%", points: "+15" },
      { signal: "Industry revenue growth > 5%", points: "+7" },
      { signal: "Designated sector leader", points: "+10" },
      { signal: "Designated sector laggard", points: "−15" },
    ],
  },
  {
    label: "QUALITY",
    pct: "10%",
    color: "border-orange-500/40",
    dot: "bg-orange-400",
    items: [
      { signal: "Gross margin > 60%", points: "+15" },
      { signal: "Gross margin > 40%", points: "+8" },
      { signal: "Gross margin < 20%", points: "−10" },
      { signal: "Operating margin > 25%", points: "+15" },
      { signal: "Operating margin > 10%", points: "+7" },
      { signal: "Operating margin < 0%", points: "−15" },
      { signal: "Free cash flow positive", points: "+10" },
      { signal: "Debt/equity < 0.5", points: "+10" },
      { signal: "Debt/equity > 2", points: "−10" },
    ],
  },
  {
    label: "RISK",
    pct: "10%",
    color: "border-red-500/40",
    dot: "bg-red-400",
    note: "Higher = LESS risky",
    items: [
      { signal: "Drawdown from high < 10%", points: "+5" },
      { signal: "Drawdown from high > 20%", points: "−15" },
      { signal: "Drawdown from high > 30%", points: "−25" },
      { signal: "30d annualized volatility < 15%", points: "+10" },
      { signal: "30d annualized volatility > 30%", points: "−10" },
      { signal: "30d annualized volatility > 50%", points: "−20" },
      { signal: "Post-earnings drop > 5% (recent)", points: "−10" },
      { signal: "RSI extreme (< 20 or > 80)", points: "−10" },
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="px-4 pt-4 pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-mono font-extrabold tracking-wider">SCORE GUIDE</h1>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          How each stock's composite score is calculated
        </p>
      </div>

      {/* Composite weights */}
      <div className="card-interactive mb-4">
        <p className="text-[10px] font-mono tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
          COMPOSITE WEIGHTS
        </p>
        <div className="space-y-2">
          {weights.map((w) => (
            <div key={w.label} className="flex items-center gap-3">
              <span className={`text-xs font-mono font-bold w-20 ${w.color}`}>{w.label}</span>
              <div className="flex-1 h-1.5 bg-[hsl(var(--muted))]/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${w.color.replace("text-", "bg-")}`}
                  style={{ width: w.pct }}
                />
              </div>
              <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] w-8 text-right">
                {w.pct}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Score tiers */}
      <div className="card-interactive mb-6">
        <p className="text-[10px] font-mono tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
          SCORE TIERS
        </p>
        <div className="space-y-2.5">
          {tiers.map((t) => (
            <div key={t.label} className="flex items-start gap-3">
              <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] w-16 shrink-0 pt-px">
                {t.range}
              </span>
              <div>
                <span className={`text-xs font-mono font-bold ${t.color}`}>{t.label}</span>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-section breakdown */}
      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.label} className={`card-interactive border-l-2 ${s.color}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-xs font-mono font-bold tracking-wider">{s.label}</span>
              <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                {s.pct} of total
              </span>
              {s.note && (
                <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] ml-auto">
                  {s.note}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {s.items.map((item) => (
                <div key={item.signal} className="flex items-center justify-between">
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{item.signal}</span>
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      item.points.startsWith("−") ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {item.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
