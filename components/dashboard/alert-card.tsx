import type { Alert } from "@/types";
import { cn, timeAgo } from "@/lib/utils";

const severityStyles: Record<string, string> = {
  info: "border-l-blue-400 bg-blue-500/5",
  watch: "border-l-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5",
  warning: "border-l-yellow-400 bg-yellow-500/5",
  critical: "border-l-red-400 bg-red-500/5",
};

export function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div
      className={cn(
        "border-l-2 rounded-r-lg p-3",
        "bg-[hsl(var(--card))] border border-[hsl(var(--border))]",
        severityStyles[alert.severity]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono font-bold text-xs">{alert.symbol}</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {alert.alert_type}
            </span>
          </div>
          <p className="text-sm font-medium leading-snug truncate">{alert.title}</p>
          {alert.body && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
              {alert.body}
            </p>
          )}
        </div>
        <span className="text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap">
          {timeAgo(alert.created_at)}
        </span>
      </div>
    </div>
  );
}
