export const dynamic = "force-dynamic";

import { getActiveSymbols, getLatestSnapshot, getLatestFinancials } from "@/lib/db/queries";
import { formatCurrency, formatPercent, getChangeColor, getScoreColor } from "@/lib/utils";

export default async function IndustryPage() {
  const symbols = await getActiveSymbols();

  // Group by sector/industry
  const groups: Record<string, {
    sector: string;
    industry: string;
    stocks: {
      symbol: string;
      company_name: string;
      price: number;
      change_1m: number;
      pe_ratio: number;
      revenue_growth: number;
      total_score: number;
    }[];
  }> = {};

  for (const sym of symbols) {
    const [snap, fin] = await Promise.all([
      getLatestSnapshot(sym.symbol),
      getLatestFinancials(sym.symbol),
    ]);
    if (!snap) continue;

    const key = sym.industry || sym.sector || "Other";
    if (!groups[key]) {
      groups[key] = { sector: sym.sector, industry: sym.industry, stocks: [] };
    }
    groups[key].stocks.push({
      symbol: sym.symbol,
      company_name: sym.company_name,
      price: snap.price,
      change_1m: snap.change_1m,
      pe_ratio: fin?.pe_ratio ?? 0,
      revenue_growth: fin?.revenue_growth ?? 0,
      total_score: snap.total_score,
    });
  }

  // Sort stocks within each group by score
  Object.values(groups).forEach((g) => {
    g.stocks.sort((a, b) => b.total_score - a.total_score);
  });

  const groupEntries = Object.entries(groups).sort(
    ([, a], [, b]) => {
      const avgA = a.stocks.reduce((s, st) => s + st.total_score, 0) / a.stocks.length;
      const avgB = b.stocks.reduce((s, st) => s + st.total_score, 0) / b.stocks.length;
      return avgB - avgA;
    }
  );

  return (
    <div className="px-4 pt-4">
      <h1 className="text-lg font-mono font-extrabold tracking-wider mb-1">INDUSTRY VIEW</h1>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-5">
        Peer comparison by sector and industry
      </p>

      <div className="space-y-6">
        {groupEntries.map(([key, group]) => {
          const avgScore = Math.round(
            group.stocks.reduce((s, st) => s + st.total_score, 0) / group.stocks.length
          );
          const avgReturn = group.stocks.reduce((s, st) => s + st.change_1m, 0) / group.stocks.length;

          return (
            <section key={key}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="font-mono font-bold text-sm">{key}</h2>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{group.sector}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono ${getChangeColor(avgReturn)}`}>
                    Avg {formatPercent(avgReturn, 1)}
                  </span>
                  <span className={`score-pill text-xs ${getScoreColor(avgScore)}`}>
                    {avgScore}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                {group.stocks.map((stock, i) => (
                  <a
                    key={stock.symbol}
                    href={`/stocks/${stock.symbol}`}
                    className="card-interactive flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] w-4">
                        {i + 1}
                      </span>
                      <div>
                        <span className="font-mono font-bold text-sm">{stock.symbol}</span>
                        <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                          {stock.company_name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <div className="text-[hsl(var(--muted-foreground))]">P/E</div>
                        <div>{stock.pe_ratio?.toFixed(1) || "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[hsl(var(--muted-foreground))]">1M</div>
                        <div className={getChangeColor(stock.change_1m)}>
                          {formatPercent(stock.change_1m, 1)}
                        </div>
                      </div>
                      <span className={`font-bold ${getScoreColor(stock.total_score)}`}>
                        {Math.round(stock.total_score)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
