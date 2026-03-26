export function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-4 animate-pulse">
      {/* Alerts skeleton */}
      <section>
        <div className="h-3 w-28 bg-[hsl(var(--muted))] rounded mb-3" />
        <div className="h-16 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]" />
      </section>

      {/* Movers skeleton */}
      <section>
        <div className="h-3 w-32 bg-[hsl(var(--muted))] rounded mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="min-w-[160px] h-24 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]" />
          ))}
        </div>
      </section>

      {/* Setups skeleton */}
      <section>
        <div className="h-3 w-36 bg-[hsl(var(--muted))] rounded mb-3" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 mb-2 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]" />
        ))}
      </section>

      {/* Grid skeleton */}
      <section>
        <div className="h-3 w-28 bg-[hsl(var(--muted))] rounded mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]" />
          ))}
        </div>
      </section>
    </div>
  );
}
