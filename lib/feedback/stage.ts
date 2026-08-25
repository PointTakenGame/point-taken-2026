/**
 * Turns the current path into a short, player-legible label for "which part
 * of the game this report is about." This is a fresh mapping against this
 * app's own routes, not a copy of any retired mapping: there is no lobby
 * page here, so there is no lobby stage.
 *
 * Kept a pure function of the pathname (no router hooks, no live state) so
 * it is trivial to unit test and safe to call from either the floating or
 * the inline feedback trigger.
 */
export function deriveFeedbackStage(pathname: string): string {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/auth/") || pathname.startsWith("/signin")) return "Sign in";
  if (pathname.startsWith("/account")) return "Account";
  if (pathname.startsWith("/join/")) return "Joining a room";
  // Setup, live play, and the read-only finished map are all the same route
  // in this app (`/game/[gameId]`), so one stage covers all three: the
  // route itself carries no signal to tell them apart without extra data.
  if (pathname.startsWith("/game/")) return "Playing a game";
  if (pathname.startsWith("/how-to-play")) return "How to play";
  if (pathname.startsWith("/cards")) return "Cards";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Other";
}
