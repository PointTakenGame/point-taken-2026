/**
 * The one list of absolute words the game recognises.
 *
 * BRAIN-T260823-42. Two places in the product ask the same question about a
 * sentence: the No Exaggeration card, which the coach may cite about a reason
 * you played, and the practice beat that asks a player to catch their own
 * overstatement with no model call at all (BIZ-T260823-74). If those two ran off
 * separate lists they would eventually disagree in front of a player, and being
 * told a sentence overstates by one part of the game and does not by another is
 * worse than either list being imperfect. So there is one list, here, and both
 * read it.
 *
 * A correction worth keeping in writing, because the guide said otherwise: no
 * such list shipped in the old stack. The word "overgeneralization" there is a
 * category the language model is asked to return, so it is evidence that the
 * check was a model call, not evidence that it was a word list. This is written
 * from scratch.
 *
 * What this is not: a verdict. A sentence can contain "never" and be exactly
 * right ("a coin never lands on its edge"), and a sentence can overstate badly
 * without a single word from this list ("crime doubled last year", cited to
 * nothing). Treat a hit as a place to look. Nothing in the codebase blocks a
 * tile because of one, and nothing should.
 *
 * Deliberately absent: catastrophe verbs (destroy, ruin, devastate). A worst
 * case sold as the expected case is the other half of the card and it is real,
 * but it is a claim about what a sentence predicts, not about which words it
 * uses, so a matcher would only pretend to catch it. The coach, which reads the
 * whole sentence, keeps that half.
 *
 * Politically inert by construction: these are quantifiers and certainty
 * markers, and any side of any question can reach for all of them. The list
 * must stay that way. A word that only one side's arguments tend to use does
 * not belong here even when it does overstate.
 */

export type AbsoluteGroup =
  /** Says something holds for every case, or for none. */
  | "quantifier"
  /** Says something holds to the fullest possible degree. */
  | "extent"
  /** Says the matter is settled, so no evidence need follow. */
  | "certainty";

export interface AbsolutePhrase {
  /** Matched case-insensitively, on word boundaries, with any run of
      whitespace standing in for the spaces here. */
  phrase: string;
  group: AbsoluteGroup;
}

/**
 * Chosen for how often the word is doing the overstating, not for how absolute
 * it sounds. "Only" is left out for that reason: it is absolute and it is
 * almost always innocent ("the only way to know is to measure"), and a check
 * that fires on every third tile is a check players learn to dismiss.
 */
export const ABSOLUTE_PHRASES: readonly AbsolutePhrase[] = [
  { phrase: "all", group: "quantifier" },
  { phrase: "all the time", group: "quantifier" },
  { phrase: "always", group: "quantifier" },
  { phrase: "each and every", group: "quantifier" },
  { phrase: "every", group: "quantifier" },
  { phrase: "every single", group: "quantifier" },
  { phrase: "everybody", group: "quantifier" },
  { phrase: "everyone", group: "quantifier" },
  { phrase: "everything", group: "quantifier" },
  { phrase: "never", group: "quantifier" },
  { phrase: "no one", group: "quantifier" },
  { phrase: "nobody", group: "quantifier" },
  { phrase: "none", group: "quantifier" },
  { phrase: "nothing", group: "quantifier" },
  { phrase: "not a single", group: "quantifier" },
  { phrase: "not once", group: "quantifier" },
  { phrase: "nowhere", group: "quantifier" },
  { phrase: "without exception", group: "quantifier" },

  { phrase: "100%", group: "extent" },
  { phrase: "absolutely", group: "extent" },
  { phrase: "at all times", group: "extent" },
  { phrase: "completely", group: "extent" },
  { phrase: "entirely", group: "extent" },
  { phrase: "in every case", group: "extent" },
  { phrase: "in no case", group: "extent" },
  { phrase: "literally", group: "extent" },
  { phrase: "perfectly", group: "extent" },
  { phrase: "purely", group: "extent" },
  { phrase: "totally", group: "extent" },
  { phrase: "utterly", group: "extent" },
  { phrase: "wholly", group: "extent" },
  { phrase: "zero", group: "extent" },

  { phrase: "beyond doubt", group: "certainty" },
  { phrase: "certainly", group: "certainty" },
  { phrase: "clearly", group: "certainty" },
  { phrase: "definitely", group: "certainty" },
  { phrase: "guaranteed", group: "certainty" },
  { phrase: "impossible", group: "certainty" },
  { phrase: "indisputable", group: "certainty" },
  { phrase: "inevitable", group: "certainty" },
  { phrase: "inevitably", group: "certainty" },
  { phrase: "no doubt", group: "certainty" },
  { phrase: "obviously", group: "certainty" },
  { phrase: "proves", group: "certainty" },
  { phrase: "self-evident", group: "certainty" },
  { phrase: "undeniable", group: "certainty" },
  { phrase: "undeniably", group: "certainty" },
  { phrase: "undoubtedly", group: "certainty" },
  { phrase: "unquestionably", group: "certainty" },
  { phrase: "without question", group: "certainty" },
];

