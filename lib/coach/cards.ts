import { absolutesSentence, type AbsoluteGroup } from "@/lib/board/language";
import { FIRST_RELEASE_CARDS } from "@/lib/board/setup";

/**
 * What the coach is allowed to say.
 *
 * The coach's whole vocabulary is the card set the players already hold. That
 * is deliberate: a coach that invents its own categories teaches a second,
 * invisible rulebook, and the player has no card to throw in response to it.
 * If it is not a card, the coach does not raise it.
 *
 * The full ruleset is not settled (Steve, 2026-08-23: build the infrastructure,
 * the rules come later), so this is the first-release four and nothing else.
 * Adding a rung or a fifth card means adding it here, not editing the prompt.
 */
export interface CoachCard {
  id: string;
  icon: string;
  name: string;
  /** What breaking it looks like, written for the model, not for a player. */
  breaks: string;
  /** Shown to the player under the card name when the coach cites it. */
  plain: string;
  /**
   * The line printed on the card's own face, which is a different job from
   * `plain`. `plain` is the coach saying what went wrong with one tile in
   * front of you. This is the card telling you what it is for, read cold,
   * before you have a target in mind, so it is written as an instruction
   * rather than as a verdict. Copy is Rannie's, from the expanded card
   * variants of the `game bar` component set (Figma 60wr75TY7I95UnL6jkLz2J,
   * node 875:65982), adapted only where her wording described a consequence
   * this game does not have: a throw always ends in the target revising the
   * tile, never in it being removed.
   */
  throwWhen: string;
  /**
   * The level that hands the player this card, printed on the badge in the
   * card's corner. Ours, not the Figma's: her cards carry L2, L2, L3 and L4,
   * which belong to the second, undecided level-naming ladder drawn through
   * her boards. `lib/coach/cards.test.ts` pins these against the ladder that
   * actually awards them, so the two cannot drift.
   */
  earnedAtLevel: number;
}

/**
 * The half of No Exaggeration a word list can actually carry, so the coach and
 * the no-model practice check (BRAIN-T260823-42) name the same words rather
 * than each keeping a private notion of what counts as overstating.
 *
 * Certainty markers ("obviously", "undeniably") are on the shared list and are
 * deliberately not named here. Saying a thing is obvious is a different fault
 * from claiming it holds in every case, and handing the model a list of common
 * adverbs is the cheapest way to teach it to speak up about nothing. The whole
 * sentence is in front of it either way.
 */
const NAMED_TO_THE_COACH: readonly AbsoluteGroup[] = ["quantifier", "extent"];

export const COACH_CARDS: readonly CoachCard[] = [
  {
    id: "you_is_taboo",
    icon: "\u{1F645}",
    name: '"You" is Taboo',
    breaks:
      'The reason describes the other player rather than the question: what they believe, why they believe it, what kind of person holds that view. Second-person address about the argument ("you said", "as you noted") is fine. Characterising the person is not.',
    plain: "This talks about the other player rather than the question.",
    throwWhen:
      "Throw this card when a statement attacks the player's character or motives instead of their reasoning.",
    earnedAtLevel: 1,
  },
  {
    id: "stick_to_root",
    icon: "\u{1F3AF}",
    name: "Stick to the Thread's Root",
    breaks:
      "The reason does not bear on the claim at the root of the thread it was played into. It may be true and interesting and still belong in a thread of its own.",
    plain: "This is a different argument from the one this thread is about.",
    throwWhen:
      "Throw this at a statement that does not bear on the claim at the root of its thread, so its author can reword it or move it where it belongs.",
    earnedAtLevel: 2,
  },
  {
    id: "no_exaggeration",
    icon: "\u{1F4CF}",
    name: "No Exaggeration",
    breaks: `The reason overstates: an absolute where the evidence supports a tendency, a worst case presented as the expected case, or a number with no source behind it. The game watches these words in particular: ${absolutesSentence(NAMED_TO_THE_COACH)}. Those are where to look, not a verdict. A sentence containing one can be exactly right, and a sentence with none of them can overstate badly, so read the claim rather than counting words.`,
    plain: "This claims more than it can carry.",
    throwWhen:
      "Throw this at absolute quantifiers or inflated points to ask the player to restate their claim at a defensible size.",
    earnedAtLevel: 3,
  },
  {
    id: "help_me_understand",
    icon: "\u{1F4AC}",
    name: "Help Me Understand",
    breaks:
      "The reason is too compressed to answer. A key term is undefined, or the step from the evidence to the conclusion is left for the reader to guess at.",
    plain: "The other side cannot answer this without guessing what you meant.",
    throwWhen:
      "Hand back your reading of an unclear statement to show the author that their sentence or word choice did not pin down what they meant.",
    earnedAtLevel: 4,
  },
];

export const COACH_CARD_IDS: readonly string[] = COACH_CARDS.map((card) => card.id);

export function coachCard(id: string): CoachCard | undefined {
  return COACH_CARDS.find((card) => card.id === id);
}

/** Fails loudly if the two lists drift apart, which is the bug that would make
    the coach cite a card nobody is holding. */
export function coachCardsMatchDeck(): boolean {
  const deck = FIRST_RELEASE_CARDS.map((card) => card.id)
    .slice()
    .sort();
  const coach = COACH_CARD_IDS.slice().sort();
  return deck.length === coach.length && deck.every((id, i) => id === coach[i]);
}
