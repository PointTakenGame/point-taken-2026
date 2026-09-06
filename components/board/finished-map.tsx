import type { BoardState, BoardThread, BoardTile } from "@/lib/board/project";
import { REDACTED_TEXT, agreedDefinitions, liveThreads } from "@/lib/board/project";
import { LocalDay } from "@/components/local-day";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import { TileShape } from "@/components/board/tile-shape";
import { stripDuplicateLead, tileLead } from "@/components/board/side-label";
import type { Side } from "@/lib/events/types";

/**
 * A finished game, drawn as the argument it was.
 *
 * Presentational and pure: it takes a projected board and renders it, so the
 * same component serves the standalone map page, the per-game view inside the
 * account archive, and anything that prints. No data access, no interactivity.
 * Registry row BRAIN-T260714-73.
 *
 * The thread grid mirrors the live board's own tiles (`TileShape`, `tileLead`,
 * `stripDuplicateLead`) rather than a text tree, per Steve's playtest note
 * (BRAIN-T260904-48): what he saw after a game should look like what he saw
 * during it. A plain-text rendering of the same threads still sits below the
 * grid, inside a `<details>`, so a screen reader or a printed page keeps the
 * words even where the octagon art does not carry over.
 */

const OUTCOME: Record<string, string> = {
  threads_resolved: "Every thread resolved",
  topic_agreed: "Agreed a revised topic",
  abandoned: "Left unfinished",
  timeout: "Ran out of time",
};

const SIDE_MARK = { plus: "+", minus: "−" } as const;

/** Compact size for a finished-map tile: same box collapsed-thread.tsx used. */
const TILE_REM = 9;

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

/** The same thread, as a tree of words, for `<details>` at the bottom. */
function ThreadText({ thread, index }: { thread: BoardThread; index: number }) {
  return (
    <section className="border-neutral-black/15 flex flex-col gap-3 border-t pt-5">
      <header className="flex items-baseline justify-between gap-4">
        <h4 className="text-p-sm font-primary text-gray tracking-wide uppercase">
          Thread {index + 1}
        </h4>
        {thread.resolution ? (
          <p className="text-p-sm text-right">
            {tokenLabel(thread.resolution.emoji)}
            {thread.resolution.note && (
              <span className="text-gray"> · {thread.resolution.note}</span>
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

/**
 * One tile in a thread column, drawn the way the board draws a placed tile:
 * `tileLead` for the sentence-starter, `stripDuplicateLead` so a player who
 * typed their own "Yes, because" does not read it twice.
 */
function ColumnTile({ tile, lead }: { tile: BoardTile; lead: string }) {
  const body = tile.redacted ? REDACTED_TEXT : stripDuplicateLead(tile.text);
  return (
    <div title={tile.redacted ? REDACTED_TEXT : tile.text}>
      <TileShape side={tile.side} size={TILE_REM}>
        <span className="text-p-sm opacity-60 italic">{lead}</span>
        <p
          className={`text-p-sm line-clamp-3 ${tile.redacted ? "italic opacity-50" : ""}`}
        >
          {body}
        </p>
        {tile.revised && (
          <span className="font-secondary text-gray text-xs">revised after a card</span>
        )}
      </TileShape>
    </div>
  );
}

/**
 * Flattens a tile and its live descendants depth-first, in placement order,
 * pairing each with its lead-in.
 *
 * `root` is either a thread's actual root (opening reason, answers the
 * topic directly) or the head of an orphaned subtree (its own parent was
 * removed). Either way, a tile's lead comes from its own side against its
 * parent's, the same computation `live-board.tsx` runs for a selected tile:
 * a parent not found in this subtree (the orphan case) reads as no known
 * side, which `tileLead` renders as "Hmm" rather than crashing on it.
 */
function flattenColumn(root: BoardTile): { tile: BoardTile; lead: string }[] {
  const sideById = new Map<string, Side>();
  const out: { tile: BoardTile; lead: string }[] = [];

  const walk = (tile: BoardTile) => {
    const isOpeningReason = tile.isOpeningReason || tile.parentId === null;
    const parentSide = tile.parentId ? (sideById.get(tile.parentId) ?? null) : null;
    out.push({ tile, lead: tileLead(tile.side, isOpeningReason, parentSide) });
    sideById.set(tile.id, tile.side);
    for (const child of tile.children) walk(child);
  };

  walk(root);
  return out;
}

function ColumnStack({ root }: { root: BoardTile }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {flattenColumn(root).map(({ tile, lead }) => (
        <ColumnTile key={tile.id} tile={tile} lead={lead} />
      ))}
    </div>
  );
}

function ThreadColumn({ thread, index }: { thread: BoardThread; index: number }) {
  return (
    <section className="flex flex-col items-center gap-3 break-inside-avoid">
      <header className="flex w-full items-center justify-between gap-2">
        <h3 className="text-p-sm font-primary text-gray tracking-wide uppercase">
          Thread {index + 1}
        </h3>
        {thread.resolution ? (
          <p className="border-gold/50 bg-sand/30 text-p-sm flex items-center gap-1.5 rounded-full border px-3 py-1">
            <TokenGlyph token={thread.resolution.emoji} size={18} />
            <span>{tokenLabel(thread.resolution.emoji)}</span>
          </p>
        ) : (
          <p className="text-p-sm text-gray">Unresolved</p>
        )}
      </header>

      {thread.resolution?.note && (
        <p className="text-p-sm text-gray w-full">{thread.resolution.note}</p>
      )}

      {thread.root ? (
        <ColumnStack root={thread.root} />
      ) : (
        <p className="text-gray text-p-sm opacity-50">
          The reason this thread started from is gone.
        </p>
      )}

      {thread.orphans.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <p className="font-primary text-gray text-xs tracking-wide uppercase">
            Replies to a removed reason
          </p>
          {thread.orphans.map((orphan) => (
            <ColumnStack key={orphan.id} root={orphan} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Which column a thread belongs in. A thread whose root was removed still
 *  has a side, by way of whatever orphan is left standing in it; only a
 *  thread with neither falls back to the plus column, which cannot happen
 *  for a thread `liveThreads` returns (it has at least one live tile). */
function threadSide(thread: BoardThread): Side {
  return thread.root?.side ?? thread.orphans[0]?.side ?? "plus";
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

  const minusThreads = threads.filter((thread) => threadSide(thread) === "minus");
  const plusThreads = threads.filter((thread) => threadSide(thread) === "plus");
  const indexByRoot = new Map(threads.map((thread, index) => [thread.rootId, index]));

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
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 print:grid-cols-2">
          <div className="flex flex-col gap-8">
            {minusThreads.map((thread) => (
              <ThreadColumn
                key={thread.rootId}
                thread={thread}
                index={indexByRoot.get(thread.rootId) ?? 0}
              />
            ))}
          </div>
          <div className="flex flex-col gap-8">
            {plusThreads.map((thread) => (
              <ThreadColumn
                key={thread.rootId}
                thread={thread}
                index={indexByRoot.get(thread.rootId) ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {threads.length > 0 && (
        <details className="text-neutral-black">
          <summary className="text-p-sm font-primary text-gray cursor-pointer tracking-wide uppercase">
            Read it as text
          </summary>
          <div className="mt-4 flex flex-col gap-8">
            {threads.map((thread, index) => (
              <ThreadText key={thread.rootId} thread={thread} index={index} />
            ))}
          </div>
        </details>
      )}
    </article>
  );
}
