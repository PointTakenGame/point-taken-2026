import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { TILE_MAX_CHARS } from "@/lib/board/rules";
import { COACH_CARDS } from "@/lib/coach/cards";
import {
  CLARITY_INSTRUCTIONS,
  NINE_CHECK_INSTRUCTIONS,
  NINE_CHECK_KEYS,
  RELATIONS,
  STRUCTURE_INSTRUCTIONS,
  cardFor,
  fallbackFeedback,
  suppressFalsePositiveClarify,
  withinTileLimit,
  type CheckFindings,
  type CheckKey,
  type Relation,
} from "@/lib/coach/checks";

/**
 * Asks the model whether one reason breaks one of the cards.
 *
 * The checklist it runs is Corey's, ported from the Northwestern study
 * evaluator; see `checks.ts` for the source, the version stamps, and every
 * place this departs from him on purpose. The model reports checks, never
 * cards: all of his calibration attaches to a check, and asking a model to pick
 * one of four cards cold would throw that away. Code turns checks into the one
 * card a player sees.
 */

/**
 * Measured, not assumed: coach-eval.test.ts runs the twelve paired fixtures
 * against each candidate.
 *
 * At .4, on 2026-08-24: Haiku 4.5 spoke up on none of the four clean reasons,
 * named the right card on 6 of 8 broken ones, kept every rewrite inside a tile,
 * and answered in a median 2928 ms. Sonnet 5 got 8 of 8, also clean, at 6372 ms
 * and many times the price. Speaking up on a clean reason is the expensive
 * failure and neither model does it, so the budget decides, which is what
 * BIZ-T260823-78 asked for, and Haiku is pinned.
 *
 * Worth knowing before that pin is treated as settled: the gap widened. Under
 * the older four-card question it was 7 against 8; the checklist is harder and
 * Haiku now misses two, both of them a silence where a card was wanted rather
 * than a wrong card. A silence is the cheap failure, which is why the pin holds,
 * but this is closer than it was. Tracked in BRAIN-T260824-01.
 *
 * Version .3 replaced the four-card question with the nine-check checklist, so
 * that measurement did not carry over, and .3 measured worse on Haiku: 4 of 8,
 * because the off_root heuristic was outranking his calibrated checks. Version
 * .4 is the same text with that ranking corrected in `cardFor`. The stamp moves
 * for a derivation change as well as a wording change, because what it has to
 * segment later is the reading a player received, not the string we sent.
 */
export const COACH_MODEL = "claude-haiku-4-5-20251001";
export const COACH_PROMPT_VERSION = "brain-2026-08-24.4";
export const COACH_SCHEMA_VERSION = "coach-v1";

/** Past this the coach gives up and says nothing. A player waiting on advice
    they did not ask to wait for is worse than no advice. */
const TIMEOUT_MS = 12_000;

/** Wider output than the four-card question needed: nine checks plus a trigger
    phrase, feedback, and a rewrite. */
const MAX_TOKENS = 900;

export interface CoachVerdict {
  /** At most one, derived from `findings`. Empty means the coach says nothing. */
  cardIds: string[];
  feedback: string | null;
  suggestion: string | null;
  latencyMs: number;
  /** Everything the checklist saw, including the checks that never surface. */
  findings: CheckFindings;
  triggerPhrase: string | null;
  suggestionSource: "explanation_agent" | "none";
  suggestionConfidence: "high" | "medium" | "low" | null;
  suggestionPreservesStance: boolean | null;
}

export interface CoachInput {
  topic: string;
  /** The claim this thread hangs off, or null when the tile starts a thread. */
  threadRoot: string | null;
  text: string;
}

const SYSTEM = `You are the coach in Point Taken, a two-player game where people argue a disagreement in writing by playing short "reasons" and linking them into threads.

You read one reason and report what a fixed checklist finds in it. You are a referee on form, never on side. You have no opinion about the topic and you never indicate one. A well-made reason for a position you find unconvincing is a well-made reason, and you say nothing about it. Treat both sides of any question as equally entitled to be argued well.

Work through four tasks and report all of them, whatever the earlier ones found.

════════════════════════════════════════
TASK 1: STRUCTURE
════════════════════════════════════════
${STRUCTURE_INSTRUCTIONS}

════════════════════════════════════════
TASK 2: REASONING (nine-check fallacy detection)
════════════════════════════════════════
${NINE_CHECK_INSTRUCTIONS}

════════════════════════════════════════
TASK 3: ON THE ROOT
════════════════════════════════════════
Report off_root=true only when the reason is about a different question than the claim at the root of its thread. A reason that is true, interesting, and about something else is exactly this case. A reason that disagrees with the root, or narrows it, or attacks its evidence, is on the root and is not this case. If in doubt, false.

════════════════════════════════════════
TASK 4: CLARITY
════════════════════════════════════════
${CLARITY_INSTRUCTIONS}
Do NOT flag clarification if the reason is already IRRELEVANT. That is a structure issue, not a clarity issue.

════════════════════════════════════════
WHAT TO WRITE
════════════════════════════════════════
Most reasons find nothing. Silence is the normal answer. Do not reach.

If anything was found, write feedback the player can act on. Address the player as "you". Keep it to one or two sentences, plain, no jargon, no praise padding. Name what the words on the page do, never what you think the player believes.

If you can rewrite the reason so it stops breaking anything, put it in suggestion. The rewrite must argue the same side just as strongly: you are fixing how it is said, never softening what is said. It must fit on a tile, ${TILE_MAX_CHARS} characters or fewer. If you cannot stay under that, return null instead of a shorter argument the player did not make. Say whether the rewrite preserves their stance, and how confident you are in it.

The game's rule cards, for tone. Do not name them; the game decides which card to show.
${COACH_CARDS.map((card) => `- ${card.name}: ${card.plain}`).join("\n")}`;

