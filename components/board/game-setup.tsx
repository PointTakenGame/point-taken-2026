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
import { RoomCodeDisplay } from "@/components/lobby/room-code-display";
import { StancePicker } from "@/components/board/stance-picker";
import { PlayerAgreement } from "@/components/lobby/player-agreement";
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

function Who({ player, me }: { player: BoardPlayer; me: string }) {
  const name = player.displayName ?? "someone";
  const side = player.role ? SIDE_LABEL[player.role] : "no side yet";
  return (
    <li className="font-secondary text-p-sm text-neutral-black">
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
      <p className="font-secondary text-p-sm text-gray">
        Waiting for the other player. They come in through this room&apos;s invite link.
      </p>
    );
  }

  return (
    <div className="font-secondary text-p-sm text-gray flex flex-col gap-1">
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
  return <p className="font-secondary text-p-sm text-red-600">{error}</p>;
}

export function GameSetup({ gameId, board, joinCode, me }: GameSetupProps) {
  const { connected } = useGameFeed(gameId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [custom, setCustom] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mine = board.players.find((player) => player.id === me.playerId);
  const peer = board.players.find((player) => player.id !== me.playerId);
  const peerSigned = Boolean(peer?.signed);
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

  async function copyInvite() {
    if (!joinCode) return;
    await navigator.clipboard.writeText(`${window.location.origin}/join/${joinCode}`);
    setCopied(true);
  }

  // Leaving does not navigate anywhere, so this is the screen the leaver is
  // looking at. Showing them the room's controls with "left" beside their own
  // name was the bug: the server now refuses those writes, and there is no
  // reason to draw a button whose only outcome is a refusal.
  if (hasLeft(board, me.playerId)) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="font-primary text-neutral-black text-xl">You left this room</h1>
        <p className="font-secondary text-p-sm text-gray">
          Your seat is still here and nobody else can take it. Walk back in whenever you
          want.
        </p>
        <ErrorLine error={error} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="border-neutral-black font-secondary text-p-sm w-fit rounded-full border-2 px-3 py-1 disabled:opacity-30"
            disabled={pending}
            onClick={() => run(() => rejoinLobby(gameId))}
          >
            {pending ? "..." : "Rejoin"}
          </button>
          <a className="font-secondary text-p-sm text-gray underline" href="/account">
            Back to your account
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-primary text-neutral-black text-xl">Before you start</h1>
        {joinCode ? (
          <RoomCodeDisplay code={joinCode} copied={copied} onCopy={copyInvite} />
        ) : null}
        <p className="font-secondary text-p-sm text-gray">
          {connected ? "live" : "not listening"} &middot; {here.length}/{MAX_PLAYERS} here
        </p>
      </header>

      <ErrorLine error={error} />

      <section className="flex flex-col gap-2">
        <h2 className="font-primary text-neutral-black">In the room</h2>
        <ul className="flex flex-col gap-1">
          {board.players.map((player) => (
            <Who key={player.id} player={player} me={me.playerId} />
          ))}
        </ul>
        {here.length < MAX_PLAYERS ? <Waiting hasInvite={Boolean(joinCode)} /> : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-primary text-neutral-black">Your side</h2>
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
        <h2 className="font-primary text-neutral-black">The topic</h2>
        {board.currentTopicText ? (
          <p className="border-gold bg-offwhite font-secondary text-p-sm text-neutral-black rounded-lg border-l-4 px-3 py-2">
            {board.currentTopicText}
          </p>
        ) : null}

        {TIERS.map((tier) => {
          const topics = TOPIC_LIBRARY.filter((topic) => topic.tier === tier);
          if (topics.length === 0) return null;
          return (
            <div key={tier} className="flex flex-col gap-1">
              <h3 className="font-secondary text-p-sm text-gray font-bold uppercase tracking-wide">
                {tier}
              </h3>
              <ul className="flex flex-col gap-1">
                {topics.map((topic) => (
                  <li key={topic.id}>
                    <button
                      type="button"
                      className="font-secondary text-p-sm text-neutral-black text-left underline disabled:no-underline disabled:opacity-40"
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
          <h3 className="font-secondary text-p-sm text-gray font-bold uppercase tracking-wide">
            Your own
          </h3>
          <textarea
            className="border-gray font-secondary text-p-sm w-full rounded-lg border p-2"
            value={custom}
            maxLength={TOPIC_MAX_CHARS}
            placeholder="Write the statement you disagree about."
            disabled={pending}
            onChange={(event) => setCustom(event.target.value)}
          />
          <button
            type="button"
            className="border-neutral-black font-secondary text-p-sm self-start rounded-full border-2 px-3 py-1 font-bold disabled:opacity-40"
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
        <h2 className="font-primary text-neutral-black flex items-center gap-2">
          <Glyph name="book" size={22} />
          The agreement
        </h2>
        <PlayerAgreement
          lines={SIGNING_LINES}
          signed={Boolean(mine?.signed)}
          peerSigned={peerSigned}
          disabled={pending || !signVerdict.ok}
          reason={signVerdict.ok ? undefined : signVerdict.error}
          onSign={() => run(() => signAgreement(gameId))}
        />
        <p className="font-secondary text-p-sm text-gray">
          Changing the topic clears both signatures, because this is what you are signing
          about.
        </p>
      </section>

      <section className="flex items-center gap-3">
        <button
          type="button"
          className="bg-gold text-neutral-white font-primary rounded-full px-4 py-2 shadow-md disabled:opacity-40"
          disabled={pending || !startVerdict.ok}
          title={startVerdict.ok ? undefined : startVerdict.error}
          onClick={() => run(() => startGame(gameId))}
        >
          Start the game
        </button>
        {startVerdict.ok ? null : (
          <span className="font-secondary text-p-sm text-gray">{startVerdict.error}</span>
        )}
      </section>

      <footer>
        <button
          type="button"
          className="font-secondary text-p-sm text-gray underline disabled:opacity-30"
          disabled={pending}
          onClick={() => run(() => leaveLobby(gameId))}
        >
          Leave the room
        </button>
      </footer>
    </main>
  );
}
