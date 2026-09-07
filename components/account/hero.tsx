import Link from "next/link";

import type { PlayerAwards } from "@/lib/db/awards";
import type { PlayerStats } from "@/lib/db/stats";
import type { PlayerRow } from "@/lib/db/types";
import { ladderFor } from "@/lib/progression/state";
import { AvatarPicker } from "@/components/account/avatar-picker";
import { NameReroll } from "@/components/account/name-reroll";
import { BUTTON_PRIMARY } from "@/components/account/account-shell";
import { LocalDay } from "@/components/local-day";
import { JoinRoomInline } from "@/components/rooms/room-entry";
import { StartNewGameButton } from "@/components/rooms/start-new-game";

/**
 * The top of the profile, as Rannie draws it (Figma `1066:216757`, adopted
 * object by object on 2026-09-04, BRAIN-T260904-40): who you are on the left,
 * the one way to play with a person on the right, and three numbers under
 * those.
 *
 * **The identity block is the hero.** It used to be a card two-thirds of the
 * way down the page, under the badges; a profile that introduces its owner
 * last is a strange profile. Hers is a large square avatar, the name in
 * display type, and "Player since". The location line under her name is left
 * out: nothing collects one, and a blank slot for it would be a promise.
 *
 * **The orange rule, Steve 2026-09-07.** Orange means "this is the thing to
 * click right now", and the page is allowed one of them at a time. It had
 * four: a level pill under the name, a Gym play button in this file's second
 * card, the current node on the ladder, and Fight this boss under it. Two of
 * those were removed here. The pill went because it was a label wearing the
 * action colour, and the whole "Active boss challenge" card went because it
 * was the ladder's boss briefing said a second time, one screen higher.
 *
 * **What is left is two jobs, not four.** Play with a person, which is this
 * card, and take the next step on the ladder, which is the ladder. They are
 * roughly matched in weight, with the ladder ahead while there is a level
 * left to clear: the ladder holds the orange and this card holds the ink
 * button, which is dark and loud but not the recommended move. When every
 * designed level is cleared the ladder has nothing left to point at, so the
 * orange comes here instead; `gymDone` below is that switch. Live play keeps
 * the room-code field because this is the home page and that field is what
 * the home page used to be for.
 *
 * **Live play reworked 2026-09-05 (BRAIN-T260905 profile play card rework).**
 * The card now offers "Start a new game" full width on its own row, "Join a
 * game" as a button with the room-number field beside it on the next, and
 * "Back to your game" as a quiet link at the foot, shown only when this
 * player has a game already running. Earlier this card only ever showed one
 * of starting or resuming, never both; Steve asked for both to be visible at
 * once.
 * What starting a new game does to an unfinished one was answered 2026-09-05
 * (Steve's ruling, BRAIN-T260905-44): starting a new game ends the unfinished
 * one, the same way leaving it would. `createRoom` calls `endInFlightGame`
 * (`lib/games/abandon.ts`) before opening the new room, so "Back to your
 * game" below naturally stops pointing at a game that no longer needs
 * resuming; it still exists for the crash case, a game left unfinished with
 * no new one started since.
 *
 * **Three stat tiles, not nine.** The old page had a four-tile Progress row
 * and a five-tile row in the identity card, with Games played in both. Hers
 * has three: games played, cooperation, and a rank. Rank and the global
 * percentile are undecided systems (BRAIN-T260817-02), so the third tile is
 * points, which is real.
 *
 * **The avatar is clickable, added 2026-09-04 (BRAIN-T260904-42).** It opens
 * a picker of the nine emoji Point Taken Heart already offers; the work is in
 * `components/account/avatar-picker.tsx`, this file only hands it the three
 * fields it needs. Nobody is picked by default, so a player who never opens
 * it keeps the same derived initials mark this page always drew.
 */

const CARD = "sticker hex-confetti flex flex-col gap-3 p-6";

const BUTTON_SECONDARY_INLINE =
  "font-primary inline-flex items-center rounded-lg border-[1.5px] border-ink bg-ink px-5 py-2.5 tracking-wide uppercase text-card shadow-sticker-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";

