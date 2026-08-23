"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * The client the browser gets: publishable key only, so every read it makes is
 * decided by RLS. It can never see a game the signed-in player is not in, and
 * it has no write path to the event log at all.
 */
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and _PUBLISHABLE_KEY must be set");
  }
  return createBrowserClient(url, key);
}
