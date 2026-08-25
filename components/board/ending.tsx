import type { BoardState } from "@/lib/board/project";

/**
 * The sentence a finished game owes its players.
 *
 * A game used to end by quietly turning into a map. The outcome was in there,
 * as one clause of a stats line reading "Every thread resolved, 6 threads,
 * 6 reasons", which is a tally and not an ending. Both win conditions are
 * cooperative and that is the whole point of the design, so the moment it is
 * reached is the one moment that has to say so out loud.
 *
 * This deliberately does not restate the mechanic. FinishedMap's stats line
 * already names which of the two endings happened, and this sits directly
 * above it; saying it twice is how the live board's thread counter went wrong.
 * So this says what it meant. Print hides it for the same reason: on paper the
 * stats line is the record, and a record does not congratulate anybody.
 */

const ENDING: Record<string, { title: string; body: string }> = {
  threads_resolved: {
    title: "You finished it.",
    body: "Every thread got a token, which is one of the two ways out. You both won it, and neither of you won it alone.",
  },
  topic_agreed: {
    title: "You finished it.",
    body: "You agreed on a rewriting of the topic, which is the other way out. You both won it, and neither of you won it alone.",
  },
  abandoned: {
    title: "This one stopped early.",
    body: "Somebody left before the board was finished. What the two of you did build is below, and it stays yours.",
  },
  timeout: {
    title: "This one stopped early.",
    body: "The game ran out of time before the board was finished. What the two of you did build is below, and it stays yours.",
  },
};

const UNKNOWN = {
  title: "This game has ended.",
  body: "The record of it is below.",
};

export function Ending({ board }: { board: BoardState }) {
  const ending = ENDING[board.winCondition ?? ""] ?? UNKNOWN;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-8 pt-8 print:hidden">
      <h2 className="text-xl font-semibold">{ending.title}</h2>
      <p className="opacity-70">{ending.body}</p>
    </section>
  );
}
