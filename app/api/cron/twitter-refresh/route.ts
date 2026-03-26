/**
 * Twitter Refresh Cron Job
 * Fetches latest tweets from @DeIaone and upserts into DB.
 * Route: GET /api/cron/twitter-refresh
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import { fetchLatestTweets } from "@/lib/twitter/scraper";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tweets = await fetchLatestTweets(50);
    if (tweets.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("walter_tweets")
      .upsert(tweets, { onConflict: "id" });

    if (error) throw error;

    return NextResponse.json({ ok: true, inserted: tweets.length });
  } catch (err: any) {
    console.error("Twitter refresh failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
