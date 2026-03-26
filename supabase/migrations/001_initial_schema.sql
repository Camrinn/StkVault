-- ═══════════════════════════════════════════════════════════════════════════
-- STKVAULT Database Schema
-- Run against Supabase Postgres
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ─── Users ──────────────────────────────────────────────────────────────────
create table public.users (
  id          uuid primary key default uuid_generate_v4(),
  email       text unique not null,
  name        text not null default '',
  role        text not null default 'member' check (role in ('admin', 'member')),
  created_at  timestamptz not null default now()
);

-- Sync from Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'member'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Tracked Symbols (Admin-controlled universe) ────────────────────────────
create table public.tracked_symbols (
  id               uuid primary key default uuid_generate_v4(),
  symbol           text unique not null,
  company_name     text not null,
  is_active        boolean not null default true,
  display_order    int not null default 0,
  sector           text not null default '',
  industry         text not null default '',
  primary_exchange text not null default 'NASDAQ',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_tracked_symbols_active on public.tracked_symbols (is_active, display_order);

-- ─── Symbol Peers ───────────────────────────────────────────────────────────
create table public.symbol_peers (
  id           uuid primary key default uuid_generate_v4(),
  symbol       text not null references public.tracked_symbols(symbol) on delete cascade,
  peer_symbol  text not null,
  created_at   timestamptz not null default now(),
  unique(symbol, peer_symbol)
);

create index idx_symbol_peers_symbol on public.symbol_peers (symbol);

-- ─── Symbol Snapshots (Hourly) ──────────────────────────────────────────────
create table public.symbol_snapshots (
  id                   uuid primary key default uuid_generate_v4(),
  symbol               text not null references public.tracked_symbols(symbol) on delete cascade,
  snapshot_time        timestamptz not null default now(),
  price                numeric not null,
  change_1d            numeric default 0,
  change_1w            numeric default 0,
  change_1m            numeric default 0,
  change_3m            numeric default 0,
  change_1y            numeric default 0,
  volume               bigint default 0,
  avg_volume           bigint default 0,
  market_cap           bigint default 0,
  fifty_two_week_high  numeric default 0,
  fifty_two_week_low   numeric default 0,
  rsi                  numeric default 50,
  ma_20                numeric default 0,
  ma_50                numeric default 0,
  ma_200               numeric default 0,
  volatility_30d       numeric default 0,
  drawdown_from_high   numeric default 0,
  -- Scores (0-100 scale)
  trend_score          numeric default 50,
  setup_score          numeric default 50,
  valuation_score      numeric default 50,
  earnings_score       numeric default 50,
  industry_score       numeric default 50,
  risk_score           numeric default 50,
  total_score          numeric default 50
);

create index idx_snapshots_symbol_time on public.symbol_snapshots (symbol, snapshot_time desc);
create index idx_snapshots_latest on public.symbol_snapshots (symbol, snapshot_time desc)
  include (price, change_1d, total_score);

-- Helper view: latest snapshot per symbol
create or replace view public.latest_snapshots as
select distinct on (symbol) *
from public.symbol_snapshots
order by symbol, snapshot_time desc;

-- ─── Financial Metrics ──────────────────────────────────────────────────────
create table public.financial_metrics (
  id               uuid primary key default uuid_generate_v4(),
  symbol           text not null references public.tracked_symbols(symbol) on delete cascade,
  as_of_date       date not null,
  revenue          numeric,
  revenue_growth   numeric,
  gross_margin     numeric,
  operating_margin numeric,
  net_margin       numeric,
  eps              numeric,
  pe_ratio         numeric,
  ps_ratio         numeric,
  ev_to_revenue    numeric,
  debt_to_equity   numeric,
  free_cash_flow   numeric,
  source           text default 'fmp',
  created_at       timestamptz not null default now(),
  unique(symbol, as_of_date, source)
);

create index idx_financials_symbol on public.financial_metrics (symbol, as_of_date desc);

-- Helper view: latest financials per symbol
create or replace view public.latest_financials as
select distinct on (symbol) *
from public.financial_metrics
order by symbol, as_of_date desc;

-- ─── Earnings Events ────────────────────────────────────────────────────────
create table public.earnings_events (
  id                  uuid primary key default uuid_generate_v4(),
  symbol              text not null references public.tracked_symbols(symbol) on delete cascade,
  report_date         date not null,
  fiscal_period       text not null default '',
  estimated_eps       numeric,
  actual_eps          numeric,
  estimated_revenue   numeric,
  actual_revenue      numeric,
  eps_surprise        numeric,
  revenue_surprise    numeric,
  price_reaction_1d   numeric,
  price_reaction_5d   numeric,
  price_reaction_20d  numeric,
  created_at          timestamptz not null default now(),
  unique(symbol, report_date, fiscal_period)
);

create index idx_earnings_symbol on public.earnings_events (symbol, report_date desc);
create index idx_earnings_upcoming on public.earnings_events (report_date)
  where actual_eps is null;

-- ─── Industry Benchmarks ────────────────────────────────────────────────────
create table public.industry_benchmarks (
  id                       uuid primary key default uuid_generate_v4(),
  sector                   text not null,
  industry                 text not null,
  as_of_date               date not null,
  median_revenue_growth    numeric,
  median_pe_ratio          numeric,
  median_ps_ratio          numeric,
  median_operating_margin  numeric,
  leader_symbol            text,
  laggard_symbol           text,
  created_at               timestamptz not null default now(),
  unique(industry, as_of_date)
);

-- ─── Entry Zones ────────────────────────────────────────────────────────────
create table public.entry_zones (
  id                    uuid primary key default uuid_generate_v4(),
  symbol                text not null references public.tracked_symbols(symbol) on delete cascade,
  as_of_time            timestamptz not null default now(),
  current_zone          text not null default 'fair' check (current_zone in ('extended','fair','pullback','support_test')),
  aggressive_entry_low  numeric not null default 0,
  aggressive_entry_high numeric not null default 0,
  patient_entry_low     numeric not null default 0,
  patient_entry_high    numeric not null default 0,
  invalidation_price    numeric not null default 0,
  risk_label            text not null default 'moderate' check (risk_label in ('low','moderate','elevated','high')),
  summary               text not null default ''
);

create index idx_entry_zones_symbol on public.entry_zones (symbol, as_of_time desc);

-- Helper view: latest entry zone per symbol
create or replace view public.latest_entry_zones as
select distinct on (symbol) *
from public.entry_zones
order by symbol, as_of_time desc;

-- ─── Alerts ─────────────────────────────────────────────────────────────────
create table public.alerts (
  id          uuid primary key default uuid_generate_v4(),
  symbol      text not null references public.tracked_symbols(symbol) on delete cascade,
  alert_type  text not null,
  title       text not null,
  body        text not null default '',
  severity    text not null default 'info' check (severity in ('info','watch','warning','critical')),
  created_at  timestamptz not null default now(),
  is_active   boolean not null default true
);

create index idx_alerts_active on public.alerts (is_active, created_at desc);
create index idx_alerts_symbol on public.alerts (symbol, created_at desc);

-- ─── Watchlists ─────────────────────────────────────────────────────────────
create table public.watchlists (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  symbol     text not null references public.tracked_symbols(symbol) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, symbol)
);

