import type { BoardPlayer, BoardState } from "./project";
import type { Verdict } from "./rules";
import type { Side, Uuid } from "@/lib/events/types";

/**
 * What has to be true before two people start arguing.
 *
 * Same shape as rules.ts and for the same reason: pure, no database, so the
 * server action and the button that is greyed out ask one question. The
 * content the setup step offers lives here too rather than in a content
 * directory, per BIZ-T260823-34; the ids are the part that must never change
 * once a real game has recorded one.
 */

export interface SigningLine {
  id: string;
  /** The short line the player affirms. */
  text: string;
  /** The badge family name it belongs to, shown beside it. */
  family: string;
}

/**
 * The three lines both players affirm before play, per the 2026-08-22 ruling
 * (BIZ-T260822-04). A ritual, not a consent form: no partial signing.
 *
 * The ids are the shipped vocabulary from the event catalogue. Rannie's frame
 * draws a fourth line, folded into Play fair; "I'll control my emotions" was
 * cut; the old game's same_team id is dead.
 */
export const SIGNING_LINES: readonly SigningLine[] = [
  { id: "mutual_respect", text: "Play fair", family: "Mutual Respect" },
  { id: "honest_thinking", text: "Stay on the thread", family: "Honest Thinking" },
  { id: "shared_facts", text: "Pin it down", family: "Shared Facts" },
];

export const SIGNING_LINE_IDS: readonly string[] = SIGNING_LINES.map((line) => line.id);

export interface LibraryTopic {
  id: string;
  text: string;
  /** "Practice" is a warmup, "Tough" is the hardest end of the shelf. */
  tier: "Practice" | "Serious Stuff" | "Tough";
  category: string;
}

/**
 * The starter shelf, carried forward from the shipped library with its ids
 * intact so old games and new ones name the same topic the same way.
 *
 * Balance here is aggregate, not paired: the standing obligation
 * (BIZ-T260426-39) is that the shelf as a whole stays roughly even, reviewed
 * quarterly, rather than every topic owing a mirror image.
 */
export const TOPIC_LIBRARY: readonly LibraryTopic[] = [
  {
    id: "TOP001",
    text: "Should a hot dog be called a sandwich (or taco)?",
    tier: "Practice",
    category: "warmup",
  },
  {
    id: "TOP002",
    text: "Should astrology be taken seriously as a way to understand ourselves or others?",
    tier: "Practice",
    category: "warmup",
  },
  {
    id: "TOP003",
    text: "Should student loan debt for community college degrees be forgiven?",
    tier: "Serious Stuff",
    category: "Fairness",
  },
  {
    id: "TOP004",
    text: "Should people be required to have health insurance?",
    tier: "Serious Stuff",
    category: "Fairness",
  },
  {
    id: "TOP005",
    text: "Should the death penalty be allowed for premeditated mass murder?",
    tier: "Serious Stuff",
    category: "Fairness",
  },
  {
    id: "TOP006",
    text: "Should the government grant special protections to union workers, like preventing workers who strike from being fired?",
    tier: "Serious Stuff",
    category: "Rights",
  },
  {
    id: "TOP007",
    text: "Should people without a criminal record be allowed to own military-grade automatic weapons?",
    tier: "Serious Stuff",
    category: "Rights",
  },
  {
    id: "TOP008",
    text: "Should sugary soda be taxed for its health effects, like cigarettes?",
    tier: "Serious Stuff",
    category: "Rights",
  },
  {
    id: "TOP009",
    text: "Should AI-generated content (e.g., news, art, music) be clearly labeled to consumers?",
    tier: "Serious Stuff",
    category: "Tech",
  },
  {
    id: "TOP010",
    text: "Should cryptocurrency be legal?",
    tier: "Serious Stuff",
    category: "Tech",
  },
  {
    id: "TOP011",
    text: "Should self-driving cars be allowed on public streets?",
    tier: "Serious Stuff",
    category: "Tech",
  },
  {
    id: "TOP012",
    text: "Should the SAT be eliminated due to concerns about fairness and bias against some groups of college applicants?",
    tier: "Tough",
    category: "School",
  },
  {
    id: "TOP013",
    text: "Should a researcher who argues that women have a genetic disadvantage in math be allowed to present their research on a college campus?",
    tier: "Tough",
    category: "School",
  },
  {
    id: "TOP014",
    text: "Should athletes be allowed to join high school sports teams based on their gender identity instead of their sex at birth?",
    tier: "Tough",
    category: "School",
  },
  {
    id: "TOP015",
    text: "Should individuals facing persecution or human rights abuses in foreign countries be allowed temporary asylum in the USA?",
    tier: "Tough",
    category: "USA",
  },
  {
    id: "TOP016",
    text: "Should someone who entered the USA without documentation 20 years ago be deported now, even if it breaks up a family?",
    tier: "Tough",
    category: "USA",
  },
  {
    id: "TOP017",
    text: "Should the USA abolish the Electoral College and elect a president by popular vote?",
    tier: "Tough",
    category: "USA",
  },
];

