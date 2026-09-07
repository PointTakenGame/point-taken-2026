/**
 * A picture for a player, worked out rather than stored.
 *
 * There is no avatar column and no file upload here, which is deliberate:
 * uploads mean storage, moderation, and a way for a stranger to put an image
 * in front of the person they are arguing with. A derived mark costs none of
 * that and still gives every player something to recognise.
 *
 * The colour comes from the player id and the letters come from the name, and
 * those two sources are not an accident. An id never changes, so a player keeps
 * the same colour across a rename and stays recognisable in an opponent list.
 * A name does change, and the letters have to agree with the name printed next
 * to them, or the mark starts contradicting the page.
 */

/** Colour and letters for one player. */
export interface AvatarMark {
  /** A CSS colour, dark enough to carry white text at every hue. */
  background: string;
  /** Up to three initials, or empty for a player with no name yet. */
  initials: string;
}

/**
 * The nine emoji a player may pick as their avatar, in the fixed order they
 * are offered. This is the same set the sibling game Point Taken Heart
 * offers, so a player who has already picked one there recognises the choice
 * here. Nobody is picked by default: `players.avatar_emoji` is null until a
 * player opens the picker, and null keeps the derived initials mark instead.
 *
 * The list itself is content this file owns, but the *set* is not: it is
 * mirrored in `supabase/migrations/0015_player_avatar.sql`'s check
 * constraint, the same way the event vocabulary is mirrored between
 * `lib/events/types.ts` and its catalogue migration. Changing the set means
 * changing both, by hand, in the same commit. The *order* is this file's
 * alone: nothing stores a position, the stored value is the emoji character
 * itself, so reordering costs no migration and cannot disturb a player who
 * has already picked.
 *
 * The order is not arbitrary. `components/account/avatar-picker.tsx` lays
 * these nine straight into a three by three grid, reading across, so the
 * array order *is* the seating plan. Sorted by skin tone, as it was until
 * 2026-09-07, the grid put every lighter face along the top and both darker
 * faces in the bottom corner, which reads as a sorting rather than a
 * choice. So the nine are dealt out to a rule (Steve, 2026-09-07): every row
 * and every column carries at least one man, at least one woman, at least
 * one darker skin tone and at least one lighter one, and the first cell is
 * the medium-tone woman. `lib/avatar.test.ts` checks those properties of the
 * grid rather than pinning the exact sequence, so the arrangement can be
 * re-dealt without rewriting an expectation.
 */
export const PLAYER_EMOJIS = [
  "👩🏽",
  "👨🏻",
  "👩🏻‍🦰",
  "👱🏻‍♂️",
  "👩🏾‍🦱",
  "👨🏽",
  "👨🏾‍🦲",
  "👩🏻",
  "🧑🏼",
] as const;

export type PlayerEmoji = (typeof PLAYER_EMOJIS)[number];

/** Whether a string is one of the nine emoji a player may set as their avatar. */
export function isPlayerEmoji(value: string): value is PlayerEmoji {
  return (PLAYER_EMOJIS as readonly string[]).includes(value);
}

/**
 * Spread ids across the colour wheel.
 *
 * The classic string hash, kept because it is short and its only job is to be
 * arbitrary. It is not a checksum and nothing depends on the exact numbers, so
 * it may be replaced by any other spreading function without a migration: the
 * mark is derived on every render and stored nowhere.
 */
function hue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

/**
 * The first letter of up to three words.
 *
 * Names here are three random words, so three letters is the whole name rather
 * than an abbreviation of it. A player who renames themselves to one word gets
 * one letter, which is correct: padding it out would invent an initial.
 */
export function initialsOf(name: string | null): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
    .join("");
}

export function avatarMark(playerId: string, name: string | null): AvatarMark {
  // Fixed saturation and lightness, only the hue moves. Letting all three vary
  // is how derived avatars end up with a pale one nobody can read.
  return { background: `hsl(${hue(playerId)} 55% 38%)`, initials: initialsOf(name) };
}
