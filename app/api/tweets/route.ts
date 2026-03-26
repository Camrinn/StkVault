import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const keyword = searchParams.get("q")?.trim() ?? "";
  const trump = searchParams.get("trump") === "1";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200);

  const db = createServiceClient();

  let query = db
    .from("walter_tweets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (trump) {
    query = query.eq("has_trump", true);
  }

  if (keyword) {
    query = query.ilike("text", `%${keyword}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return NextResponse.json(data ?? []);
});
