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
