export default function Loading() {
  const candles = [
    { green: true,  bodyH: 44, wickT: 14, wickB: 8,  delay: "0s" },
    { green: false, bodyH: 28, wickT: 8,  wickB: 12, delay: "0.18s" },
    { green: true,  bodyH: 56, wickT: 10, wickB: 6,  delay: "0.36s" },
    { green: false, bodyH: 32, wickT: 16, wickB: 8,  delay: "0.54s" },
    { green: true,  bodyH: 48, wickT: 8,  wickB: 10, delay: "0.72s" },
    { green: false, bodyH: 20, wickT: 12, wickB: 14, delay: "0.9s" },
    { green: true,  bodyH: 38, wickT: 10, wickB: 8,  delay: "1.08s" },
  ];

  const tickers = [
    "AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "GOOGL", "META",
    "AMD", "PLTR", "NFLX", "V", "JPM", "GS", "AVGO", "ORCL",
  ];
  const tape = tickers.join("  ·  ");

  return (
    <>
      <style>{`
        @keyframes candle-pulse {
          0%, 100% { transform: scaleY(0.28); opacity: 0.5; }
          50%       { transform: scaleY(1);    opacity: 1;   }
        }
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 0.9; }
        }
        @keyframes dot-blink {
          0%, 80%, 100% { opacity: 0; }
          40%           { opacity: 1; }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center min-h-[68vh] gap-6 select-none">

        {/* ── Candlestick chart ── */}
        <div className="flex items-end gap-2.5" style={{ height: "88px" }}>
          {candles.map((c, i) => (
            <div
              key={i}
              className="flex flex-col items-center"
              style={{
                animation: `candle-pulse 1.6s ease-in-out ${c.delay} infinite`,
                transformOrigin: "bottom center",
              }}
            >
              {/* top wick */}
              <div
                className={`w-px ${c.green ? "bg-emerald-500" : "bg-red-500"}`}
                style={{ height: c.wickT }}
              />
              {/* body */}
              <div
                className={`w-4 rounded-[2px] ${c.green ? "bg-emerald-500" : "bg-red-500"}`}
                style={{ height: c.bodyH }}
              />
              {/* bottom wick */}
              <div
                className={`w-px ${c.green ? "bg-emerald-500/60" : "bg-red-500/60"}`}
                style={{ height: c.wickB }}
              />
            </div>
          ))}
        </div>

        {/* ── Glow baseline ── */}
        <div
          className="w-44 h-px bg-gradient-to-r from-transparent via-[hsl(var(--accent))] to-transparent"
          style={{ animation: "glow-pulse 1.6s ease-in-out infinite" }}
        />

        {/* ── Label ── */}
        <div className="flex items-center gap-0.5">
          <span className="text-[11px] font-mono tracking-[0.22em] text-[hsl(var(--muted-foreground))]">
            LOADING
          </span>
          {[0, 1, 2].map((n) => (
            <span
              key={n}
              className="text-[11px] font-mono text-[hsl(var(--accent))]"
              style={{ animation: `dot-blink 1.4s ease-in-out ${n * 0.2}s infinite` }}
            >
              .
            </span>
          ))}
        </div>

        {/* ── Ticker tape ── */}
        <div className="w-full overflow-hidden border-t border-b border-[hsl(var(--border))]/40 py-1.5 mt-2">
          <div
            className="flex whitespace-nowrap"
            style={{ animation: "ticker-scroll 22s linear infinite" }}
          >
            {/* Duplicate so the loop is seamless */}
            {[0, 1].map((n) => (
              <span
                key={n}
                className="text-[10px] font-mono tracking-widest text-[hsl(var(--muted-foreground))]/60 pr-16"
              >
                ◆ &nbsp; {tape}
              </span>
            ))}
            {[2, 3].map((n) => (
              <span
                key={n}
                className="text-[10px] font-mono tracking-widest text-[hsl(var(--muted-foreground))]/60 pr-16"
              >
                ◆ &nbsp; {tape}
              </span>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
