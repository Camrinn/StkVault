import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase";
import { fetchLatestTweets } from "@/lib/twitter/scraper";

const AUTH_TOKEN = "stkvault_ok";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (request.cookies.get("sv_auth")?.value !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tweets = await fetchLatestTweets(50);
    if (tweets.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("walter_tweets")
      .upsert(tweets, { onConflict: "id" });

    if (error) throw error;

    return NextResponse.json({ ok: true, count: tweets.length });
  } catch (err: any) {
    console.error("Tweet refresh failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
