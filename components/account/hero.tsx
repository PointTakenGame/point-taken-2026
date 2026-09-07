import Link from "next/link";

import type { PlayerAwards } from "@/lib/db/awards";
import type { PlayerStats } from "@/lib/db/stats";
import type { PlayerRow } from "@/lib/db/types";
import { levelById } from "@/lib/gym/levels";
import { ladderFor } from "@/lib/progression/state";
import { AvatarPicker } from "@/components/account/avatar-picker";
import { NameReroll } from "@/components/account/name-reroll";
import { ArrowGlyph, BUTTON_PRIMARY } from "@/components/account/account-shell";
import { LocalDay } from "@/components/local-day";
import { JoinRoomInline } from "@/components/rooms/room-entry";
import { StartNewGameButton } from "@/components/rooms/start-new-game";
import { StartLevelButton } from "@/components/gym/start-level-button";

/**
 * The top of the profile, as Rannie draws it (Figma `1066:216757`, adopted
 * object by object on 2026-09-04, BRAIN-T260904-40): who you are on the left,
 * the two ways to play on the right, and three numbers under those.
 *
 * **The identity block is the hero.** It used to be a card two-thirds of the
 * way down the page, under the badges; a profile that introduces its owner
 * last is a strange profile. Hers is a large square avatar, the name in
 * display type, "Player since", and an orange level pill. The location line
 * under her name is left out: nothing collects one, and a blank slot for it
 * would be a promise. The pill is the one-glance answer to "where am I" that
 * the old page spread across three cards.
 *
 * **Two action cards, weighted.** Gym play carries the orange button, Live
 * play the ink one, both with the circled arrow because both leave the page.
 * The Gym is the recommended path for somebody new, and the colour says so
 * without copy. Live play keeps the room-code field because this is the home
 * page and that field is what the home page used to be for.
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
      <span className="font-label text-ink-soft text-[11px] font-bold tracking-widest uppercase">
        {label}
      </span>
      <span className="font-figure text-ink text-5xl leading-none font-black tabular-nums">
        {figure}
      </span>
      <span
        className={`font-label text-xs font-semibold ${tone} ${href ? "underline decoration-dotted" : ""}`}
      >
        {note}
      </span>
    </>
  );
  const className = "sticker flex flex-col items-center gap-2 px-4 py-6 text-center";
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
  currentLevelId,
  resumeGameId,
}: {
  player: PlayerRow | null;
  playerId: string;
  awards: PlayerAwards;
  stats: PlayerStats;
  gamesThisWeek: number;
  currentLevelId: string;
  resumeGameId: string | null;
}) {
  const current = ladderFor(awards).find((rung) => rung.status === "current") ?? null;
  const level = levelById(currentLevelId);
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
            {player?.display_name ? (
              <NameReroll current={player.display_name} playerId={playerId} />
            ) : null}
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
        {current ? (
          <span className="font-primary border-ink bg-orange text-ink shadow-sticker-sm mt-1 rounded-lg border-[1.5px] px-4 py-1.5 text-sm tracking-wide">
            Level {current.level}: {current.title}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid gap-6 md:grid-cols-2">
          <section className={CARD}>
            <h2 className="font-figure text-ink text-2xl font-black tracking-wide uppercase">
              Active boss challenge
            </h2>
            <p className="text-ink-soft font-secondary text-p-sm flex-1">
              {/* The first of the level's own learning goals, which is
                written to stand on its own as a one-line summary of what the
                level is for. Steve, 2026-09-07: this card used to promise a
                rule card and describe a habit, and a player who has not
                played yet cannot picture either. Falls back to the habit
                sentence for a level with no goals written. */}
              {level
                ? (level.learningGoals?.[0] ??
                  `Level ${level.number}, ${level.title}: you will reform ${level.bossName}, who ${level.bossHabit ?? "argues badly on purpose"}.`)
                : "Practise on your own against an opponent who argues badly on purpose."}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <StartLevelButton levelId={currentLevelId} className={BUTTON_PRIMARY}>
                Gym play
                <ArrowGlyph />
              </StartLevelButton>
              <Link
                href="/#ladder"
                className="font-label text-ink-soft hover:text-ink text-[10px] font-bold tracking-widest uppercase transition-colors"
              >
                or pick a level
              </Link>
            </div>
          </section>

          <section className={CARD}>
            <h2 className="font-figure text-ink text-2xl font-black tracking-wide uppercase">
              Play with your peers
            </h2>
            <p className="text-ink-soft font-secondary text-p-sm">
              Invite somebody you actually disagree with: start a room and read out the
              code, or type in one somebody already sent you.
            </p>
            <StartNewGameButton
              className={`${BUTTON_SECONDARY_INLINE} w-full justify-center`}
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
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
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
