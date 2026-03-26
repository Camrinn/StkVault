# STKVAULT — Deep Stock Research Engine

A mobile-first stock research platform for you and your crew. Admin-controlled stock universe with hourly data refreshes, composite scoring, entry zone analysis, earnings intelligence, and shared notes.

**This is a research platform, not a trading app.** It surfaces data and analysis — it does not recommend trades.

---

## Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Polygon.io](https://polygon.io) API key (free tier: 5 calls/min)
- A [Financial Modeling Prep](https://financialmodelingprep.com) API key (free tier available)
- Optional: [Upstash Redis](https://upstash.com) for caching (free tier works)

### 1. Clone and install

```bash
git clone <your-repo>
cd stkvault
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration:

```bash
# Copy the contents of supabase/migrations/001_initial_schema.sql
# and paste it into the Supabase SQL editor, then run it
```

3. Go to **Settings → API** and copy your project URL, anon key, and service role key

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in your keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
POLYGON_API_KEY=your_key
FMP_API_KEY=your_key
CRON_SECRET=generate-a-random-string-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For Redis caching (optional but recommended):
```
UPSTASH_REDIS_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_TOKEN=your_token
```

### 4. Seed the database

```bash
npx tsx supabase/seed.ts
```

This adds 8 starter stocks (AAPL, NVDA, MSFT, AMZN, TSLA, GOOGL, META, AMD) with peer relationships.

### 5. Create the first admin user

1. Start the dev server: `npm run dev`
2. Go to `http://localhost:3000` — you'll see the login page
3. Sign in with your email (magic link)
4. In Supabase dashboard, go to **Table Editor → users** and change your role to `admin`

### 6. Run the first data refresh

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/hourly-refresh
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/fundamentals-refresh
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/earnings-refresh
```

Or use the Admin page in the app to trigger refreshes manually.

### 7. Deploy to Vercel

```bash
npx vercel
```

Set your environment variables in the Vercel dashboard. The `vercel.json` file configures cron jobs automatically.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Mobile Client (Next.js React)              │
│  ├── Dashboard (home)                       │
│  ├── Stock List                             │
│  ├── Stock Detail (scores, chart, zones)    │
│  ├── Industry View (peer comparison)        │
│  ├── Calendar (earnings, alerts)            │
│  ├── Watchlist (per-user)                   │
│  └── Admin (manage universe)                │
├─────────────────────────────────────────────┤
│  API Layer (Next.js Route Handlers)         │
│  ├── /api/dashboard                         │
│  ├── /api/stocks/[symbol]/*                 │
│  ├── /api/watchlist                         │
│  ├── /api/notes                             │
│  ├── /api/admin/*                           │
│  └── /api/cron/* (scheduled jobs)           │
├─────────────────────────────────────────────┤
│  Data Layer                                 │
│  ├── Polygon.io (prices, OHLCV, technicals) │
│  ├── FMP (earnings, metrics, profiles)      │
│  ├── Supabase Postgres (all app data)       │
│  └── Upstash Redis (response caching)       │
├─────────────────────────────────────────────┤
│  Intelligence Layer                         │
│  ├── Scoring Engine (6-factor composite)    │
│  ├── Entry Zone Engine (technical zones)    │
│  └── Alert Generator (automated alerts)     │
└─────────────────────────────────────────────┘
```

## Scoring Model

Each stock gets a 0–100 composite score:

| Factor     | Weight | What it measures                              |
|------------|--------|-----------------------------------------------|
| Trend      | 30%    | MA alignment, returns, volume, RSI, drawdown  |
| Earnings   | 20%    | EPS/revenue beats, streaks, price reactions    |
| Valuation  | 15%    | P/E, P/S vs peer medians, margin quality      |
| Industry   | 15%    | Sector strength, peer leadership               |
| Quality    | 10%    | Margins, FCF, debt levels                      |
| Risk       | 10%    | Volatility, drawdown, earnings volatility      |

**Labels:** 85+ Prime Setup · 70–84 Strong Watch · 55–69 Neutral · 40–54 Risky · <40 Avoid

## Entry Zones

The entry zone engine classifies each stock into:

- **Extended** — stretched above MAs, higher risk entry
- **Fair** — near moving averages, balanced risk/reward
- **Pullback** — pulled back to area of interest
- **Support Test** — testing key support, higher risk/reward

Each zone includes aggressive entry band, patient entry band, and an invalidation price.

## Cron Schedule

| Job                    | Frequency   | What it does                               |
|------------------------|-------------|--------------------------------------------|
| Hourly Refresh         | Every hour  | Prices, technicals, scores, alerts         |
| Fundamentals Refresh   | Every 6h    | Financials, ratios, company profiles       |
| Earnings Refresh       | Every 4h    | Earnings calendar, surprises, reactions    |
| Rebuild Benchmarks     | Weekly (Mon)| Industry medians and leader/laggard ranking|
| Recompute Entry Zones  | Every 30min | Recalculate entry zone levels              |

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Lightweight Charts (TradingView)
- **Database:** Supabase (Postgres + Auth + RLS)
- **Cache:** Upstash Redis
- **Market Data:** Polygon.io + Financial Modeling Prep
- **Hosting:** Vercel (with cron jobs)

## Folder Structure

```
stkvault/
├── app/
│   ├── (app)/              # Authenticated app pages
│   │   ├── page.tsx        # Dashboard
│   │   ├── stocks/         # Stock list + detail
│   │   ├── industry/       # Peer comparison
│   │   ├── calendar/       # Earnings calendar
│   │   ├── watchlist/      # Personal watchlist
│   │   └── admin/          # Admin controls
│   ├── (marketing)/        # Public pages (login)
│   └── api/                # All API routes + cron
├── components/             # React components
├── lib/
│   ├── auth/               # Auth helpers
│   ├── cache/              # Redis cache layer
│   ├── db/                 # Supabase client + queries
│   ├── entry-zones/        # Entry zone engine
│   ├── market-data/        # Polygon + FMP clients
│   ├── scoring/            # Scoring engine
│   └── utils/              # Formatting, colors, helpers
├── types/                  # TypeScript types
└── supabase/
    ├── migrations/         # SQL schema
    └── seed.ts             # Starter data
```

## API Key Limits (Free Tiers)

- **Polygon.io Free:** 5 API calls/minute — works for ~10 stocks with careful batching
- **FMP Free:** 250 calls/day — sufficient for fundamentals on 10 stocks
- **Supabase Free:** 500MB database, 50K auth users
- **Upstash Free:** 10K commands/day
- **Vercel Hobby:** 1 cron job (you may need Pro for all 5 crons)

For production use with 10 stocks refreshing hourly, the Polygon Starter plan ($29/mo) and FMP Starter plan are recommended.

---

## V1.5 Roadmap

- [ ] Push/email alerts via Supabase Edge Functions
- [ ] Stock thesis templates (structured bull/bear case)
- [ ] Sector leaderboard page
- [ ] Chart overlays (MA lines, entry zone bands)
- [ ] Alert history timeline

## V2 Roadmap

- [ ] AI-generated bull/bear debate cards
- [ ] SEC filing extraction (EDGAR API)
- [ ] Backtested setup patterns
- [ ] Custom peer baskets
- [ ] User portfolio tracking
