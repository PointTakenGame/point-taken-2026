"use client";

import { useState, useTransition } from "react";

import type { BoardState } from "@/lib/board/project";
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
import { RoomCodeDisplay } from "@/components/lobby/room-code-display";
import { StancePicker } from "@/components/board/stance-picker";
import { TileShape } from "@/components/board/tile-shape";
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
 * The room before the game: settle the topic, pick a side, sign, start.
 *
 * Styled toward Rannie's "the host" frame (Figma node 1096:251293) as of
 * BRAIN-T260831-76: the numbered three-step flow, the room-code pill header
 * with per-player status, and the gold reveal for the topic shelf all come
 * from there. Every button still asks lib/board/setup for its verdict, so a
 * disabled control and a refused action give the same reason in the same
 * words; only the surface changed.
 *
 * Two deliberate departures from the frame, both decided rather than
 * discovered here. Rannie's frame draws four agreement lines with individual
 * checkboxes; the 2026-08-31 ruling (see this repo's CLAUDE.md, "Settled")
 * fixed the signing ritual at three lines signed as one act, and calls her
 * frame the stale one, so this screen keeps three. Her frame also orders
 * topic before stance, which the code below now follows too: canSetTopic and
 * canChooseSide in lib/board/setup.ts do not depend on each other, so nothing
 * about the rules required the old stance-then-topic order.
 */

const TIERS = ["Practice", "Serious Stuff", "Tough"] as const;

export interface GameSetupProps {
  gameId: string;
  board: BoardState;
  joinCode: string | null;
  me: { playerId: string; role: Side | null };
}

/**
 * One player's status in the room header: a name and whether they have
 * signed. The frame draws a gold check for a signed player and a grey "?"
 * for one who has not, using the same two octagon marks this codebase
 * already ships as unused icon art (player-confirmed.svg / player-missing.svg),
 * so this reaches for those rather than drawing new ones.
 */
function PlayerChip({
  name,
  signed,
  joined,
  mine,
}: {
  name: string;
  signed: boolean;
  /** False for the second seat before anybody has taken it. */
  joined: boolean;
  mine?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- small decorative status mark, no intrinsic size worth optimizing for */}
      <img
        src={signed ? "/icons/player-confirmed.svg" : "/icons/player-missing.svg"}
        alt=""
        aria-hidden="true"
        className={`h-6 w-6 object-contain ${joined ? "" : "opacity-50"}`}
      />
      <span className="flex flex-col leading-tight">
        <span
          className={`font-secondary text-p-sm font-semibold ${
            joined ? "text-neutral-black" : "text-gray"
          }`}
        >
          {name}
        </span>
        {mine ? <span className="font-secondary text-p-sm text-gray">(you)</span> : null}
      </span>
    </span>
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
      <p className="font-secondary text-p-sm text-gray text-center">
        Waiting for the other player. They come in through this room&apos;s invite link.
      </p>
    );
  }

  return (
    <div className="font-secondary text-p-sm text-gray mx-auto flex max-w-md flex-col gap-1 text-center">
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
  return <p className="font-secondary text-p-sm text-orange text-center">{error}</p>;
}