create index idx_watchlists_user on public.watchlists (user_id);

-- ─── Notes ──────────────────────────────────────────────────────────────────
create table public.notes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  symbol     text not null references public.tracked_symbols(symbol) on delete cascade,
  note_type  text not null default 'general' check (note_type in ('general','bull_case','bear_case','catalyst','admin_thesis')),
  content    text not null default '',
  is_pinned  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_notes_symbol on public.notes (symbol, created_at desc);
create index idx_notes_user on public.notes (user_id, created_at desc);

-- ─── Refresh Jobs ───────────────────────────────────────────────────────────
create table public.refresh_jobs (
  id          uuid primary key default uuid_generate_v4(),
  job_type    text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running','completed','failed')),
  details     jsonb default '{}'
);

create index idx_refresh_jobs_type on public.refresh_jobs (job_type, started_at desc);

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.tracked_symbols enable row level security;
alter table public.symbol_snapshots enable row level security;
alter table public.financial_metrics enable row level security;
alter table public.earnings_events enable row level security;
alter table public.entry_zones enable row level security;
alter table public.alerts enable row level security;
alter table public.watchlists enable row level security;
alter table public.notes enable row level security;
alter table public.industry_benchmarks enable row level security;

-- Read access for authenticated users on shared data
create policy "Authenticated read" on public.tracked_symbols   for select to authenticated using (true);
create policy "Authenticated read" on public.symbol_snapshots   for select to authenticated using (true);
create policy "Authenticated read" on public.financial_metrics  for select to authenticated using (true);
create policy "Authenticated read" on public.earnings_events    for select to authenticated using (true);
create policy "Authenticated read" on public.entry_zones        for select to authenticated using (true);
create policy "Authenticated read" on public.alerts             for select to authenticated using (true);
create policy "Authenticated read" on public.industry_benchmarks for select to authenticated using (true);
create policy "Authenticated read" on public.notes              for select to authenticated using (true);

-- Users can read their own profile
create policy "Own profile" on public.users for select to authenticated
  using (auth.uid() = id);

-- Watchlists: users see/manage their own
create policy "Own watchlist read" on public.watchlists for select to authenticated
  using (auth.uid() = user_id);
create policy "Own watchlist insert" on public.watchlists for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Own watchlist delete" on public.watchlists for delete to authenticated
  using (auth.uid() = user_id);

-- Notes: users manage their own, read all
create policy "Own notes insert" on public.notes for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Own notes update" on public.notes for update to authenticated
  using (auth.uid() = user_id);
create policy "Own notes delete" on public.notes for delete to authenticated
  using (auth.uid() = user_id);

-- Admin write policies (use service role key for cron/admin writes)
-- Admin checks happen at the API layer using the service role client

-- ─── Updated-at trigger ─────────────────────────────────────────────────────
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.tracked_symbols
  for each row execute function public.update_updated_at();

create trigger set_updated_at before update on public.notes
  for each row execute function public.update_updated_at();
