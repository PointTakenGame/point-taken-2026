import type { ReactNode } from "react";

/** One conditional line above the sign-in form: a failed-callback reason or
 *  the player's session state. Renders nothing when there is nothing to say. */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error";
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <p
      className={
        tone === "error"
          ? "font-secondary text-p-sm rounded-md border border-orange/40 p-3 text-orange"
          : "font-secondary text-p-sm text-gray"
      }
    >
      {children}
    </p>
  );
}
