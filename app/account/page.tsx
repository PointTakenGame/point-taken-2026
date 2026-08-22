import { currentPlayerId } from "@/lib/supabase/session";
import { getPlayer } from "@/lib/db/players";
import { getPlayerStats, type PlayerStats } from "@/lib/db/stats";
import { listGamesForPlayer } from "@/lib/db/games";
import type { GameRow } from "@/lib/db/types";
import { StartPlaying } from "./start-playing";

/**
 * The page a player lands on after signing in: who they are, what they have
 * done, and every game they have been in.
 *
 * Deliberately unstyled beyond plain type. Rannie's profile frames carry a
 * level ladder, a ranked division and a cooperation score that are not decided
 * yet (BRAIN-T260817-02, BRAIN-T260816-08), so building to them now would bake
 * in numbers the game does not have. Registry row BRAIN-T260714-69.
 */

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const day = (iso: string | null) => (iso ? DAY.format(new Date(iso)) : "");

/** What a game ended as, in the words a player would use. */
const OUTCOME: Record<string, string> = {
  threads_resolved: "All threads resolved",
  topic_agreed: "Agreed a new topic",
  abandoned: "Abandoned",
  timeout: "Ran out of time",
};

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-current/15 p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm opacity-70">{label}</div>
    </div>
  );
}

function History({ games }: { games: GameRow[] }) {
  if (games.length === 0) {
    return <p className="opacity-70">No games yet. The first one starts the archive.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-current/10">
      {games.map((game) => (
        <li key={game.id} className="flex items-baseline justify-between gap-4 py-3">
          <span>
            {game.mode === "gym" ? "Gym" : "Live"}
            <span className="opacity-70">
              {game.status === "ended"
                ? ` ${OUTCOME[game.win_condition ?? ""] ?? "Ended"}`
                : game.status === "active"
                  ? " In progress"
                  : " Waiting to start"}
            </span>
          </span>
          <span className="shrink-0 text-sm opacity-70">
            {day(game.ended_at ?? game.started_at ?? game.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Signature({ stats }: { stats: PlayerStats }) {
  const emoji = Object.entries(stats.resolutions_by_emoji);
  if (emoji.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">How your threads end</h2>
      <ul className="flex flex-wrap gap-4">
        {emoji.map(([mark, count]) => (
          <li key={mark} className="tabular-nums">
            <span className="text-xl">{mark}</span> {count}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AccountPage() {
  const playerId = await currentPlayerId();

  if (!playerId) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="opacity-70">
          You are not signed in. Starting a game gives you a name and an account,
          with no email and no password. You can attach an email later to keep it.
        </p>
        <StartPlaying />
      </main>
    );
  }

  const [player, stats, games] = await Promise.all([
    getPlayer(playerId),
    getPlayerStats(playerId),
    listGamesForPlayer(playerId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {player?.display_name ?? "Your account"}
        </h1>
        <p className="text-sm opacity-70">
          {player?.claimed_at
            ? `Account kept since ${day(player.claimed_at)}.`
            : "This account is anonymous. Attach an email to keep it."}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Counter label="Games played" value={stats.games_played} />
        <Counter label="Games finished" value={stats.games_completed} />
        <Counter label="Threads resolved" value={stats.threads_resolved} />
        <Counter label="Tiles placed" value={stats.tiles_placed} />
      </section>

      <Signature stats={stats} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Your games</h2>
        <History games={games} />
      </section>
    </main>
  );
}
