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
  { symbol: "AAPL",  company_name: "Apple Inc.",              sector: "Technology",        industry: "Consumer Electronics",   display_order: 1 },
  { symbol: "NVDA",  company_name: "NVIDIA Corporation",      sector: "Technology",        industry: "Semiconductors",         display_order: 2 },
  { symbol: "MSFT",  company_name: "Microsoft Corporation",   sector: "Technology",        industry: "Software",               display_order: 3 },
  { symbol: "AMZN",  company_name: "Amazon.com Inc.",         sector: "Consumer Cyclical", industry: "Internet Retail",         display_order: 4 },
  { symbol: "TSLA",  company_name: "Tesla Inc.",              sector: "Consumer Cyclical", industry: "Auto Manufacturers",      display_order: 5 },
  { symbol: "GOOGL", company_name: "Alphabet Inc.",           sector: "Technology",        industry: "Internet Content",        display_order: 6 },
  { symbol: "META",  company_name: "Meta Platforms Inc.",     sector: "Technology",        industry: "Internet Content",        display_order: 7 },
  { symbol: "AMD",   company_name: "Advanced Micro Devices",  sector: "Technology",        industry: "Semiconductors",         display_order: 8 },
];

const PEERS = [
  { symbol: "NVDA", peer_symbol: "AMD" },
  { symbol: "AMD",  peer_symbol: "NVDA" },
  { symbol: "GOOGL", peer_symbol: "META" },
  { symbol: "META", peer_symbol: "GOOGL" },
  { symbol: "AAPL", peer_symbol: "MSFT" },
  { symbol: "MSFT", peer_symbol: "AAPL" },
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
