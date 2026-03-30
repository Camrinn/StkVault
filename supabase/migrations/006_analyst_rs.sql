-- ═══════════════════════════════════════════════════════════════════════════
-- STKVAULT Analyst Actions + Relative Strength Schema
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Analyst Actions (upgrades, downgrades, price targets) ──────────────────
create table public.analyst_actions (
  id            uuid primary key default uuid_generate_v4(),
  symbol        text not null references public.tracked_symbols(symbol) on delete cascade,
  analyst_firm  text not null default '',
  analyst_name  text not null default '',
  -- upgrade | downgrade | initiation | reiterate | target_raise | target_cut
  action_type   text not null,
  from_rating   text not null default '',
  to_rating     text not null default '',
  old_target    numeric,
  new_target    numeric,
  action_date   date not null,
  created_at    timestamptz not null default now(),
  unique(symbol, analyst_firm, action_date, to_rating)
);

create index idx_analyst_symbol on public.analyst_actions (symbol, action_date desc);
create index idx_analyst_recent  on public.analyst_actions (action_date desc);

-- ─── Relative Strength vs S&P 500 ────────────────────────────────────────────
-- Added as a column on the existing snapshot table.
-- rs_vs_spy = stock 3m return minus SPY 3m return (percentage points)
-- Positive = outperforming S&P 500; Negative = underperforming
alter table public.symbol_snapshots
  add column if not exists rs_vs_spy numeric default 0;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.analyst_actions enable row level security;
create policy "Authenticated read" on public.analyst_actions for select to authenticated using (true);