export interface AbsoluteHit {
  /** The phrase as the player wrote it, so a highlight can quote them back. */
  text: string;
  /** The entry that matched, in its canonical lower-case spelling. */
  phrase: string;
  group: AbsoluteGroup;
  /** Index into the string that was searched. */
  start: number;
  end: number;
}

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * Longest first, so "every single" wins over "every" at the same position and
 * the player is shown the whole phrase they wrote rather than half of it.
 */
function pattern(phrases: readonly AbsolutePhrase[]): RegExp {
  const alternatives = phrases
    .map((entry) => entry.phrase)
    .sort((a, b) => b.length - a.length)
    .map((phrase) => phrase.replace(ESCAPE, "\\$&").replace(/ /g, "\\s+"));
  // \b is wrong at the edges of "100%": the boundary after "%" never holds,
  // because neither side of it is a word character. Look-arounds for "not
  // preceded or followed by a letter or digit" say what is actually meant and
  // hold for every entry, punctuation included.
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
}

const CANONICAL = new Map(ABSOLUTE_PHRASES.map((entry) => [entry.phrase, entry]));
const ALL = pattern(ABSOLUTE_PHRASES);

/**
 * Every absolute in a piece of text, in the order it was written.
 *
 * Pure and synchronous on purpose: this is the half of No Exaggeration that
 * must work with no network, no key and no model, so it can run inside a
 * keystroke handler or inside a practice script that has to give the same
 * answer every time it is replayed.
 */
export function findAbsolutes(
  text: string,
  groups?: readonly AbsoluteGroup[],
): AbsoluteHit[] {
  const wanted = groups
    ? ABSOLUTE_PHRASES.filter((entry) => groups.includes(entry.group))
    : ABSOLUTE_PHRASES;
  if (wanted.length === 0) return [];

  const regex = wanted.length === ABSOLUTE_PHRASES.length ? ALL : pattern(wanted);
  regex.lastIndex = 0;

  const hits: AbsoluteHit[] = [];
  for (const match of text.matchAll(regex)) {
    // Whitespace inside a phrase may have been a newline or a double space, so
    // normalise before looking the entry up rather than trusting the raw text.
    const key = match[0].toLowerCase().replace(/\s+/g, " ");
    const entry = CANONICAL.get(key);
    if (!entry) continue;
    hits.push({
      text: match[0],
      phrase: entry.phrase,
      group: entry.group,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return hits;
}

/** The list as one readable clause, for anywhere that has to tell a person or a
    model which words the game watches. Quoted so a reader can see the word
    boundaries in "no one". */
export function absolutesSentence(groups?: readonly AbsoluteGroup[]): string {
  const wanted = groups
    ? ABSOLUTE_PHRASES.filter((entry) => groups.includes(entry.group))
    : ABSOLUTE_PHRASES;
  return wanted.map((entry) => `"${entry.phrase}"`).join(", ");
}