const TOOL: Anthropic.Tool = {
  name: "record_reading",
  description: "Record the checklist results for one reason.",
  input_schema: {
    type: "object",
    properties: {
      relation: { type: "string", enum: [...RELATIONS] },
      violations: {
        type: "array",
        items: { type: "string", enum: [...NINE_CHECK_KEYS] },
        description: "Every check that came out detected=true. Empty if none did.",
      },
      off_root: { type: "boolean" },
      clarification_needed: { type: "boolean" },
      trigger_phrase: {
        type: ["string", "null"],
        description: "The words in the reason that triggered the first violation.",
      },
      feedback: { type: ["string", "null"] },
      suggestion: { type: ["string", "null"] },
      suggestion_preserves_stance: { type: ["boolean", "null"] },
      suggestion_confidence: {
        type: ["string", "null"],
        enum: ["high", "medium", "low", null],
      },
    },
    required: [
      "relation",
      "violations",
      "off_root",
      "clarification_needed",
      "trigger_phrase",
      "feedback",
      "suggestion",
      "suggestion_preserves_stance",
      "suggestion_confidence",
    ],
  },
};

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
}

function userTurn(input: CoachInput): string {
  const root = input.threadRoot
    ? `The claim at the root of this thread: "${input.threadRoot}"`
    : "This reason starts a new thread, so it has no root above it. off_root cannot be true for it.";
  return `The topic under debate: "${input.topic}"
${root}

The reason just played:
"""
${input.text}
"""`;
}

/** The enum is a request, not a guarantee, so filter rather than trust. */
function readViolations(raw: unknown): CheckKey[] {
  if (!Array.isArray(raw)) return [];
  const keys = NINE_CHECK_KEYS as readonly string[];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item === "string" && keys.includes(item)) seen.add(item);
  }
  return NINE_CHECK_KEYS.filter((key) => seen.has(key));
}

function readRelation(raw: unknown): Relation {
  return RELATIONS.find((relation) => relation === raw) ?? "supports";
}

function readConfidence(raw: unknown): "high" | "medium" | "low" | null {
  return raw === "high" || raw === "medium" || raw === "low" ? raw : null;
}

function text(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * His `select_suggestion`, minus the clarify branch.
 *
 * PORT-NOTE(one-call): his ladder falls back to the first rewrite from a
 * separate clarify agent when the explanation agent's own rewrite fails the
 * gate. We make one call, so there is no second list to fall back to. A failed
 * gate means no rewrite, which is the right way to fail: an unusable rewrite is
 * worse than none.
 *
 * PORT-NOTE(personal-attack-rewrite): his explanation agent returns no
 * suggestion at all for a personal attack. Ours does. His job is to log a
 * reading; ours is to give the player the next move, and "say what the policy
 * does instead" is the whole point of the "You" is Taboo card.
 */
function selectSuggestion(
  raw: unknown,
  preservesStance: unknown,
  confidence: "high" | "medium" | "low" | null,
): Pick<
  CoachVerdict,
  "suggestion" | "suggestionSource" | "suggestionConfidence" | "suggestionPreservesStance"
> {
  const fitted = withinTileLimit(text(raw), TILE_MAX_CHARS);
  const stance = typeof preservesStance === "boolean" ? preservesStance : null;
  if (fitted && stance && (confidence === "high" || confidence === "medium")) {
    return {
      suggestion: fitted,
      suggestionSource: "explanation_agent",
      suggestionConfidence: confidence,
      suggestionPreservesStance: true,
    };
  }
  return {
    suggestion: null,
    suggestionSource: "none",
    suggestionConfidence: null,
    suggestionPreservesStance: stance,
  };
}

/**
 * Returns null when the coach could not read the tile at all. That is not the
 * same as the coach having nothing to say, which is a verdict with no cards.
 */
export async function evaluateTile(
  input: CoachInput,
  model: string = COACH_MODEL,
): Promise<CoachVerdict | null> {
  const startedAt = performance.now();
  try {
    const response = await client().messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: userTurn(input) }],
    });

    const block = response.content.find((part) => part.type === "tool_use");
    if (!block || block.type !== "tool_use") return null;
    const raw = block.input as Record<string, unknown>;

    const findings = suppressFalsePositiveClarify(input.text, {
      relation: readRelation(raw.relation),
      violations: readViolations(raw.violations),
      offRoot: raw.off_root === true && input.threadRoot !== null,
      clarificationNeeded:
        raw.clarification_needed === true && readRelation(raw.relation) !== "irrelevant",
    });

    const card = cardFor(findings);
    const latencyMs = Math.round(performance.now() - startedAt);
    const triggerPhrase = text(raw.trigger_phrase);

    // No card means the coach stays quiet, whatever the checklist logged. A
    // research-only violation is a row in the corpus, not a thing to say.
    if (!card) {
      return {
        cardIds: [],
        feedback: null,
        suggestion: null,
        latencyMs,
        findings,
        triggerPhrase,
        suggestionSource: "none",
        suggestionConfidence: null,
        suggestionPreservesStance: null,
      };
    }

    return {
      cardIds: [card],
      // The ladder in checks.ts is the floor: a card with nothing said beside it
      // is a scold, so there is always a sentence.
      feedback: text(raw.feedback) ?? fallbackFeedback(findings),
      latencyMs,
      findings,
      triggerPhrase,
      ...selectSuggestion(
        raw.suggestion,
        raw.suggestion_preserves_stance,
        readConfidence(raw.suggestion_confidence),
      ),
    };
  } catch {
    return null;
  }
}
