import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("price_levels")
    .select("*")
    .eq("symbol", symbol.toUpperCase())
    .order("price", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const body = await req.json();
  const { price, initials, direction } = body;

  if (!price || !initials || !direction) {
    return NextResponse.json({ error: "price, initials, and direction are required" }, { status: 400 });
  }
  if (!["up", "down"].includes(direction)) {
    return NextResponse.json({ error: "direction must be up or down" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("price_levels")
    .insert({
      symbol: symbol.toUpperCase(),
      price: Number(price),
      initials: String(initials).slice(0, 2).toUpperCase(),
      direction,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db
    .from("price_levels")
    .delete()
    .eq("id", id)
    .eq("symbol", symbol.toUpperCase());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
