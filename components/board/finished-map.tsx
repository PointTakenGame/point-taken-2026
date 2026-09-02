import type { BoardState, BoardThread, BoardTile } from "@/lib/board/project";
import { REDACTED_TEXT, agreedDefinitions, liveThreads } from "@/lib/board/project";
import { LocalDay } from "@/components/local-day";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";

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
          // The two sides are green and orange everywhere a player has seen
          // them, including on the board they just left. Rendering them here
          // as two grey punctuation marks throws that away on the one page
          // they are most likely to read end to end.
          className={`font-primary w-4 shrink-0 text-center text-lg leading-tight tabular-nums ${
            tile.side === "plus" ? "text-green" : "text-orange"
          }`}
        >
          {SIDE_MARK[tile.side]}
        </span>
        <span className="font-tiles flex-1 leading-snug">
          <Text tile={tile} />
          {tile.revised && (
            <span className="font-secondary text-gray ml-2 text-xs">
              revised after a card
            </span>
          )}
        </span>
      </div>

      {tile.children.length > 0 && (
        <ul className="border-neutral-black/15 ml-2 flex flex-col gap-2 border-l pl-4">
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
    <section className="border-neutral-black/15 flex break-inside-avoid flex-col gap-3 border-t pt-5">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="text-p-sm font-primary text-gray tracking-wide uppercase">
          Thread {index + 1}
        </h3>
        {thread.resolution ? (
          // How a thread ended is the one thing on this page that is not
          // words, so it is given the shape of the token it is: a pill, in
          // the sand the board uses for a thing both players agreed to.
          <p className="border-gold/50 bg-sand/30 text-p-sm flex items-center justify-end gap-1.5 rounded-full border px-3 py-1 text-right">
            <TokenGlyph token={thread.resolution.emoji} size={20} />
            <span>{tokenLabel(thread.resolution.emoji)}</span>
            {thread.resolution.note && (
              <span className="text-gray">{thread.resolution.note}</span>
            )}
          </p>
        ) : (
          <p className="text-p-sm text-gray">Unresolved</p>
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
          <p className="font-primary text-gray text-xs tracking-wide uppercase">
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
  const threads = liveThreads(board);
  const definitions = agreedDefinitions(board);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8 print:max-w-none print:p-0">
      <header className="flex flex-col gap-2">
        <p className="font-primary text-gold text-p-sm tracking-widest uppercase">
          {board.mode === "gym" ? "Gym run" : "Point Taken"}
          {endedAt && (
            <>
              {" · "}
              <LocalDay iso={endedAt} month="long" />
            </>
          )}
        </p>
        <h1 className="font-primary text-neutral-black text-3xl leading-tight text-balance">
          {board.currentTopicText ?? "No topic was set."}
        </h1>
        {revised && board.topic && (
          <p className="text-p-sm text-gray">
            Started from: {board.topic.redacted ? REDACTED_TEXT : board.topic.text}
          </p>
        )}
        <p className="text-p-sm text-gray">
          {board.players
            .map(
              (p) =>
                `${p.role ? SIDE_MARK[p.role] + " " : ""}${p.displayName ?? "Someone"}`,
            )
            .join("  vs  ")}
        </p>
      </header>

      <p className="text-p-sm text-gray">
        {board.status === "ended"
          ? (OUTCOME[board.winCondition ?? ""] ?? "Ended")
          : "Still in play, so this map is not final."}
        {` · ${threads.length} ${threads.length === 1 ? "thread" : "threads"}`}
        {` · ${live} ${live === 1 ? "reason" : "reasons"}`}
        {board.generosity.plus + board.generosity.minus > 0 &&
          ` · ${board.generosity.plus + board.generosity.minus} generosity given`}
      </p>

      {definitions.length > 0 && (
        <section className="flex break-inside-avoid flex-col gap-3">
          <h2 className="text-p-sm font-primary text-gray tracking-wide uppercase">
            Words you pinned down
          </h2>
          <dl className="flex flex-col gap-2 text-p-sm">
            {definitions.map((entry) => (
              <div key={entry.proposalId} className="flex flex-col">
                <dt className="font-tiles text-neutral-black">{entry.term}</dt>
                <dd className="text-gray">{entry.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {threads.length === 0 ? (
        <p className="text-gray">Nobody placed a reason, so there is no map to draw.</p>
      ) : (
        threads.map((thread, index) => (
          <Thread key={thread.rootId} thread={thread} index={index} />
        ))
      )}
    </article>
  );
}
