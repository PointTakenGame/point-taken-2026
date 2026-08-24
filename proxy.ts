import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the Supabase session cookie fresh on every navigation.
 *
 * This is `proxy.ts`, not `middleware.ts`: Next 16 renamed the convention, and
 * every Supabase guide still says middleware. The behaviour is unchanged.
 *
 * The dance below is required, not decorative. Refreshed cookies have to land
 * on both the request (so this render sees them) and the response (so the
 * browser keeps them), and the response must be rebuilt from the mutated
 * request. Returning a different response drops the refreshed session and
 * signs the player out at random.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (written) => {
        for (const { name, value } of written) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of written) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user && autologinAllowed(request)) {
    // Local sandbox bypass, see docs/filed/SANDBOX.md.
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn(`[dev autologin] sign-in failed: ${error.message}`);
    } else {
      await nameTheNewPlayer(request);
    }
  }

  return response;
}

/**
 * Sign the browser in without anybody clicking "Start playing".
 *
 * Two guards, both required. `PT_DEV_AUTOLOGIN` alone would ship a public
 * account factory the day someone sets it in Vercel; the NODE_ENV check alone
 * would surprise anyone who wanted to test the real signed-out front door.
 * `next build` sets NODE_ENV=production, so this cannot survive a deploy.
 *
 * Each browser profile gets its own anonymous player, so a normal window and a
 * private window are Plus and Minus with no further setup.
 */
function autologinAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.PT_DEV_AUTOLOGIN !== "1") return false;
  // The naming call below routes back through here. Do not recurse into it.
  // `/auth/` is excluded for a different reason: a mailed sign-in link would
  // otherwise be handed a fresh anonymous session on the way to the callback
  // that replaces it, leaving an abandoned player row behind every time.
  const { pathname } = request.nextUrl;
  return !pathname.startsWith("/api/auth/") && !pathname.startsWith("/auth/");
}

/**
 * Hand the fresh account a display name by calling the route that already
 * knows how, rather than importing the naming code into the proxy bundle.
 * `player_joined` requires a name, so an unnamed dev account cannot join a
 * game and the bypass would save a click by costing a mystery.
 *
 * The cookie jar was mutated in place by `setAll` above, so it already carries
 * the session the request arrived without.
 */
async function nameTheNewPlayer(request: NextRequest): Promise<void> {
  const cookie = request.cookies
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  try {
    const res = await fetch(new URL("/api/auth/anonymous", request.url), {
      method: "POST",
      headers: { cookie },
    });
    if (!res.ok) {
      console.warn(`[dev autologin] naming failed: HTTP ${res.status}`);
    }
  } catch (cause) {
    console.warn(`[dev autologin] naming failed: ${String(cause)}`);
  }
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
