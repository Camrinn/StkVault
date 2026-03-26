import type { EarningsEvent } from "@/types";
import { formatDate } from "@/lib/utils";

export function EarningsRow({
  event,
  isLast,
}: {
  event: EarningsEvent & { company_name: string };
  isLast: boolean;
}) {
  return (
    <a
      href={`/stocks/${event.symbol}`}
      className={`flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))]/30 transition-colors ${
        !isLast ? "border-b border-[hsl(var(--border))]" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent))]/10 flex items-center justify-center">
          <span className="font-mono font-bold text-xs text-[hsl(var(--accent))]">
            {event.symbol.slice(0, 3)}
          </span>
        </div>
        <div>
          <div className="font-mono font-bold text-sm">{event.symbol}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] truncate max-w-[140px]">
            {event.company_name}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono font-medium">
          {formatDate(event.report_date)}
        </div>
        {event.estimated_eps != null && (
          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Est. ${event.estimated_eps.toFixed(2)} EPS
          </div>
        )}
      </div>
    </a>
  );
}
