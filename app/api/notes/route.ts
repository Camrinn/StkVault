import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import type { CreateNoteRequest } from "@/types";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const symbol = req.nextUrl.searchParams.get("symbol");
  const supabase = createServiceClient();

  let query = supabase
    .from("notes")
    .select("*, users(name)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (symbol) query = query.eq("symbol", symbol);

  const { data, error } = await query;
  if (error) throw error;

  return NextResponse.json(
    (data ?? []).map((n: any) => ({ ...n, user_name: n.users?.name ?? "Unknown" }))
  );
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth();
  const body: CreateNoteRequest = await req.json();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      symbol: body.symbol,
      note_type: body.note_type,
      content: body.content,
      is_pinned: body.is_pinned ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json(data, { status: 201 });
});
