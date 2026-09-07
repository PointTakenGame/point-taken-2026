/**
 * The standard pencil, wherever this app means "edit this".
 *
 * Steve, 2026-09-05, ruling on the tile card: edit should read as "a standard
 * pencil icon" rather than a line of text. No icon package is installed in
 * this project, so this is a small inline glyph rather than a new dependency
 * or a `public/icons/` asset for one shape.
 *
 * It lives here rather than beside its first caller because two very
 * different screens now draw it: the tile out on the board
 * (`components/board/live-board.tsx`) and the profile hero avatar
 * (`components/account/avatar-picker.tsx`). Colour comes from
 * `currentColor` and size from the caller's `className`, so each surface can
 * keep its own palette (the board's neutral-black/offwhite, the account
 * flow's ink/card) without a second copy of the path.
 */
export function PencilGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M13.5 3.5l3 3L6 17H3v-3L13.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
