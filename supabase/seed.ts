/**
 * Seed script — populates the tracked_symbols table with a starter universe.
 *
 * Run: npx tsx supabase/seed.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STARTER_STOCKS = [
  // ── Mega-cap Tech ──────────────────────────────────────────────────────────
  { symbol: "AAPL",  company_name: "Apple Inc.",                  sector: "Technology",             industry: "Consumer Electronics",  display_order: 1 },
  { symbol: "NVDA",  company_name: "NVIDIA Corporation",          sector: "Technology",             industry: "Semiconductors",        display_order: 2 },
  { symbol: "MSFT",  company_name: "Microsoft Corporation",       sector: "Technology",             industry: "Software",              display_order: 3 },
  { symbol: "AMZN",  company_name: "Amazon.com Inc.",             sector: "Consumer Cyclical",      industry: "Internet Retail",       display_order: 4 },
  { symbol: "TSLA",  company_name: "Tesla Inc.",                  sector: "Consumer Cyclical",      industry: "Auto Manufacturers",    display_order: 5 },
  { symbol: "GOOGL", company_name: "Alphabet Inc.",               sector: "Technology",             industry: "Internet Content",      display_order: 6 },
  { symbol: "META",  company_name: "Meta Platforms Inc.",         sector: "Technology",             industry: "Internet Content",      display_order: 7 },
  { symbol: "AMD",   company_name: "Advanced Micro Devices",      sector: "Technology",             industry: "Semiconductors",        display_order: 8 },
  // ── Semiconductors ─────────────────────────────────────────────────────────
  { symbol: "AVGO",  company_name: "Broadcom Inc.",               sector: "Technology",             industry: "Semiconductors",        display_order: 9 },
  { symbol: "QCOM",  company_name: "Qualcomm Inc.",               sector: "Technology",             industry: "Semiconductors",        display_order: 10 },
  { symbol: "INTC",  company_name: "Intel Corporation",           sector: "Technology",             industry: "Semiconductors",        display_order: 11 },
  // ── Software & Cloud ───────────────────────────────────────────────────────
  { symbol: "ORCL",  company_name: "Oracle Corporation",          sector: "Technology",             industry: "Software",              display_order: 12 },
  { symbol: "CRM",   company_name: "Salesforce Inc.",             sector: "Technology",             industry: "Software",              display_order: 13 },
  { symbol: "ADBE",  company_name: "Adobe Inc.",                  sector: "Technology",             industry: "Software",              display_order: 14 },
  { symbol: "NOW",   company_name: "ServiceNow Inc.",             sector: "Technology",             industry: "Software",              display_order: 15 },
  { symbol: "SNOW",  company_name: "Snowflake Inc.",              sector: "Technology",             industry: "Software",              display_order: 16 },
  { symbol: "PLTR",  company_name: "Palantir Technologies",       sector: "Technology",             industry: "Software",              display_order: 17 },
  // ── Financial Services ─────────────────────────────────────────────────────
  { symbol: "JPM",   company_name: "JPMorgan Chase & Co.",        sector: "Financial Services",     industry: "Banks",                 display_order: 18 },
  { symbol: "BAC",   company_name: "Bank of America Corp.",       sector: "Financial Services",     industry: "Banks",                 display_order: 19 },
  { symbol: "GS",    company_name: "Goldman Sachs Group",         sector: "Financial Services",     industry: "Capital Markets",       display_order: 20 },
  { symbol: "V",     company_name: "Visa Inc.",                   sector: "Financial Services",     industry: "Credit Services",       display_order: 21 },
  { symbol: "MA",    company_name: "Mastercard Inc.",             sector: "Financial Services",     industry: "Credit Services",       display_order: 22 },
  // ── Healthcare ─────────────────────────────────────────────────────────────
  { symbol: "LLY",   company_name: "Eli Lilly and Company",       sector: "Healthcare",             industry: "Drug Manufacturers",    display_order: 23 },
  { symbol: "UNH",   company_name: "UnitedHealth Group Inc.",     sector: "Healthcare",             industry: "Healthcare Plans",      display_order: 24 },
  { symbol: "JNJ",   company_name: "Johnson & Johnson",           sector: "Healthcare",             industry: "Drug Manufacturers",    display_order: 25 },
  // ── Consumer ───────────────────────────────────────────────────────────────
  { symbol: "WMT",   company_name: "Walmart Inc.",                sector: "Consumer Defensive",     industry: "Discount Stores",       display_order: 26 },
  { symbol: "COST",  company_name: "Costco Wholesale Corp.",      sector: "Consumer Defensive",     industry: "Discount Stores",       display_order: 27 },
  { symbol: "MCD",   company_name: "McDonald's Corporation",      sector: "Consumer Cyclical",      industry: "Restaurants",           display_order: 28 },
  { symbol: "NKE",   company_name: "Nike Inc.",                   sector: "Consumer Cyclical",      industry: "Footwear",              display_order: 29 },
  // ── Energy ─────────────────────────────────────────────────────────────────
  { symbol: "XOM",   company_name: "Exxon Mobil Corporation",     sector: "Energy",                 industry: "Oil & Gas",             display_order: 30 },
  { symbol: "CVX",   company_name: "Chevron Corporation",         sector: "Energy",                 industry: "Oil & Gas",             display_order: 31 },
  // ── Media & Entertainment ──────────────────────────────────────────────────
  { symbol: "NFLX",  company_name: "Netflix Inc.",                sector: "Communication Services", industry: "Entertainment",         display_order: 32 },
  { symbol: "DIS",   company_name: "The Walt Disney Company",     sector: "Communication Services", industry: "Entertainment",         display_order: 33 },
  { symbol: "SPOT",  company_name: "Spotify Technology S.A.",     sector: "Communication Services", industry: "Entertainment",         display_order: 34 },
  // ── Industrials ────────────────────────────────────────────────────────────
  { symbol: "CAT",   company_name: "Caterpillar Inc.",            sector: "Industrials",            industry: "Farm & Heavy Equipment",display_order: 35 },
  { symbol: "BA",    company_name: "Boeing Company",              sector: "Industrials",            industry: "Aerospace & Defense",   display_order: 36 },
  // ── Mobility ───────────────────────────────────────────────────────────────
  { symbol: "UBER",  company_name: "Uber Technologies Inc.",      sector: "Technology",             industry: "Software",              display_order: 37 },
  { symbol: "SBUX",  company_name: "Starbucks Corporation",       sector: "Consumer Cyclical",      industry: "Restaurants",           display_order: 38 },
];

const PEERS = [
  // Semiconductors
  { symbol: "NVDA",  peer_symbol: "AMD"   }, { symbol: "AMD",   peer_symbol: "NVDA"  },
  { symbol: "NVDA",  peer_symbol: "AVGO"  }, { symbol: "AVGO",  peer_symbol: "NVDA"  },
  { symbol: "AMD",   peer_symbol: "INTC"  }, { symbol: "INTC",  peer_symbol: "AMD"   },
  { symbol: "AMD",   peer_symbol: "QCOM"  }, { symbol: "QCOM",  peer_symbol: "AMD"   },
  { symbol: "AVGO",  peer_symbol: "QCOM"  }, { symbol: "QCOM",  peer_symbol: "AVGO"  },
  { symbol: "INTC",  peer_symbol: "QCOM"  }, { symbol: "QCOM",  peer_symbol: "INTC"  },
  // Software
  { symbol: "MSFT",  peer_symbol: "ORCL"  }, { symbol: "ORCL",  peer_symbol: "MSFT"  },
  { symbol: "MSFT",  peer_symbol: "CRM"   }, { symbol: "CRM",   peer_symbol: "MSFT"  },
  { symbol: "CRM",   peer_symbol: "NOW"   }, { symbol: "NOW",   peer_symbol: "CRM"   },
  { symbol: "CRM",   peer_symbol: "ADBE"  }, { symbol: "ADBE",  peer_symbol: "CRM"   },
  { symbol: "SNOW",  peer_symbol: "PLTR"  }, { symbol: "PLTR",  peer_symbol: "SNOW"  },
  // Internet Content
  { symbol: "GOOGL", peer_symbol: "META"  }, { symbol: "META",  peer_symbol: "GOOGL" },
  // Consumer Electronics
  { symbol: "AAPL",  peer_symbol: "MSFT"  }, { symbol: "MSFT",  peer_symbol: "AAPL"  },
  // Banks
  { symbol: "JPM",   peer_symbol: "BAC"   }, { symbol: "BAC",   peer_symbol: "JPM"   },
  { symbol: "JPM",   peer_symbol: "GS"    }, { symbol: "GS",    peer_symbol: "JPM"   },
  // Credit Services
  { symbol: "V",     peer_symbol: "MA"    }, { symbol: "MA",    peer_symbol: "V"     },
  // Healthcare
  { symbol: "LLY",   peer_symbol: "JNJ"   }, { symbol: "JNJ",   peer_symbol: "LLY"   },
  { symbol: "UNH",   peer_symbol: "JNJ"   }, { symbol: "JNJ",   peer_symbol: "UNH"   },
  // Consumer Defensive
  { symbol: "WMT",   peer_symbol: "COST"  }, { symbol: "COST",  peer_symbol: "WMT"   },
  // Restaurants
  { symbol: "MCD",   peer_symbol: "SBUX"  }, { symbol: "SBUX",  peer_symbol: "MCD"   },
  // Energy
  { symbol: "XOM",   peer_symbol: "CVX"   }, { symbol: "CVX",   peer_symbol: "XOM"   },
  // Entertainment
  { symbol: "NFLX",  peer_symbol: "DIS"   }, { symbol: "DIS",   peer_symbol: "NFLX"  },
  { symbol: "NFLX",  peer_symbol: "SPOT"  }, { symbol: "SPOT",  peer_symbol: "NFLX"  },
  // Auto / Mobility
  { symbol: "TSLA",  peer_symbol: "UBER"  }, { symbol: "UBER",  peer_symbol: "TSLA"  },
  // Industrials
  { symbol: "CAT",   peer_symbol: "BA"    }, { symbol: "BA",    peer_symbol: "CAT"   },
];

async function seed() {
  console.log("Seeding tracked_symbols...");
  const { error: symError } = await supabase
    .from("tracked_symbols")
    .upsert(
      STARTER_STOCKS.map((s) => ({
        ...s,
        is_active: true,
        primary_exchange: "NASDAQ",
      })),
      { onConflict: "symbol" }
    );

  if (symError) {
    console.error("Error seeding symbols:", symError);
    process.exit(1);
  }
  console.log(`  ✓ ${STARTER_STOCKS.length} symbols upserted`);

  console.log("Seeding symbol_peers...");
  const { error: peerError } = await supabase
    .from("symbol_peers")
    .upsert(PEERS, { onConflict: "symbol,peer_symbol" });

  if (peerError) {
    console.error("Error seeding peers:", peerError);
    process.exit(1);
  }
  console.log(`  ✓ ${PEERS.length} peer relationships created`);

  console.log("\nDone! Run the hourly refresh to pull initial data:");
  console.log("  curl -H 'Authorization: Bearer YOUR_CRON_SECRET' http://localhost:3000/api/cron/hourly-refresh");
}

seed();
