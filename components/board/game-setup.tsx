"use client";

import { useState, useTransition } from "react";

import type { BoardPlayer, BoardState } from "@/lib/board/project";
import {
  MAX_PLAYERS,
  SIGNING_LINES,
  TOPIC_LIBRARY,
  TOPIC_MAX_CHARS,
  canChooseSide,
  canSetTopic,
  canSign,
  canStartGame,
  hasLeft,
} from "@/lib/board/setup";
import { Glyph } from "@/components/brand/art";
import { useGameFeed } from "./use-game-feed";
import { SIDE_LABEL } from "./side-label";
import { StancePicker } from "./stance-picker";
import type { ActionResult } from "@/app/game/[gameId]/actions";
import {
  chooseSide,
  leaveLobby,
  rejoinLobby,
  setTopic,
  signAgreement,
  startGame,
} from "@/app/game/[gameId]/setup-actions";
import type { Side } from "@/lib/events/types";

/**
 * The room before the game: pick a side, settle the topic, sign, start.
 *
 * Ugly on purpose, same as the live board. Every button asks lib/board/setup
 * for its verdict, so a disabled control and a refused action give the same
 * reason in the same words.
 */

const TIERS = ["Practice", "Serious Stuff", "Tough"] as const;

export interface GameSetupProps {
  gameId: string;
  board: BoardState;
  joinCode: string | null;
  me: { playerId: string; role: Side | null };
}

