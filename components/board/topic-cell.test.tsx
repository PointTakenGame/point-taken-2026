/** @vitest-environment jsdom */

/**
 * Coverage for the topic tile's four states, which are the whole of the
 * rewrite-the-topic flow ported from the retired client's `TopicTile.vue`:
 * the tile as a click target, the textarea that replaces the topic in place,
 * the confirmation gate that quotes the draft back before it goes, and the
 * other player answering on the tile itself.
 *
 * The server actions are mocked because `app/game/[gameId]/actions.ts` is a
 * "use server" file this task may not edit and jsdom cannot run. What is
 * checked here is which action gets called, with what, and from which state.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Every action here answers the same way, so the mocks share one signature
 * and the assertions are about the arguments. */
type Action = (gameId: string, input: unknown) => Promise<{ ok: true }>;

const proposeTopicRevision = vi.fn<Action>(async () => ({ ok: true }) as const);
const acceptProposal = vi.fn<Action>(async () => ({ ok: true }) as const);
const rejectProposal = vi.fn<Action>(async () => ({ ok: true }) as const);

vi.mock("@/app/game/[gameId]/actions", () => ({
  proposeTopicRevision,
  acceptProposal,
  rejectProposal,
}));

const { TopicCell, pendingTopicRevision, lastRejectedTopicRevision } =
  await import("./topic-cell");
const { projectBoard } = await import("@/lib/board/project");
type AnyGameEvent = import("@/lib/events/types").AnyGameEvent;

const GAME = "00000000-0000-4000-8000-000000000000";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const PROPOSAL = "33333333-3333-4333-8333-333333333333";

const TOPIC = "Cities should cap rents.";
const REWRITE = "Rent caps help renters this year and hurt them in ten.";

function buildEvents(
  parts: { type: string; payload: unknown; actor_id?: string; actor_role?: string }[],
): AnyGameEvent[] {
  return parts.map((part, index) => ({
    id: `e${index + 1}`,
    game_id: GAME,
    seq: index + 1,
    schema_version: 1,
    actor_role: "plus",
    source: "human",
    actor_id: ALICE,
    created_at: "2026-09-01T00:00:00Z",
    ...part,
  })) as AnyGameEvent[];
}

const SETUP = [
  {
    type: "game_created",
    payload: { mode: "live", level_id: null, boss_id: null, join_code: "PTKN22" },
  },
  { type: "player_joined", payload: { display_name: "Alice" }, actor_id: ALICE },
  { type: "role_selected", payload: { role: "plus" }, actor_id: ALICE },
  { type: "player_joined", payload: { display_name: "Bob" }, actor_id: BOB },
  {
    type: "role_selected",
    payload: { role: "minus" },
    actor_id: BOB,
    actor_role: "minus",
  },
  { type: "topic_set", payload: { text: TOPIC, origin: "typed", topic_id: null } },
  {
    type: "game_started",
    payload: {
      card_set: { policy: "intersection", card_ids: [], raised_by: null },
      coach: null,
    },
  },
];

/** A board with nothing proposed on it. */
function activeBoard() {
  return projectBoard(buildEvents(SETUP));
}

/** The same board with a rewrite out from Minus, waiting on Plus. */
function boardWithProposalFromMinus() {
  return projectBoard(
    buildEvents([
      ...SETUP,
      {
        type: "proposal_made",
        payload: {
          proposal_id: PROPOSAL,
          kind: "topic_revision",
          target_tile_id: null,
          target_thread_root_id: null,
          content: { text: REWRITE },
        },
        actor_id: BOB,
        actor_role: "minus",
      },
    ]),
  );
}

const WHY = "It drops the part we actually disagree about.";

/** The rewrite from Minus, turned down by Plus with a reason. */
function boardWithRejection(reason: string | null = WHY) {
  return projectBoard(
    buildEvents([
      ...SETUP,
      {
        type: "proposal_made",
        payload: {
          proposal_id: PROPOSAL,
          kind: "topic_revision",
          target_tile_id: null,
          target_thread_root_id: null,
          content: { text: REWRITE },
        },
        actor_id: BOB,
        actor_role: "minus",
      },
      {
        type: "proposal_rejected",
        payload: { proposal_id: PROPOSAL, reason },
        actor_id: ALICE,
        actor_role: "plus",
      },
    ]),
  );
}

function noop() {}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("pendingTopicRevision", () => {
  it("finds nothing on a board where nobody has proposed a rewrite", () => {
    expect(pendingTopicRevision(activeBoard())).toBeNull();
  });

  it("finds the rewrite that is waiting for an answer", () => {
    const proposal = pendingTopicRevision(boardWithProposalFromMinus());
    expect(proposal?.kind).toBe("topic_revision");
    expect(proposal?.askedBy).toBe("minus");
  });
});

