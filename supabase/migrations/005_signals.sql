-- ═══════════════════════════════════════════════════════════════════════════
-- STKVAULT Signals Schema
-- Tables: insider_transactions, short_interest, chart_patterns
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Insider Transactions (SEC Form 4) ──────────────────────────────────────
create table public.insider_transactions (
  id               uuid primary key default uuid_generate_v4(),
  symbol           text not null references public.tracked_symbols(symbol) on delete cascade,
  insider_name     text not null default '',
  insider_title    text not null default '',
  transaction_type text not null default 'P',  -- 'P'=purchase, 'S'=sale
  shares           numeric not null default 0,
  price_per_share  numeric not null default 0,
  total_value      numeric not null default 0,
  transaction_date date not null,
  filing_date      date,
  sec_link         text default '',
  created_at       timestamptz not null default now(),
  unique(symbol, insider_name, transaction_date, shares)
);

create index idx_insider_symbol on public.insider_transactions (symbol, transaction_date desc);
create index idx_insider_recent  on public.insider_transactions (transaction_date desc, total_value desc);

-- ─── Short Interest ───────────────────────────────────────────────────────────
create table public.short_interest (
  id              uuid primary key default uuid_generate_v4(),
  symbol          text not null references public.tracked_symbols(symbol) on delete cascade,
  short_float_pct numeric not null default 0,
  short_ratio     numeric not null default 0,
  fetched_at      timestamptz not null default now()
);

create index idx_short_interest_symbol on public.short_interest (symbol, fetched_at desc);

create or replace view public.latest_short_interest as
select distinct on (symbol) *
from public.short_interest
order by symbol, fetched_at desc;

-- ─── Chart Patterns ──────────────────────────────────────────────────────────
create table public.chart_patterns (
  id                  uuid primary key default uuid_generate_v4(),
  symbol              text not null references public.tracked_symbols(symbol) on delete cascade,
  pattern_type        text not null,  -- 'bull_flag', 'breakout', 'cup_and_handle'
  confidence          numeric not null default 0,  -- 0-100
  detected_at         timestamptz not null default now(),
  price_at_detection  numeric not null default 0,
  description         text not null default '',
  is_active           boolean not null default true
);

create index idx_patterns_symbol on public.chart_patterns (symbol, detected_at desc);
create index idx_patterns_active  on public.chart_patterns (is_active, detected_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.insider_transactions enable row level security;
alter table public.short_interest       enable row level security;
alter table public.chart_patterns       enable row level security;

create policy "Authenticated read" on public.insider_transactions for select to authenticated using (true);
create policy "Authenticated read" on public.short_interest       for select to authenticated using (true);
create policy "Authenticated read" on public.chart_patterns       for select to authenticated using (true);
