import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Uuid } from "@/lib/events/types";

/**
 * The signed-in player's own client, carrying their session rather than the
 * service role. It holds only the grants `anon` and `authenticated` hold, so
 * it can read a game it belongs to and nothing else. Anything that needs to
 * write goes through `serviceClient()` in ./server.ts.
 *
 * Cookie refresh happens in `proxy.ts` at the repo root. A Server Component
 * cannot set cookies, so `setAll` swallows that failure on purpose: the proxy
 * has already written the refreshed pair on the way in.
 */

function config(): [string, string] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See .env.example.",
    );
  }
  return [url, key];
}

export async function sessionClient(): Promise<SupabaseClient> {
  const store = await cookies();
  const [url, key] = config();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (written) => {
        try {
          for (const { name, value, options } of written) {
            store.set(name, value, options);
          }
        } catch {
          // Server Component render: the proxy already refreshed these.
        }
      },
    },
  });
}

/**
 * Who is signed in, or null. This asks the auth server rather than trusting
 * the cookie: a session cookie is user-supplied data and `getSession()` does
 * not verify it, so it must never decide what a page is allowed to show.
 */
export async function currentPlayerId(): Promise<Uuid | null> {
  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}