describe("lastRejectedTopicRevision", () => {
  it("finds nothing before anybody has been told no", () => {
    expect(lastRejectedTopicRevision(activeBoard())).toBeNull();
  });

  it("stays quiet while a newer rewrite is still waiting on an answer", () => {
    expect(lastRejectedTopicRevision(boardWithProposalFromMinus())).toBeNull();
  });

  it("finds the rewrite that was turned down, and the reason given", () => {
    const rejected = lastRejectedTopicRevision(boardWithRejection());
    expect(rejected?.askedBy).toBe("minus");
    expect(rejected?.reason).toBe(WHY);
  });
});

describe("TopicCell: what happened to the last rewrite", () => {
  function seat(role: "plus" | "minus", board = boardWithRejection()) {
    return render(
      <TopicCell
        gameId={GAME}
        board={board}
        me={{ playerId: role === "plus" ? ALICE : BOB, role }}
        size={14}
        editing={false}
        onEdit={noop}
        onEditEnd={noop}
      />,
    );
  }

  it("tells the proposer they were turned down, and why", () => {
    seat("minus");

    expect(screen.getByText("They turned down your wording")).toBeTruthy();
    expect(screen.getByText(REWRITE)).toBeTruthy();
    expect(screen.getByText(`\u201c${WHY}\u201d`)).toBeTruthy();
    // The tile itself is back to the topic, because the rewrite was refused.
    expect(screen.getByText(TOPIC)).toBeTruthy();
  });

  // BRAIN-T260903-06: proposing a topic revision is a Gym level 5+ move,
  // held back from the live game for now. The note about the rejection
  // still shows; the retry that would start a new proposal does not.
  it("does not offer the proposer a retry: a new topic revision is a later move", () => {
    render(
      <TopicCell
        gameId={GAME}
        board={boardWithRejection()}
        me={{ playerId: BOB, role: "minus" }}
        size={14}
        editing={false}
        onEdit={noop}
        onEditEnd={noop}
      />,
    );

    expect(screen.getByText("They turned down your wording")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try another wording" })).toBeNull();
  });

  it("shows the rejecter their own no, without offering them a rewrite to retry", async () => {
    seat("plus");

    expect(screen.getByText("You turned down their wording")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try another wording" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("You turned down their wording")).toBeNull();
  });

  it("keeps the news for the proposer once play moves on, and drops it for the rejecter", () => {
    const later = projectBoard([
      ...buildEvents([
        ...SETUP,
        {
          type: "proposal_made",
          payload: {
            proposal_id: PROPOSAL,
            kind: "topic_revision",
            target_tile_id: null,
            target_thread_root_id: null,
            content: { text: REWRITE },
          },
          actor_id: BOB,
          actor_role: "minus",
        },
        {
          type: "proposal_rejected",
          payload: { proposal_id: PROPOSAL, reason: WHY },
          actor_id: ALICE,
          actor_role: "plus",
        },
        {
          type: "tile_placed",
          payload: {
            tile_id: "44444444-4444-4444-8444-444444444444",
            parent_tile_id: null,
            text: "Rent is not the only cost that moved.",
            thread_root_id: null,
          },
          actor_id: ALICE,
          actor_role: "plus",
        },
      ]),
    ]);

    // The rejecter has moved on and does not need a card about their own no.
    seat("plus", later);
    expect(screen.queryByText("You turned down their wording")).toBeNull();
    cleanup();

    // The proposer still has not been told, and this card is the only place
    // the reason exists.
    seat("minus", later);
    expect(screen.getByText("They turned down your wording")).toBeTruthy();
    expect(screen.getByText(`\u201c${WHY}\u201d`)).toBeTruthy();
  });

  it("says so when no reason was given, rather than leaving a gap", () => {
    seat("minus", boardWithRejection(null));
    expect(screen.getByText("They did not say why.")).toBeTruthy();
  });
});

describe("TopicCell: the tile at rest", () => {
  // BRAIN-T260903-06: proposing a topic revision is a Gym level 5+ move,
  // held back from the live game for now, so the tile is not a click
  // target to start one. (The rule this used to exercise,
  // canProposeTopicRevision, is untouched; only the UI's own gate is new.)
  it("does not offer itself as the way to rewrite the topic: it is a later move", () => {
    render(
      <TopicCell
        gameId={GAME}
        board={activeBoard()}
        me={{ playerId: ALICE, role: "plus" }}
        size={14}
        editing={false}
        onEdit={noop}
        onEditEnd={noop}
      />,
    );

    expect(screen.getByText(TOPIC)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Propose a revised topic" })).toBeNull();
  });

  it("is not a click target while a rewrite is already waiting for an answer", () => {
    render(
      <TopicCell
        gameId={GAME}
        board={boardWithProposalFromMinus()}
        me={{ playerId: BOB, role: "minus" }}
        size={14}
        editing={false}
        onEdit={noop}
        onEditEnd={noop}
      />,
    );

    expect(screen.queryByRole("button", { name: "Propose a revised topic" })).toBeNull();
  });
});

describe("TopicCell: writing the rewrite", () => {
  it("refuses to send an empty rewrite, and sends one that has words in it", async () => {
    const onEditEnd = vi.fn();
    render(
      <TopicCell
        gameId={GAME}
        board={activeBoard()}
        me={{ playerId: ALICE, role: "plus" }}
        size={14}
        editing
        onEdit={noop}
        onEditEnd={onEditEnd}
      />,
    );

    const propose = screen.getByRole("button", { name: "Propose" });
    expect((propose as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByRole("textbox"), REWRITE);
    expect((propose as HTMLButtonElement).disabled).toBe(false);

    // Proposing does not send: it asks first, because agreeing on a rewrite
    // is one of the two ways the game ends.
    await userEvent.click(propose);
    expect(proposeTopicRevision).not.toHaveBeenCalled();
    expect(screen.getByText("Propose this topic?")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "PROPOSE IT" }));
    expect(proposeTopicRevision).toHaveBeenCalledWith(GAME, { text: REWRITE });
    expect(onEditEnd).toHaveBeenCalled();
  });

  it("will not send the topic that is already there", async () => {
    render(
      <TopicCell
        gameId={GAME}
        board={activeBoard()}
        me={{ playerId: ALICE, role: "plus" }}
        size={14}
        editing
        onEdit={noop}
        onEditEnd={noop}
      />,
    );

    await userEvent.type(screen.getByRole("textbox"), TOPIC);
    expect(
      (screen.getByRole("button", { name: "Propose" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("closes without sending anything when the writer backs out", async () => {
    const onEditEnd = vi.fn();
    render(
      <TopicCell
        gameId={GAME}
        board={activeBoard()}
        me={{ playerId: ALICE, role: "plus" }}
        size={14}
        editing
        onEdit={noop}
        onEditEnd={onEditEnd}
      />,
    );

    await userEvent.type(screen.getByRole("textbox"), REWRITE);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(proposeTopicRevision).not.toHaveBeenCalled();
    expect(onEditEnd).toHaveBeenCalledTimes(1);
  });
});

describe("TopicCell: answering on the tile", () => {
  function answering() {
    return render(
      <TopicCell
        gameId={GAME}
        board={boardWithProposalFromMinus()}
        me={{ playerId: ALICE, role: "plus" }}
        size={14}
        editing={false}
        onEdit={noop}
        onEditEnd={noop}
      />,
    );
  }

  it("gives the other player the rewrite, and takes yes straight away", async () => {
    answering();

    expect(screen.getByText(REWRITE)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(acceptProposal).toHaveBeenCalledWith(GAME, { proposalId: PROPOSAL });
  });

  it("asks why before it sends a no, and sends what was typed", async () => {
    answering();

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(rejectProposal).not.toHaveBeenCalled();
    expect(screen.getByText("Not this wording?")).toBeTruthy();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Why you are rejecting this topic" }),
      "  It drops the part we disagree about.  ",
    );
    await userEvent.click(screen.getByRole("button", { name: "REJECT IT" }));
    expect(rejectProposal).toHaveBeenCalledWith(GAME, {
      proposalId: PROPOSAL,
      reason: "It drops the part we disagree about.",
    });
  });

  it("still lets a no go without a reason", async () => {
    answering();

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await userEvent.click(screen.getByRole("button", { name: "REJECT IT" }));
    expect(rejectProposal).toHaveBeenCalledWith(GAME, {
      proposalId: PROPOSAL,
      reason: null,
    });
  });

  it("sends nothing when the rejection is backed out of", async () => {
    answering();

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await userEvent.click(screen.getByRole("button", { name: "BACK" }));
    expect(rejectProposal).not.toHaveBeenCalled();
  });

  it("shows the proposer their own words and nothing to press", () => {
    render(
      <TopicCell
        gameId={GAME}
        board={boardWithProposalFromMinus()}
        me={{ playerId: BOB, role: "minus" }}
        size={14}
        editing={false}
        onEdit={noop}
        onEditEnd={noop}
      />,
    );

    expect(screen.getByText(REWRITE)).toBeTruthy();
    expect(screen.getByText("Sent. Waiting for them to answer.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  });
});
