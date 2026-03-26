import { getUpcomingEarnings, getActiveAlerts } from "@/lib/db/queries";
import { formatDate, formatCurrency } from "@/lib/utils";

export default async function CalendarPage() {
  const [earnings, alerts] = await Promise.all([
    getUpcomingEarnings(),
    getActiveAlerts(),
  ]);

  // Group earnings by month
  const byMonth: Record<string, typeof earnings> = {};
  for (const e of earnings) {
    const month = new Date(e.report_date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(e);
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="text-lg font-mono font-extrabold tracking-wider mb-1">CALENDAR</h1>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-5">
        Upcoming earnings and key events
      </p>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <section className="mb-6">
          <h2 className="section-label">◆ ACTIVE ALERTS</h2>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`card-interactive py-3 border-l-2 ${
                  alert.severity === "critical"
                    ? "border-l-bearish"
                    : alert.severity === "warning"
                    ? "border-l-neutral"
                    : "border-l-[hsl(var(--accent))]"
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono font-bold text-xs">{alert.symbol}</span>
                  <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm">{alert.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Earnings calendar */}
      {Object.entries(byMonth).map(([month, events]) => (
        <section key={month} className="mb-6">
          <h2 className="section-label">◆ {month.toUpperCase()}</h2>
          <div className="card-interactive p-0 overflow-hidden">
            {events.map((e, i) => (
              <a
                key={e.id}
                href={`/stocks/${e.symbol}`}
                className={`flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))]/30 transition-colors ${
                  i < events.length - 1 ? "border-b border-[hsl(var(--border))]" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 text-center">
                    <div className="text-lg font-mono font-bold">
                      {new Date(e.report_date).getDate()}
                    </div>
                    <div className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase">
                      {new Date(e.report_date).toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono font-bold text-sm">{e.symbol}</div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {e.company_name}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {e.estimated_eps != null && (
                    <div className="text-xs font-mono">
                      Est. ${e.estimated_eps.toFixed(2)} EPS
                    </div>
                  )}
                  {e.estimated_revenue != null && (
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      Est. {formatCurrency(e.estimated_revenue, true)} Rev
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}

      {earnings.length === 0 && (
        <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-12">
          No upcoming earnings in tracked stocks.
        </p>
      )}
    </div>
  );
}