/** The code, and the link that carries it, for whoever the host is inviting. */
function Invite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/join/${code}`;

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
  }

  return (
    <p className="flex items-baseline gap-2 text-sm opacity-70">
      <span>
        Invite code <span className="font-mono font-semibold">{code}</span>
      </span>
      <button type="button" onClick={copy} className="underline">
        {copied ? "link copied" : "copy link"}
      </button>
    </p>
  );
}

function Who({ player, me }: { player: BoardPlayer; me: string }) {
  const name = player.displayName ?? "someone";
  const side = player.role ? SIDE_LABEL[player.role] : "no side yet";
  return (
    <li>
      {name}
      {player.id === me ? " (you)" : ""}: {side}
      {player.signed ? ", signed" : ", has not signed"}
      {player.left === "quit" ? ", left" : ""}
    </li>
  );
}

/**
 * The screen a person is looking at when they are the only one in the room.
 *
 * "Waiting for the other player" alone is a dead end: it says what is true and
 * nothing about what to do. Two people need to be told the link is how the
 * second one arrives. One person needs to be told they can hold both seats,
 * which is not obvious and is how anybody reviewing this alone sees a board at
 * all, since the hot seat exists only in local dev.
 */
function Waiting({ hasInvite }: { hasInvite: boolean }) {
  if (!hasInvite) {
    return (
      <p className="text-sm opacity-70">
        Waiting for the other player. They come in through this room&apos;s invite link.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-sm opacity-70">
      <p>
        Waiting for the other player. Copy the link above and send it to them: it opens
        this room in their browser and puts them in the seat across from you.
      </p>
      <p>
        On your own? Open that same link in a private window and you can play both sides
        yourself.
      </p>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-red-600">{error}</p>;
}

export function GameSetup({ gameId, board, joinCode, me }: GameSetupProps) {
  const { connected } = useGameFeed(gameId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [custom, setCustom] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const mine = board.players.find((player) => player.id === me.playerId);
  const here = board.players.filter((player) => player.left !== "quit");
  const plusVerdict = canChooseSide(board, me.playerId, "plus");
  const minusVerdict = canChooseSide(board, me.playerId, "minus");
  const startVerdict = canStartGame(board);
  const signVerdict = canSign(
    board,
    me.playerId,
    SIGNING_LINES.map((line) => line.id),
  );

  const run = (call: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await call();
      if (!result.ok) setError(result.error);
    });
  };

  const customVerdict = canSetTopic(board, custom);

  // Leaving does not navigate anywhere, so this is the screen the leaver is
  // looking at. Showing them the room's controls with "left" beside their own
  // name was the bug: the server now refuses those writes, and there is no
  // reason to draw a button whose only outcome is a refusal.
  if (hasLeft(board, me.playerId)) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">You left this room</h1>
        <p className="text-sm opacity-70">
          Your seat is still here and nobody else can take it. Walk back in whenever you
          want.
        </p>
        <ErrorLine error={error} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="w-fit border border-current/30 px-2 py-1 disabled:opacity-30"
            disabled={pending}
            onClick={() => run(() => rejoinLobby(gameId))}
          >
            {pending ? "..." : "Rejoin"}
          </button>
          <a className="text-sm underline opacity-60" href="/account">
            Back to your account
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Before you start</h1>
        {joinCode ? <Invite code={joinCode} /> : null}
        <p className="text-xs opacity-50">
          {connected ? "live" : "not listening"} &middot; {here.length}/{MAX_PLAYERS} here
        </p>
      </header>

      <ErrorLine error={error} />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">In the room</h2>
        <ul className="text-sm">
          {board.players.map((player) => (
            <Who key={player.id} player={player} me={me.playerId} />
          ))}
        </ul>
        {here.length < MAX_PLAYERS ? <Waiting hasInvite={Boolean(joinCode)} /> : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Your side</h2>
        <StancePicker
          value={mine?.role ?? null}
          disabled={pending}
          disabledSides={[
            ...(!plusVerdict.ok && mine?.role !== "plus" ? (["plus"] as const) : []),
            ...(!minusVerdict.ok && mine?.role !== "minus" ? (["minus"] as const) : []),
          ]}
          reasons={{
            plus: plusVerdict.ok ? undefined : plusVerdict.error,
            minus: minusVerdict.ok ? undefined : minusVerdict.error,
          }}
          onPick={(side) => run(() => chooseSide(gameId, side))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">The topic</h2>
        {board.currentTopicText ? (
          <p className="border-l-2 border-current/40 pl-2 text-sm">
            {board.currentTopicText}
          </p>
        ) : null}

        {TIERS.map((tier) => {
          const topics = TOPIC_LIBRARY.filter((topic) => topic.tier === tier);
          if (topics.length === 0) return null;
          return (
            <div key={tier} className="flex flex-col gap-1">
              <h3 className="text-xs uppercase tracking-wide opacity-60">{tier}</h3>
              <ul className="flex flex-col gap-1">
                {topics.map((topic) => (
                  <li key={topic.id}>
                    <button
                      type="button"
                      className="text-left text-sm underline disabled:no-underline disabled:opacity-40"
                      disabled={pending}
                      aria-pressed={picked === topic.id}
                      onClick={() => {
                        setPicked(topic.id);
                        run(() =>
                          setTopic(gameId, { text: topic.text, topicId: topic.id }),
                        );
                      }}
                    >
                      {topic.text}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div className="flex flex-col gap-1">
          <h3 className="text-xs uppercase tracking-wide opacity-60">Your own</h3>
          <textarea
            className="w-full border border-current/30 p-1 text-sm"
            value={custom}
            maxLength={TOPIC_MAX_CHARS}
            placeholder="Write the statement you disagree about."
            disabled={pending}
            onChange={(event) => setCustom(event.target.value)}
          />
          <button
            type="button"
            className="self-start border border-current/40 px-3 py-1 text-sm disabled:opacity-40"
            disabled={pending || !customVerdict.ok}
            title={customVerdict.ok ? undefined : customVerdict.error}
            onClick={() => {
              setPicked(null);
              run(() => setTopic(gameId, { text: custom, topicId: null }));
            }}
          >
            Use this
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        {/* The old client marked this same moment with this same drawing. */}
        <h2 className="flex items-center gap-2 font-semibold">
          <Glyph name="book" size={22} />
          The agreement
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {SIGNING_LINES.map((line) => (
            <li key={line.id}>
              <span className="opacity-60">{line.family}:</span> {line.text}
            </li>
          ))}
        </ul>
        <p className="text-sm opacity-60">
          Changing the topic clears both signatures, because this is what you are signing
          about.
        </p>
        <button
          type="button"
          className="self-start border border-current/40 px-3 py-1 text-sm disabled:opacity-40"
          disabled={pending || !signVerdict.ok}
          title={signVerdict.ok ? undefined : signVerdict.error}
          onClick={() => run(() => signAgreement(gameId))}
        >
          {mine?.signed ? "Signed" : "I stand behind all three"}
        </button>
      </section>

      <section className="flex items-center gap-3">
        <button
          type="button"
          className="border border-current/60 px-4 py-2 font-semibold disabled:opacity-40"
          disabled={pending || !startVerdict.ok}
          title={startVerdict.ok ? undefined : startVerdict.error}
          onClick={() => run(() => startGame(gameId))}
        >
          Start the game
        </button>
        {startVerdict.ok ? null : (
          <span className="text-sm opacity-70">{startVerdict.error}</span>
        )}
      </section>

      <footer>
        <button
          type="button"
          className="text-sm underline opacity-60 disabled:opacity-30"
          disabled={pending}
          onClick={() => run(() => leaveLobby(gameId))}
        >
          Leave the room
        </button>
      </footer>
    </main>
  );
}
