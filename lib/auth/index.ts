import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { User, UserRole } from "@/types";

/**
 * Create a Supabase client for server-side route handlers.
 * Reads the auth cookie automatically.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// AUTH DISABLED — mock user for local dev
const DEV_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@localhost",
  name: "Dev User",
  role: "admin",
  created_at: new Date().toISOString(),
};

export async function getCurrentUser(): Promise<User | null> {
  return DEV_USER;
}

export async function requireAuth(): Promise<User> {
  return DEV_USER;
}

export async function requireRole(_role: UserRole): Promise<User> {
  return DEV_USER;
}

/**
 * Verify the cron secret for scheduled jobs.
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return authHeader === expected;
}

/**
 * Custom error class for auth failures.
 */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Wrap a route handler with error handling.
 */
export function withErrorHandler(
  handler: (req: NextRequest, ctx: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: any) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.status }
        );
      }
      console.error("API Error:", err instanceof Error ? err.message : JSON.stringify(err));
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