export const TOPIC_MAX_CHARS = 300;

/**
 * The four rule cards in the first release, 4 of 11 (the 2026-08-22 count,
 * after Define That was folded into Help Me Understand).
 *
 * The ids are coined here, not ported: no document assigns card ids, and
 * BIZ-T260823-34 requires them stable from the first game played, so they are
 * fixed now and confirmed with biz rather than left to drift (BRAIN-T260823-14).
 */
export const FIRST_RELEASE_CARDS: readonly { id: string; icon: string; name: string }[] =
  [
    { id: "you_is_taboo", icon: "\u{1F645}", name: '"You" is Taboo' },
    { id: "stick_to_root", icon: "\u{1F3AF}", name: "Stick to the Thread's Root" },
    { id: "no_exaggeration", icon: "\u{1F4CF}", name: "No Exaggeration" },
    { id: "help_me_understand", icon: "\u{1F4AC}", name: "Help Me Understand" },
  ];

export const FIRST_RELEASE_CARD_IDS: readonly string[] = FIRST_RELEASE_CARDS.map(
  (card) => card.id,
);

export const MAX_PLAYERS = 2;

const ALLOWED: Verdict = { ok: true };
const no = (error: string): Verdict => ({ ok: false, error });

function seat(board: BoardState, playerId: Uuid): BoardPlayer | undefined {
  return board.players.find((player) => player.id === playerId);
}

export function boardIsLobby(board: BoardState): Verdict {
  if (board.status === "ended") return no("That game is over.");
  if (board.status === "active") return no("That game has already started.");
  return ALLOWED;
}

export function canJoin(board: BoardState, playerId: Uuid): Verdict {
  const open = boardIsLobby(board);
  if (!open.ok) return open;
  if (seat(board, playerId)) return ALLOWED;
  const seated = board.players.filter((player) => player.left !== "quit");
  if (seated.length >= MAX_PLAYERS) return no("That room is full.");
  return ALLOWED;
}

export function canChooseSide(board: BoardState, playerId: Uuid, side: Side): Verdict {
  const open = boardIsLobby(board);
  if (!open.ok) return open;
  if (!seat(board, playerId)) return no("Join the room first.");
  const taken = board.players.some(
    (player) => player.id !== playerId && player.role === side,
  );
  if (taken) return no("The other player is already on that side.");
  return ALLOWED;
}

export function canSetTopic(board: BoardState, text: string): Verdict {
  const open = boardIsLobby(board);
  if (!open.ok) return open;
  const trimmed = text.trim();
  if (!trimmed) return no("A topic needs some words.");
  if (trimmed.length > TOPIC_MAX_CHARS) {
    return no(`A topic has to fit in ${TOPIC_MAX_CHARS} characters.`);
  }
  return ALLOWED;
}

export function canSign(
  board: BoardState,
  playerId: Uuid,
  itemIds: readonly string[],
): Verdict {
  const open = boardIsLobby(board);
  if (!open.ok) return open;
  const mine = seat(board, playerId);
  if (!mine) return no("Join the room first.");
  if (mine.signed) return no("You have already signed.");
  if (SIGNING_LINES.length === 0) {
    return no("There is nothing to sign yet.");
  }
  const signed = new Set(itemIds);
  const all = SIGNING_LINE_IDS.every((id) => signed.has(id));
  if (!all || signed.size !== SIGNING_LINE_IDS.length) {
    return no("Signing means standing behind every line.");
  }
  return ALLOWED;
}

/**
 * Everything the game needs before the first reason can be placed. Both
 * players, on opposite sides, both signed, arguing about something.
 */
export function canStartGame(board: BoardState): Verdict {
  const open = boardIsLobby(board);
  if (!open.ok) return open;

  const here = board.players.filter((player) => player.left !== "quit");
  if (here.length < MAX_PLAYERS) return no("Waiting for the other player.");

  const sides = here.map((player) => player.role);
  if (sides.some((side) => side === null)) {
    return no("Both players need to pick a side.");
  }
  if (sides[0] === sides[1]) return no("Somebody has to argue the other way.");

  if (!board.currentTopicText) return no("Pick a topic first.");

  if (here.some((player) => player.signed === null)) {
    return no("Both players still have to sign.");
  }

  return ALLOWED;
}

/**
 * The card set a live game starts with. Today every player owns the same four
 * cards, so the intersection is all of them and nobody has raised anything;
 * who may raise it above the intersection is still open (BRAIN-T260817-09).
 */
export function startingCardSet(): {
  policy: "intersection";
  card_ids: string[];
  raised_by: null;
} {
  return {
    policy: "intersection",
    card_ids: [...FIRST_RELEASE_CARD_IDS],
    raised_by: null,
  };
}
