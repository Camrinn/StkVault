import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";

export const GET = withErrorHandler(async () => {
  const user = await requireAuth();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("watchlists")
    .select("*, tracked_symbols(symbol, company_name, sector)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return NextResponse.json(data);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth();
  const { symbol } = await req.json();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("watchlists")
    .insert({ user_id: user.id, symbol })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already in watchlist" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json(data, { status: 201 });
});
