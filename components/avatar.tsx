import { avatarMark } from "@/lib/avatar";

/**
 * The coloured disc that stands in for a player.
 *
 * Hidden from screen readers on purpose. It carries no information that the
 * name beside it does not already carry, and it is always beside a name, so
 * announcing it would just read the same player twice.
 */

const SIZE = {
  sm: "h-8 w-8 rounded-full text-xs",
  lg: "h-14 w-14 rounded-full text-p-md",
  // The profile header wants something closer to the weight of a portrait than
  // a list row's marker, so it gets its own step rather than stretching `lg`.
  xl: "h-20 w-20 rounded-full text-xl",
  // The profile hero (Rannie's Profile frame, adopted 2026-09-04) draws the
  // avatar as a large rounded square rather than a disc, so this step also
  // overrides the shape.
  hero: "h-32 w-32 rounded-2xl text-4xl",
} as const;

// An emoji reads small next to the letter-height a font size was tuned for,
// so it gets its own scale: about 0.8 of the tile, big enough to read as a
// picture rather than a stray character.
const EMOJI_SIZE = {
  sm: "text-[1.6rem]",
  lg: "text-[2.8rem]",
  xl: "text-4xl",
  hero: "text-6xl",
} as const;

export function Avatar({
  playerId,
  name,
  size = "sm",
  emoji = null,
}: {
  playerId: string;
  name: string | null;
  size?: keyof typeof SIZE;
  /** A chosen avatar emoji (`players.avatar_emoji`), or null to fall back to initials. */
  emoji?: string | null;
}) {
  const { background, initials } = avatarMark(playerId, name);

  return (
    <span
      aria-hidden="true"
      style={{ background }}
      className={`inline-flex shrink-0 items-center justify-center font-semibold tracking-wide text-neutral-white ${SIZE[size]}`}
    >
      {emoji ? (
        <span className={`leading-none ${EMOJI_SIZE[size]}`}>{emoji}</span>
      ) : (
        initials
      )}
    </span>
  );
}