export function GameSetup({ gameId, board, joinCode, me }: GameSetupProps) {
  const { connected } = useGameFeed(gameId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [custom, setCustom] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Rannie's frame keeps the shelf behind a pill rather than always on screen,
  // which is the specific complaint this pass is fixing: this app already tore
  // out its other pick-from-a-list-of-links patterns, so the seventeen-topic
  // shelf should not be the one place that habit survives.
  const [showLibrary, setShowLibrary] = useState(false);

  const mine = board.players.find((player) => player.id === me.playerId);
  const peer = board.players.find((player) => player.id !== me.playerId);
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
        <h1 className="font-primary text-neutral-black text-3xl tracking-wide">
          You left this room
        </h1>
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
          <a
            className="font-secondary text-p-sm text-gold underline underline-offset-2"
            href="/account"
          >
            Back to your account
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      {/*
        Rannie's frame has no page title, only the room pill: it is enough
        context on its own once you are looking at a room you just made or
        just joined. An h1 still belongs in the document for anyone using a
        screen reader to orient on the page, so it stays, just not drawn.
      */}
      <h1 className="sr-only">Before you start</h1>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-full border-2 border-neutral-black bg-neutral-white px-6 py-3 shadow-sm">
          <div className="flex flex-none items-center" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark, sized by className not intrinsic dimensions */}
            <img src="/icons/minus.svg" alt="" className="h-5 w-5 object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark, sized by className not intrinsic dimensions */}
            <img
              src="/icons/plus.svg"
              alt=""
              className="-ml-1.5 h-5 w-5 object-contain"
            />
          </div>
          {joinCode ? (
            <RoomCodeDisplay code={joinCode} copied={copied} onCopy={copyInvite} />
          ) : (
            <p className="font-secondary text-p-sm text-gray">
              This room has no invite link.
            </p>
          )}
          <div className="flex flex-none items-center gap-4">
            <PlayerChip
              name={mine?.displayName ?? "You"}
              signed={Boolean(mine?.signed)}
              joined
              mine
            />
            {/*
              A peer who quit is still in board.players, so Boolean(peer) alone
              would draw them as present while the count and the Waiting text
              below both say the room is short a person. Quit reads as not
              joined here, which leaves their name visible but dimmed and
              unsigned rather than silently dropping them off the header.
            */}
            <PlayerChip
              name={peer?.displayName ?? "Player 2"}
              signed={Boolean(peer?.signed)}
              joined={Boolean(peer) && peer?.left !== "quit"}
            />
          </div>
        </div>
        <p className="font-secondary text-p-sm text-gray text-center">
          {connected ? "live" : "not listening"} &middot; {here.length}/{MAX_PLAYERS} here
        </p>
        <ErrorLine error={error} />
        {here.length < MAX_PLAYERS ? <Waiting hasInvite={Boolean(joinCode)} /> : null}
      </header>

      <section className="flex flex-col items-center gap-4 text-center">
        <h2 className="font-primary text-p-lg tracking-wide text-neutral-black">
          #1 The topic
        </h2>
        <p className="font-secondary text-p-sm text-gray italic">
          Pro tip: the Practice topics below are a good warmup before the Tough ones.
        </p>

        {/*
          The board's own topic tile (TopicTile, via TileShape) is a diamond,
          not the octagon Rannie draws, but it is the one topic shape this
          codebase actually has, right down to carrying the same "TOPIC"
          watermark hers does. Reusing it means a player meets this shape once
          here and recognises it again the moment the game starts, which
          matters more than matching her silhouette exactly.
        */}
        <TileShape side="neutral" size={16} watermark="topic">
          <textarea
            className="font-tiles text-p-md text-neutral-black placeholder:text-gray h-28 w-36 resize-none border-none bg-transparent text-center focus:outline-none"
            value={custom}
            maxLength={TOPIC_MAX_CHARS}
            placeholder="Should…"
            disabled={pending}
            aria-label="Write your own topic"
            onChange={(event) => setCustom(event.target.value)}
          />
        </TileShape>
        <button
          type="button"
          className="border-neutral-black font-secondary text-p-sm rounded-full border-2 px-5 py-1.5 font-bold disabled:opacity-40"
          disabled={pending || !customVerdict.ok}
          title={customVerdict.ok ? undefined : customVerdict.error}
          onClick={() => {
            setPicked(null);
            run(() => setTopic(gameId, { text: custom, topicId: null }));
          }}
        >
          Use this
        </button>

        {board.currentTopicText ? (
          <p className="border-gold bg-neutral-white font-secondary text-p-sm text-neutral-black max-w-md rounded-lg border-l-4 px-3 py-2 shadow-sm">
            Current topic: &ldquo;{board.currentTopicText}&rdquo;
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowLibrary((visible) => !visible)}
          aria-expanded={showLibrary}
          className="bg-gold text-neutral-white font-primary rounded-full px-6 py-2 tracking-wide shadow-md"
        >
          {showLibrary ? "Hide suggested topics" : "Check our suggested topics"}
        </button>

        {showLibrary ? (
          <div className="flex w-full max-w-xl flex-col gap-4 text-left">
            {TIERS.map((tier) => {
              const topics = TOPIC_LIBRARY.filter((topic) => topic.tier === tier);
              if (topics.length === 0) return null;
              return (
                <div key={tier} className="flex flex-col gap-2">
                  <h3 className="font-secondary text-p-sm text-gray font-bold uppercase tracking-wide">
                    {tier}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {topics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        disabled={pending}
                        aria-pressed={picked === topic.id}
                        onClick={() => {
                          setPicked(topic.id);
                          run(() =>
                            setTopic(gameId, { text: topic.text, topicId: topic.id }),
                          );
                        }}
                        className={`font-secondary text-p-sm rounded-xl border-2 px-4 py-3 text-left shadow-sm transition-colors disabled:opacity-40 ${
                          picked === topic.id
                            ? "border-gold bg-sand"
                            : "border-neutral-black/15 bg-neutral-white hover:border-neutral-black hover:bg-sand/30"
                        }`}
                      >
                        {topic.text}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col items-center gap-2">
        <h2 className="font-primary text-p-lg tracking-wide text-neutral-black">
          #2 Your stance
        </h2>
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

      {/*
        The white card here is this screen's version of the frame's white
        band: her layout can bleed the agreement step edge to edge because it
        is not built inside a centred max-width column, this one is, so a
        bordered card reads as the same "separate surface" cue without
        restructuring the page around one section.
      */}
      <section className="border-neutral-black bg-neutral-white flex flex-col gap-3 rounded-3xl border-2 p-6 shadow-sm sm:p-8">
        <h2 className="font-primary text-p-lg text-neutral-black flex items-center justify-center gap-2 text-center tracking-wide">
          <Glyph name="book" size={22} />
          #3 The agreement
        </h2>
        <PlayerAgreement
          lines={SIGNING_LINES}
          signed={Boolean(mine?.signed)}
          peerSigned={Boolean(peer?.signed)}
          disabled={pending || !signVerdict.ok}
          reason={signVerdict.ok ? undefined : signVerdict.error}
          onSign={() => run(() => signAgreement(gameId))}
        />
        <p className="font-secondary text-p-sm text-gray text-center">
          Changing the topic clears both signatures, because this is what you are signing
          about.
        </p>
      </section>

      <section className="flex flex-col items-center gap-2">
        <button
          type="button"
          className="bg-gold text-neutral-white font-primary rounded-full px-8 py-3 tracking-wide shadow-md disabled:opacity-40"
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

      <footer className="text-center">
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
