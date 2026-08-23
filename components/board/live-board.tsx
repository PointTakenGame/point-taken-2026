"use client";

import { useMemo, useState, useTransition, type ReactElement } from "react";

import type { BoardProposal, BoardState, BoardThread, BoardTile } from "@/lib/board/project";
import { REDACTED_TEXT } from "@/lib/board/project";
import {
  OTHER_SIDE,
  RESOLUTION_TOKENS,
  TILE_MAX_CHARS,
  canEditTile,
  canPlaceResolutionToken,
  canPlaceTile,
  canProposeTopicRevision,
  canRemoveTile,
  isResolved,
  proposalsAwaiting,
  proposalsFrom,
} from "@/lib/board/rules";
import { useGameFeed } from "./use-game-feed";
import type { ActionResult } from "@/app/game/[gameId]/actions";
import {
  acceptProposal,
  clearResolutionToken,
  editTile,
  giveGenerosityToken,
  leaveGame,
  placeResolutionToken,
  placeTile,
  proposeTopicRevision,
  rejectProposal,
  removeTile,
} from "@/app/game/[gameId]/actions";
import type { Side } from "@/lib/events/types";

/**
 * The live board: everything a player can see and do while a game is in
 * progress. Ugly on purpose; every action wired, none of it polished.
 */

const SIDE_MARK = { plus: "+", minus: "-" } as const;

export interface LiveBoardProps {
  gameId: string;
  board: BoardState;
  me: { playerId: string; role: Side };
}

/** Every live tile that has no live parent and is not a thread root. */
function flatten(tile: BoardTile): BoardTile[] {
  return [tile, ...tile.children.flatMap(flatten)];
}

function allTargets(board: BoardState): BoardTile[] {
  const fromThreads = board.threads.flatMap((thread) => [
    ...(thread.root ? flatten(thread.root) : []),
    ...thread.orphans.flatMap(flatten),
  ]);
  return fromThreads;
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-red-600">{error}</p>;
}

function TileText({ tile }: { tile: BoardTile }) {
  if (tile.redacted) return <span className="italic opacity-50">{REDACTED_TEXT}</span>;
  return <span>{tile.text}</span>;
}

