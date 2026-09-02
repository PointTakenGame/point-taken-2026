"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Keeps page-footer chrome off a live board.
 *
 * The board is `fixed` and takes no space in the document flow, so anything
 * the root layout renders after it collapses to the top of the viewport and
 * lands in the board's top-left corner, on top of the room code. The same
 * problem, and the same answer, as `FeedbackPopover`'s floating variant.
 *
 * A wrapper rather than a prop on the thing being hidden, because the thing
 * being hidden reads server-only environment and has to stay a server
 * component. Children are rendered on the server and passed through.
 */
export function HideOnBoard({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/game")) return null;
  return <>{children}</>;
}
