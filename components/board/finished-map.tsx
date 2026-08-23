import type { BoardState, BoardThread, BoardTile } from "@/lib/board/project";
import { REDACTED_TEXT } from "@/lib/board/project";

/**
 * A finished game, drawn as the argument it was.
 *
 * Presentational and pure: it takes a projected board and renders it, so the
 * same component serves the standalone map page, the per-game view inside the
 * account archive, and anything that prints. No data access, no interactivity.
 * Registry row BRAIN-T260714-73.
 */

const OUTCOME: Record<string, string> = {
  threads_resolved: "Every thread resolved",
  topic_agreed: "Agreed a revised topic",
  abandoned: "Left unfinished",
  timeout: "Ran out of time",
};

const SIDE_MARK = { plus: "+", minus: "−" } as const;

const DAY = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function Text({ tile }: { tile: BoardTile }) {
  if (tile.redacted) {
    return <span className="italic opacity-50">{REDACTED_TEXT}</span>;
  }
  return <span>{tile.text}</span>;
}

function Branch({ tile }: { tile: BoardTile }) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span
          aria-label={tile.side === "plus" ? "Agrees" : "Disagrees"}
          className="w-4 shrink-0 text-center font-semibold tabular-nums opacity-60"
        >
          {SIDE_MARK[tile.side]}
        </span>
        <span className="flex-1">
          <Text tile={tile} />
          {tile.revised && (
            <span className="ml-2 text-xs opacity-50">revised after a card</span>
          )}
        </span>
      </div>

      {tile.children.length > 0 && (
        <ul className="ml-2 flex flex-col gap-2 border-l border-current/15 pl-4">
          {tile.children.map((child) => (
            <Branch key={child.id} tile={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Thread({ thread, index }: { thread: BoardThread; index: number }) {
  return (
    <section className="flex break-inside-avoid flex-col gap-3 border-t border-current/15 pt-5">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Thread {index + 1}
        </h3>
        {thread.resolution ? (
          <p className="text-right text-sm">
            <span className="mr-1 text-lg align-middle">{thread.resolution.emoji}</span>
            {thread.resolution.note && (
              <span className="opacity-70">{thread.resolution.note}</span>
            )}
          </p>
        ) : (
          <p className="text-sm opacity-50">Unresolved</p>
        )}
      </header>

      <ul className="flex flex-col gap-2">
        {thread.root ? (
          <Branch tile={thread.root} />
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
              <Branch key={tile.id} tile={tile} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function FinishedMap({
  board,
  endedAt = null,
}: {
  board: BoardState;
  endedAt?: string | null;
}) {
  const revised = (board.topic?.revisions.length ?? 0) > 0;
  const live = board.tiles.filter((tile) => !tile.removed).length;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8 print:max-w-none print:p-0">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-wide opacity-60">
          {board.mode === "gym" ? "Gym run" : "Point Taken"}
          {endedAt && ` · ${DAY.format(new Date(endedAt))}`}
        </p>
        <h1 className="text-2xl font-semibold text-balance">
          {board.currentTopicText ?? "No topic was set."}
        </h1>
        {revised && board.topic && (
          <p className="text-sm opacity-70">
            Started from: {board.topic.redacted ? REDACTED_TEXT : board.topic.text}
          </p>
        )}
        <p className="text-sm opacity-70">
          {board.players
            .map((p) => `${p.role ? SIDE_MARK[p.role] + " " : ""}${p.displayName ?? "Someone"}`)
            .join("  vs  ")}
        </p>
      </header>

      <p className="text-sm opacity-70">
        {board.status === "ended"
          ? (OUTCOME[board.winCondition ?? ""] ?? "Ended")
          : "Still in play, so this map is not final."}
        {` · ${board.threads.length} ${board.threads.length === 1 ? "thread" : "threads"}`}
        {` · ${live} ${live === 1 ? "reason" : "reasons"}`}
        {board.generosity.plus + board.generosity.minus > 0 &&
          ` · ${board.generosity.plus + board.generosity.minus} generosity given`}
      </p>

      {board.threads.length === 0 ? (
        <p className="opacity-70">Nobody placed a reason, so there is no map to draw.</p>
      ) : (
        board.threads.map((thread, index) => (
          <Thread key={thread.rootId} thread={thread} index={index} />
        ))
      )}
    </article>
  );
}
