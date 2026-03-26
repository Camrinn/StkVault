import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("notes")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  }
);

export const DELETE = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth();
    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  }
);
