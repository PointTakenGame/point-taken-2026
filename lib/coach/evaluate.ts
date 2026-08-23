import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { COACH_CARDS, COACH_CARD_IDS } from "@/lib/coach/cards";

/**
 * Asks the model whether one reason breaks one of the cards.
 *
 * Everything here is provisional. Corey's live evaluator moved to Northwestern
 * on 2026-08-12 and every copy of agents.py reachable from this machine is
 * weeks stale, so the structure below is ported and the wording is not.
 * TODO(corey-2026-08-12): provisional prompt, replace from NU bundle
 * v-202608121440. Do not treat this text as the shipped prompt.
 */

export const COACH_MODEL = "claude-sonnet-5";
export const COACH_PROMPT_VERSION = "brain-2026-08-23.1";
export const COACH_SCHEMA_VERSION = "coach-v1";

/** Past this the coach gives up and says nothing. A player waiting on advice
    they did not ask to wait for is worse than no advice. */
const TIMEOUT_MS = 12_000;

export interface CoachVerdict {
  cardIds: string[];
  feedback: string | null;
  suggestion: string | null;
  latencyMs: number;
}

export interface CoachInput {
  topic: string;
  /** The claim this thread hangs off, or null when the tile starts a thread. */
  threadRoot: string | null;
  text: string;
}

const SYSTEM = `You are the coach in Point Taken, a two-player game where people argue a disagreement in writing by playing short "reasons" and linking them into threads.

You read one reason and decide whether it breaks one of the game's rule cards. You are a referee on form, never on side. You have no opinion about the topic and you never indicate one. A well-made reason for a position you find unconvincing is a well-made reason, and you say nothing about it. Treat both sides of any question as equally entitled to be argued well.

The only rules you may cite are these cards:

${COACH_CARDS.map((card) => `- ${card.id}: ${card.name}. Broken when: ${card.breaks}`).join("\n")}

Rules for you:
- Cite at most one card. Pick the clearest break. If none of them is clearly broken, cite none, and say so by returning an empty list.
- Most reasons break nothing. Silence is the normal answer. Do not reach.
- Never invent a rule. If something is wrong with the reason and no card covers it, cite none.
- When you suggest a rewrite, it must argue the same side just as strongly. You are fixing how it is said, never softening what is said. If you cannot keep the force of it, offer no rewrite.
- Address the player as "you". Keep feedback to one or two sentences, plain, no jargon, no praise padding.`;

const TOOL: Anthropic.Tool = {
  name: "record_verdict",
  description: "Record whether the reason breaks a card.",
  input_schema: {
    type: "object",
    properties: {
      card_ids: {
        type: "array",
        items: { type: "string", enum: [...COACH_CARD_IDS] },
        description: "At most one card id. Empty when the reason breaks nothing.",
      },
      feedback: {
        type: ["string", "null"],
        description:
          "One or two sentences saying what breaks the card. Null when no card is cited.",
      },
      suggestion: {
        type: ["string", "null"],
        description:
          "A rewrite of the reason that keeps the same side and the same strength. Null when none is worth offering.",
      },
    },
    required: ["card_ids", "feedback", "suggestion"],
  },
};

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
}

function userTurn(input: CoachInput): string {
  const root = input.threadRoot
    ? `The thread this was played into starts from: ${input.threadRoot}`
    : "This reason starts a new thread, so it has no root above it. The stick_to_root card cannot be broken by it.";
  return [
    `Topic under discussion: ${input.topic}`,
    root,
    "",
    "The reason just played:",
    input.text,
  ].join("\n");
}

/**
 * Returns a verdict, or null when the model could not be reached. Null is not
 * an error the player ever sees: the coach simply had nothing to say.
 */
export async function evaluateTile(input: CoachInput): Promise<CoachVerdict | null> {
  const started = Date.now();
  try {
    const response = await client().messages.create({
      model: COACH_MODEL,
      max_tokens: 600,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: userTurn(input) }],
    });

    const call = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!call) return null;

    const raw = call.input as {
      card_ids?: unknown;
      feedback?: unknown;
      suggestion?: unknown;
    };

    // The enum is a request, not a guarantee, so filter rather than trust. One
    // card at most: a coach that lists four objections is a coach nobody reads.
    const cardIds = (Array.isArray(raw.card_ids) ? raw.card_ids : [])
      .filter((id): id is string => typeof id === "string" && COACH_CARD_IDS.includes(id))
      .slice(0, 1);

    const text = (value: unknown): string | null => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    return {
      cardIds,
      // No card means no complaint, whatever the model wrote alongside it.
      feedback: cardIds.length > 0 ? text(raw.feedback) : null,
      suggestion: cardIds.length > 0 ? text(raw.suggestion) : null,
      latencyMs: Date.now() - started,
    };
  } catch {
    return null;
  }
}