function StatTile({
  label,
  figure,
  note,
  noteTone,
  href,
}: {
  label: string;
  figure: string;
  note: string;
  noteTone: "warm" | "good";
  href?: string;
}) {
  const tone = noteTone === "good" ? "text-stat-good" : "text-stat-warm";
  const body = (
    <>
      <span className="font-figure text-ink shrink-0 text-4xl leading-none font-black tabular-nums">
        {figure}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-label text-ink-soft text-[10px] font-bold tracking-widest uppercase">
          {label}
        </span>
        <span
          className={`font-label text-[11px] leading-tight font-semibold ${tone} ${href ? "underline decoration-dotted" : ""}`}
        >
          {note}
        </span>
      </span>
    </>
  );
  const className = "sticker flex flex-1 items-center gap-3 px-4 py-3";
  if (href) {
    return (
      <Link
        href={href}
        className={`${className} transition-transform hover:-translate-y-0.5`}
      >
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

export function ProfileHero({
  player,
  playerId,
  awards,
  stats,
  gamesThisWeek,
  resumeGameId,
}: {
  player: PlayerRow | null;
  playerId: string;
  awards: PlayerAwards;
  stats: PlayerStats;
  gamesThisWeek: number;
  resumeGameId: string | null;
}) {
  // No current rung means every designed level is cleared, so the ladder has
  // no next step to offer and live play becomes the recommended action. See
  // the orange rule at the top of this file.
  const gymDone = ladderFor(awards).every((rung) => rung.status !== "current");
  const cleared = awards.clearedLevels.length;

  return (
    <div className="grid gap-10 pb-12 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2.4fr)]">
      <div className="flex flex-col items-center gap-3 pt-6 text-center">
        <AvatarPicker
          playerId={playerId}
          name={player?.display_name ?? null}
          currentEmoji={player?.avatar_emoji ?? null}
        />
        {/* Steve, 2026-09-07: nothing on this page said the name under the
            avatar was the reader's own. A player who never picked a name gets
            a generated one ("Scarlet Lucky Clover"), reads it cold at the top
            of a page full of other people's leaderboards and levels, and has
            no reason to know it is theirs. Two words above the name answer it,
            in the same micro-label type the stat tiles use, and they answer it
            for the avatar too since the avatar sits directly above. */}
        {/* Steve, 2026-09-07: the reroll button moved here from Settings, so
            the way to change the name sits beside the name itself. See
            components/account/name-reroll.tsx for the one-warning rule. */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <span className="font-label text-ink-soft text-[11px] font-bold tracking-widest uppercase">
            You are
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h1 className="font-primary text-ink text-3xl tracking-wide uppercase">
              {player?.display_name ?? "Your account"}
            </h1>
            {player?.display_name ? <NameReroll playerId={playerId} /> : null}
          </div>
        </div>
        <p className="font-label text-ink-soft text-sm">
          {player?.claimed_at ? (
            <>
              Player since <LocalDay iso={player.claimed_at} />
            </>
          ) : (
            <>
              {/* Steve, 2026-09-07. This used to read "Anonymous. Attach an
                  email in Settings to keep it.", which named the fix but left
                  Settings as a word to go hunting for. Now it says what is
                  happening in a full sentence, then makes Settings the link
                  it was already describing. His draft quoted the word as well
                  as linking it; a link and quotation marks are the same
                  emphasis twice, so the link carries it alone. */}
              You are playing anonymously.
              <br />
              To keep your account, pop an email in{" "}
              <Link
                href="/settings"
                className="text-ink underline decoration-dotted underline-offset-2"
              >
                Settings
              </Link>
              .
            </>
          )}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className={CARD}>
          <h2 className="font-figure text-ink text-2xl font-black tracking-wide uppercase">
            Play with your peers
          </h2>
          <p className="text-ink-soft font-secondary text-p-sm">
            Invite somebody you actually disagree with: start a room and read out the
            code, or type in one somebody sent you.
          </p>
          <StartNewGameButton
            className={`${gymDone ? BUTTON_PRIMARY : BUTTON_SECONDARY_INLINE} w-full justify-center`}
          />
          <JoinRoomInline signedIn buttonClassName={BUTTON_SECONDARY_INLINE} />
          {resumeGameId ? (
            <Link
              href={`/game/${resumeGameId}`}
              className="font-label text-ink-soft hover:text-ink self-start text-[10px] font-bold tracking-widest uppercase transition-colors"
            >
              Back to your game
            </Link>
          ) : null}
        </section>

        <div className="flex flex-col gap-3">
          <StatTile
            label="Games played"
            figure={String(stats.games_played)}
            note={gamesThisWeek > 0 ? `+${gamesThisWeek} this week` : "All time"}
            noteTone="warm"
          />
          <StatTile
            label="Cooperation score"
            figure={String(stats.threads_resolved)}
            note="Threads agreed · leaderboard"
            noteTone="good"
            href="/leaderboard?by=cooperation"
          />
          <StatTile
            label="Points"
            figure={String(awards.points)}
            note={
              cleared > 0
                ? `${cleared} level${cleared === 1 ? "" : "s"} cleared`
                : "None yet"
            }
            noteTone="warm"
          />
        </div>
      </div>
    </div>
  );
}
