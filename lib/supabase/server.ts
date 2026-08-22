import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role client. It bypasses every RLS policy and holds the only
 * grants on game_events and the append functions, so it must never be
 * constructed anywhere a browser can reach. The `server-only` import above
 * turns an accidental client-component import into a build error.
 */

let cached: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be set. See .env.example.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
