import { NextRequest, NextResponse } from "next/server";
import { requireRole, withErrorHandler } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireRole("admin");
    const { symbol } = await params;
    const body = await req.json();
    const db = createServiceClient();

    const { data, error } = await db
      .from("tracked_symbols")
      .update(body)
      .eq("symbol", symbol)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  }
);

export const DELETE = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireRole("admin");
    const { symbol } = await params;
    const db = createServiceClient();

    const { error } = await db
      .from("tracked_symbols")
      .delete()
      .eq("symbol", symbol);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  }
);
