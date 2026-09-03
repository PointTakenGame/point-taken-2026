import { CARD_WALL, ownedCards, type CardWallEntry } from "@/lib/progression/sample";
import { SectionHeading } from "@/components/account/account-shell";
import { SampleTag } from "./sample-tag";

/**
 * The rule-card wall: one tile per lib/progression/sample.ts's CARD_WALL,
 * owned, next, or later.
 *
 * The four ratified cards (BRAIN-T260903-10) keep their real thrown/coached
 * counts, read from the event history exactly as this page always showed
 * them; nothing about that path changed. The five later cards are Rannie's
 * names from the Figma card wall with no ratified rule behind them yet
 * (BRAIN-T260903-11), so they render dimmed, locked, and flagged with
 * SampleTag rather than counted.
 */

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-figure text-ink text-2xl leading-none font-black tabular-nums">
        {value}
      </span>
      <span className="font-label text-ink-soft text-[10px] font-bold tracking-widest uppercase">
        {label}
      </span>
    </div>
  );
}

function CardTile({
  entry,
  thrown,
  coached,
}: {
  entry: CardWallEntry;
  /** Real counts, only ever passed for an owned card. */
  thrown?: number;
  coached?: number;
}) {
  const locked = entry.ownership === "later";
  return (
    <li
      className={`sticker flex flex-col gap-3 p-5 ${locked ? "opacity-50 grayscale" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className="text-3xl">
          {entry.icon}
        </span>
        {locked ? (
          <span aria-hidden className="text-lg">
            🔒
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-figure text-ink text-lg font-black tracking-wide uppercase">
          {entry.name}
        </h3>
        <p className="font-secondary text-ink-soft text-p-sm">{entry.plain}</p>
      </div>
      {entry.ownership === "owned" && thrown !== undefined && coached !== undefined ? (
        <div className="flex gap-6 pt-1">
          <Count label="thrown" value={thrown} />
          <Count label="coached" value={coached} />
        </div>
      ) : null}
      {entry.ownership === "next" ? (
        <p className="font-label text-stat-warm text-xs font-bold tracking-widest uppercase">
          Level {entry.level}
        </p>
      ) : null}
      {locked ? (
        <p className="font-label text-ink-soft text-xs font-bold tracking-widest uppercase">
          Not yet in the deck
        </p>
      ) : null}
    </li>
  );
}

/** One row of the wall's grid: a real card tile, or the sample-data divider. */
type WallRow = { kind: "divider" } | { kind: "card"; entry: CardWallEntry };

export function CardWall({
  thrownById,
  coachedById,
}: {
  /** stats.cards_thrown_by_id, real counts keyed by card id. */
  thrownById: Record<string, number>;
  /** stats.coach_flags_by_id, real counts keyed by card id. */
  coachedById: Record<string, number>;
}) {
  const owned = ownedCards().length;
  const laterStart = CARD_WALL.findIndex((entry) => entry.ownership === "later");

  const rows: WallRow[] = CARD_WALL.flatMap((entry, index) =>
    index === laterStart
      ? [{ kind: "divider" }, { kind: "card", entry }]
      : [{ kind: "card", entry }],
  );

  return (
    <section className="mb-8">
      <SectionHeading
        title="Rule cards"
        note={`${owned} of ${CARD_WALL.length} in your hand`}
        noteTone="good"
      />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) =>
          row.kind === "divider" ? (
            <li
              key="later-divider"
              className="col-span-full flex items-center gap-2 pt-2"
            >
              <SampleTag />
              <span className="font-label text-ink-soft text-xs">
                More cards, not yet in anyone&rsquo;s deck.
              </span>
            </li>
          ) : (
            <CardTile
              key={row.entry.id}
              entry={row.entry}
              thrown={
                row.entry.ownership === "owned"
                  ? (thrownById[row.entry.id] ?? 0)
                  : undefined
              }
              coached={
                row.entry.ownership === "owned"
                  ? (coachedById[row.entry.id] ?? 0)
                  : undefined
              }
            />
          ),
        )}
      </ul>
    </section>
  );
}
