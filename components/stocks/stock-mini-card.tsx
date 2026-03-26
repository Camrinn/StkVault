import type { StockCardData } from "@/types";
import { cn, formatCurrency, formatPercent, getChangeColor, getScoreColor } from "@/lib/utils";

export function StockMiniCard({
  stock,
  className,
}: {
  stock: StockCardData;
  className?: string;
}) {
  return (
    <a
      href={`/stocks/${stock.symbol}`}
      className={cn("card-interactive min-w-[160px] flex-shrink-0", className)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono font-bold text-sm">{stock.symbol}</span>
        <span className={cn("text-xs font-mono font-bold", getChangeColor(stock.change_1d))}>
          {formatPercent(stock.change_1d, 1)}
        </span>
      </div>
      <div className="font-mono font-bold text-xl mb-1">
        {formatCurrency(stock.price)}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
          {stock.sector}
        </span>
        <span className={cn("font-mono text-xs font-bold", getScoreColor(stock.total_score))}>
          {Math.round(stock.total_score)}
        </span>
      </div>
    </a>
  );
}