function TileNode({
  tile,
  gameId,
  me,
  board,
}: {
  tile: BoardTile;
  gameId: string;
  me: { playerId: string; role: Side };
  board: BoardState;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tile.text);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mine = tile.placedBy === me.playerId;
  const editVerdict = canEditTile(board, tile.id, me.playerId, draft);
  const removeVerdict = canRemoveTile(board, tile.id, me.playerId);

  const runEdit = () => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await editTile(gameId, { tileId: tile.id, text: draft });
      if (!result.ok) setError(result.error);
      else setEditing(false);
    });
  };

  const runRemove = () => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await removeTile(gameId, { tileId: tile.id });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="w-4 shrink-0 text-center font-semibold tabular-nums opacity-60">
          {SIDE_MARK[tile.side]}
        </span>
        {editing ? (
          <span className="flex flex-1 flex-col gap-1">
            <textarea
              className="w-full border border-current/30 p-1 text-sm"
              value={draft}
              maxLength={TILE_MAX_CHARS}
              disabled={pending}
              onChange={(event) => setDraft(event.target.value)}
            />
            <span className="text-xs opacity-60">
              {TILE_MAX_CHARS - draft.length} characters left
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="border border-current/30 px-2 py-0.5 text-xs disabled:opacity-40"
                disabled={pending || !editVerdict.ok}
                title={!editVerdict.ok ? editVerdict.error : undefined}
                onClick={runEdit}
              >
                Save
              </button>
              <button
                type="button"
                className="border border-current/30 px-2 py-0.5 text-xs"
                disabled={pending}
                onClick={() => {
                  setDraft(tile.text);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </span>
          </span>
        ) : (
          <span className="flex-1">
            <TileText tile={tile} />
            {tile.edited && <span className="ml-2 text-xs opacity-50">(edited)</span>}
            {mine && (
              <span className="ml-2 inline-flex gap-2">
                <button
                  type="button"
                  className="text-xs underline opacity-70 disabled:opacity-30"
                  disabled={pending || !editVerdict.ok}
                  onClick={() => setEditing(true)}
                >
                  edit
                </button>
                <button
                  type="button"
                  className="text-xs underline opacity-70 disabled:opacity-30"
                  disabled={pending || !removeVerdict.ok}
                  title={!removeVerdict.ok ? removeVerdict.error : undefined}
                  onClick={runRemove}
                >
                  remove
                </button>
              </span>
            )}
            {mine && <span className="ml-2 text-xs opacity-50">(yours)</span>}
          </span>
        )}
      </div>
      <ErrorLine error={error} />

      {tile.children.length > 0 && (
        <ul className="ml-2 flex flex-col gap-2 border-l border-current/15 pl-4">
          {tile.children.map((child) => (
            <TileNode key={child.id} tile={child} gameId={gameId} me={me} board={board} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ResolutionRow({
  gameId,
  thread,
  me,
  board,
}: {
  gameId: string;
  thread: BoardThread;
  me: { playerId: string; role: Side };
  board: BoardState;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isResolved(thread)) {
    return (
      <p className="text-sm">
        <span className="mr-1 text-lg align-middle">{thread.resolution!.emoji}</span>
        {thread.resolution!.note && <span className="opacity-70">{thread.resolution!.note}</span>}
      </p>
    );
  }

  const myToken = thread.pending[me.role];
  const otherToken = thread.pending[OTHER_SIDE[me.role]];

  const place = (emoji: string) => {
    setError(null);
    startTransition(async () => {
      const result = await placeResolutionToken(gameId, { threadRootId: thread.rootId, emoji });
      if (!result.ok) setError(result.error);
    });
  };

  const clear = () => {
    setError(null);
    startTransition(async () => {
      const result = await clearResolutionToken(gameId, { threadRootId: thread.rootId });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="opacity-60">You: {myToken ?? "no token"}</span>
        <span className="opacity-60">Them: {otherToken ?? "no token"}</span>
        {myToken ? (
          <button
            type="button"
            className="border border-current/30 px-2 py-0.5 text-xs"
            disabled={pending}
            onClick={clear}
          >
            take back your token
          </button>
        ) : (
          RESOLUTION_TOKENS.map((token) => {
            const verdict = canPlaceResolutionToken(board, thread.rootId, token);
            return (
              <button
                key={token}
                type="button"
                className="border border-current/30 px-2 py-0.5 text-xs disabled:opacity-40"
                disabled={pending || !verdict.ok}
                title={!verdict.ok ? verdict.error : undefined}
                onClick={() => place(token)}
              >
                {token}
              </button>
            );
          })
        )}
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

function proposalSummary(proposal: BoardProposal): string {
  const content = proposal.content;
  if (proposal.kind === "topic_revision" && "text" in content) {
    return `New topic: "${content.text}"`;
  }
  if (proposal.kind === "tile_relocation" && "new_thread_root_id" in content) {
    return `Move a reason to thread ${content.new_thread_root_id.slice(0, 8)}`;
  }
  if ((proposal.kind === "steelman_tile" || proposal.kind === "steelman_reading") && "text" in content) {
    return `${proposal.kind.replace("_", " ")}: "${content.text}"`;
  }
  if (proposal.kind === "definition" && "term" in content) {
    return `Define "${content.term}": ${content.text}`;
  }
  return proposal.kind;
}

function ProposalRow({
  gameId,
  proposal,
  awaitingMe,
}: {
  gameId: string;
  proposal: BoardProposal;
  awaitingMe: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const accept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptProposal(gameId, { proposalId: proposal.id });
      if (!result.ok) setError(result.error);
    });
  };

  const reject = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectProposal(gameId, {
        proposalId: proposal.id,
        reason: reason.trim().length > 0 ? reason.trim() : null,
      });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <li className="flex flex-col gap-1 border border-current/15 p-2 text-sm">
      <span className="opacity-60">{proposal.kind}</span>
      <span>{proposalSummary(proposal)}</span>
      {awaitingMe ? (
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="border border-current/30 px-2 py-0.5 text-xs"
            disabled={pending}
            onClick={accept}
          >
            Accept
          </button>
          <input
            className="border border-current/30 px-1 py-0.5 text-xs"
            placeholder="reason (optional)"
            value={reason}
            disabled={pending}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            type="button"
            className="border border-current/30 px-2 py-0.5 text-xs"
            disabled={pending}
            onClick={reject}
          >
            Reject
          </button>
        </span>
      ) : (
        <span className="text-xs opacity-50">waiting on the other side</span>
      )}
      <ErrorLine error={error} />
    </li>
  );
}

function Composer({
  gameId,
  board,
}: {
  gameId: string;
  board: BoardState;
}) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const targets = useMemo(() => allTargets(board), [board]);
  const parentTileId = target.length > 0 ? target : null;
  const verdict = canPlaceTile(board, text, parentTileId);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await placeTile(gameId, { text, parentTileId });
      if (!result.ok) setError(result.error);
      else setText("");
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      <label className="flex flex-col gap-1 text-sm">
        Reply to
        <select
          className="border border-current/30 p-1"
          value={target}
          disabled={pending}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="">Start a new thread</option>
          {targets.map((tile) => (
            <option key={tile.id} value={tile.id}>
              {SIDE_MARK[tile.side]} {tile.redacted ? REDACTED_TEXT : tile.text.slice(0, 40)}
            </option>
          ))}
        </select>
      </label>
      <textarea
        className="w-full border border-current/30 p-1 text-sm"
        value={text}
        maxLength={TILE_MAX_CHARS}
        disabled={pending}
        placeholder="A reason for your side."
        onChange={(event) => setText(event.target.value)}
      />
      <span className="text-xs opacity-60">{TILE_MAX_CHARS - text.length} characters left</span>
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending || !verdict.ok}
        title={!verdict.ok ? verdict.error : undefined}
        onClick={submit}
      >
        Place tile
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

function TopicRevisionForm({ gameId, board }: { gameId: string; board: BoardState }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verdict = canProposeTopicRevision(board, text);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeTopicRevision(gameId, { text });
      if (!result.ok) setError(result.error);
      else setText("");
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      <label className="flex flex-col gap-1 text-sm">
        Propose a revised topic
        <textarea
          className="w-full border border-current/30 p-1 text-sm"
          value={text}
          maxLength={300}
          disabled={pending}
          placeholder="A statement both sides could sign."
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending || !verdict.ok}
        title={!verdict.ok ? verdict.error : undefined}
        onClick={submit}
      >
        Propose
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

function GenerosityButton({ gameId }: { gameId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const give = () => {
    setError(null);
    startTransition(async () => {
      const result = await giveGenerosityToken(gameId, {});
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending}
        onClick={give}
      >
        Give a generosity token
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * Walking out. A live board needs both sides, so this ends the game for the
 * other player too, which is why it takes a second press.
 */
function LeaveButton({ gameId }: { gameId: string }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const leave = () => {
    if (!sure) {
      setSure(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await leaveGame(gameId, { reason: "quit" });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending}
        onClick={leave}
      >
        {sure ? "Yes, end it for both of us" : "Leave this game"}
      </button>
      <p className="text-sm opacity-60">
        The map stays in your history either way, marked unfinished.
      </p>
      <ErrorLine error={error} />
    </div>
  );
}

function ThreadBlock({
  gameId,
  thread,
  index,
  me,
  board,
}: {
  gameId: string;
  thread: BoardThread;
  index: number;
  me: { playerId: string; role: Side };
  board: BoardState;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-current/15 pt-4">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Thread {index + 1}
        </h3>
        <ResolutionRow gameId={gameId} thread={thread} me={me} board={board} />
      </header>

      <ul className="flex flex-col gap-2">
        {thread.root ? (
          <TileNode tile={thread.root} gameId={gameId} me={me} board={board} />
        ) : (
          <li className="opacity-50">The reason this thread started from is gone.</li>
        )}
      </ul>

      {thread.orphans.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide opacity-50">
            Replies to a removed reason
          </p>
          <ul className="flex flex-col gap-2">
            {thread.orphans.map((tile) => (
              <TileNode key={tile.id} tile={tile} gameId={gameId} me={me} board={board} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function LiveBoard({ gameId, board, me }: LiveBoardProps): ReactElement {
  const awaiting = proposalsAwaiting(board, me.role);
  const asked = proposalsFrom(board, me.role);
  // Refetches the server projection when the other player appends.
  const { connected } = useGameFeed(gameId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-1 border-b border-current/15 pb-4">
        <p className="text-sm uppercase tracking-wide opacity-60">
          {board.status} · you are {SIDE_MARK[me.role]} ·{" "}
          {connected ? "live" : "reconnecting"}
        </p>
        <h1 className="text-xl font-semibold text-balance">
          {board.currentTopicText ?? "No topic was set."}
        </h1>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Players</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {board.players.map((player) => (
            <li key={player.id}>
              {player.role ? SIDE_MARK[player.role] : "?"} {player.displayName ?? "Someone"}
              {player.signed && player.signed.length > 0 ? " (signed)" : " (not signed)"}
              {player.left && ` (left: ${player.left})`}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Generosity</h2>
        <p className="text-sm">
          {SIDE_MARK.plus} {board.generosity.plus} · {SIDE_MARK.minus} {board.generosity.minus}
        </p>
        <GenerosityButton gameId={gameId} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Place a tile</h2>
        <Composer gameId={gameId} board={board} />
      </section>

      {board.threads.length === 0 ? (
        <p className="opacity-70">No threads yet. Place the first tile above.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {board.threads.map((thread, index) => (
            <ThreadBlock
              key={thread.rootId}
              gameId={gameId}
              thread={thread}
              index={index}
              me={me}
              board={board}
            />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Proposals waiting on you
        </h2>
        {awaiting.length === 0 ? (
          <p className="text-sm opacity-50">None right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {awaiting.map((proposal) => (
              <ProposalRow key={proposal.id} gameId={gameId} proposal={proposal} awaitingMe />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Proposals you asked
        </h2>
        {asked.length === 0 ? (
          <p className="text-sm opacity-50">None right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {asked.map((proposal) => (
              <ProposalRow
                key={proposal.id}
                gameId={gameId}
                proposal={proposal}
                awaitingMe={false}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Topic</h2>
        <TopicRevisionForm gameId={gameId} board={board} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Leaving</h2>
        <LeaveButton gameId={gameId} />
      </section>
    </div>
  );
}
