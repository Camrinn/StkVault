-- Walter Bloomberg tweet store
create table public.walter_tweets (
  id          text primary key,
  text        text not null,
  created_at  timestamptz not null,
  likes       int not null default 0,
  retweets    int not null default 0,
  replies     int not null default 0,
  is_retweet  boolean not null default false,
  has_trump   boolean not null default false,
  fetched_at  timestamptz not null default now()
);

create index idx_walter_tweets_created on public.walter_tweets (created_at desc);
create index idx_walter_tweets_trump on public.walter_tweets (has_trump, created_at desc);

alter table public.walter_tweets enable row level security;
create policy "Service role full access" on public.walter_tweets
  using (true) with check (true);
