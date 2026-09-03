import Link from "next/link";

import { LocalDay } from "@/components/local-day";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import type { GameTopic } from "@/lib/db/games";
import type { GameRow } from "@/lib/db/types";
import type { Uuid } from "@/lib/events/types";

/**
 * The archive of games, drawn as Rannie's match rows (Figma `1096:224142`,
 * spec BRAIN-T260902-21): one sticker row per game, with an outcome tag on the
 * right in the small condensed upper style she uses for every status pill.
 *
 * Shared by the Profile tab, which shows the four most recent, and the History
 * tab, which shows all of them. It was one list living inside /account before,
 * and splitting the tabs without splitting the component would have meant two
 * copies of it drifting apart within the week.
 *
 * Her rows lead with the opponent's name, because in her frames every opponent
 * is a named boss. Ours lead with the topic: in a live game the other player is
 * usually a first name or an unnamed guest, and the topic is the only part of a
 * game anybody recognises a week later. Three rows reading "vs Sam" tell you
 * nothing about which of them was the one about the parking permits.
 *
 * Her rows also carry a numeric score per player, "14 vs 11". This game has no
 * score, both win conditions are cooperative, and inventing one to fill the
 * column would be inventing a competitive game.
 */

/** What a game ended as, in the words a player would use, plus its tag colour. */
const OUTCOME: Record<string, { label: string; tone: "good" | "warm" | "muted" }> = {
  threads_resolved: { label: "Threads resolved", tone: "good" },
  topic_agreed: { label: "Topic revised", tone: "warm" },
  abandoned: { label: "Unfinished", tone: "muted" },
  timeout: { label: "Ran out of time", tone: "muted" },
};

/** How a game reads on one line when nobody has named the argument yet. */
const UNNAMED = "Not named yet";

/** The other player, when there is one and nobody has renamed them. */
const UNNAMED_PLAYER = "an unnamed player";

const TONE: Record<"good" | "warm" | "muted", string> = {
  good: "text-stat-good",
  warm: "text-stat-warm",
  muted: "text-ink-soft",
};

/**
 * How long the argument took, once it is over.
 *
 * Only a finished game has both stamps, so a game still running shows nothing
 * rather than a number that keeps growing while you look at it.
 */
export function duration(game: GameRow): string | null {
  if (!game.started_at || !game.ended_at) return null;
  const ms = Date.parse(game.ended_at) - Date.parse(game.started_at);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** The tag on the right of a row: what became of this game. */
function outcomeOf(game: GameRow): { label: string; tone: "good" | "warm" | "muted" } {
  if (game.status === "ended") {
    return OUTCOME[game.win_condition ?? ""] ?? { label: "Ended", tone: "muted" };
  }
  if (game.status === "active") return { label: "In progress", tone: "warm" };
  return { label: "Waiting to start", tone: "muted" };
}

export function MatchList({
  games,
  topics,
  opponents,
  cardsThrown,
  resolutions,
  empty,
}: {
  games: GameRow[];
  topics: Map<Uuid, GameTopic>;
  opponents: Map<Uuid, string | null>;
  cardsThrown: Map<Uuid, number>;
  resolutions: Map<Uuid, Map<string, number>>;
  /** What to say when there is nothing to list. */
  empty: string;
}) {
  if (games.length === 0) {
    return <p className="text-ink-soft font-secondary">{empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {games.map((game) => {
        const topic = topics.get(game.id);

        // A game nobody has joined yet is absent from the map, which is not the
        // same as a seat filled by somebody who has no name on record.
        const opponent = opponents.has(game.id)
          ? (opponents.get(game.id) ?? UNNAMED_PLAYER)
          : null;

        // Standing throws only, the ones the author did not decline. The same
        // number is the profile's "catches", whose player-facing label is still
        // unresolved (BIZ-T260823-04), so this row says what it counts instead.
        const cards = cardsThrown.get(game.id) ?? 0;
        const detail = [
          game.mode === "gym" ? "Gym" : "Live",
          opponent ? `with ${opponent}` : null,
          duration(game),
          cards > 0 ? `${cards} rule card${cards === 1 ? "" : "s"} thrown` : null,
        ].filter(Boolean);

        // How the threads in this game ended. The profile totals the same
        // tokens across every game; this is that game's share of them.
        const tokens = [...(resolutions.get(game.id) ?? [])];
        const outcome = outcomeOf(game);

        return (
          <li key={game.id}>
            <Link
              href={`/game/${game.id}`}
              className="sticker flex flex-wrap items-start justify-between gap-6 p-5 transition-transform hover:-translate-y-0.5"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={`font-label text-ink text-base font-bold ${topic ? "" : "opacity-50"}`}
                >
                  {topic?.text ?? UNNAMED}
                </span>
                <span className="font-label text-ink-soft text-xs">
                  {detail.join(" · ")}
                </span>
                {tokens.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-3 pt-1">
                    {tokens.map(([token, count]) => (
                      <span
                        key={token}
                        title={tokenLabel(token)}
                        className="text-ink-soft flex items-center gap-1 text-xs tabular-nums"
                      >
                        <TokenGlyph token={token} size={18} />
                        {count}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`font-label text-[10px] font-bold tracking-widest uppercase ${TONE[outcome.tone]}`}
                >
                  {outcome.label}
                </span>
                <span className="font-label text-ink-soft text-xs">
                  <LocalDay iso={game.ended_at ?? game.started_at ?? game.created_at} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
