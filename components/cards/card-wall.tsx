import Image from "next/image";

import type { PlayerAwards } from "@/lib/db/awards";
import { cardArt } from "@/lib/progression/art";
import { CARD_WALL, type CardWallEntry } from "@/lib/progression/sample";
import { ladderFor } from "@/lib/progression/state";

/**
 * The rule-card wall: one tile per ratified card, owned, next, or later.
 *
 * Owned means earned. Since 0014_awards.sql a card arrives by clearing the
 * level that teaches it, so this reads the player's own level_cleared events
 * rather than a hand-written ownership field. "Next" is the card taught by the
 * level they are on now; the rest are locked, and locked here means not yet
 * trained rather than not yet written.
 *
 * The thrown and coached counts were always real, read from the event history,
 * and that path is unchanged.
 *
 * Gone: Rannie's five later cards, which rendered here as locked sample tiles.
 * Steve, 2026-09-03, cards 5 to 11 stay out.
 *
 * The tile itself is now her drawing (Steve, 2026-09-07): her illustration
 * across the head of the card, the level in a green octagon punched through
 * the corner, our names and our plain-English lines underneath. A card with no
 * drawing falls back to the emoji panel, so a missing file is a plain tile
 * rather than a hole.
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
  const art = cardArt(entry.id);
  return (
    <li className={`rule-card ${locked ? "opacity-55" : ""}`}>
      {entry.level === null ? null : (
        <>
          <span aria-hidden className="rule-card-chip-ring octagon" />
          <span
            aria-hidden
            className="rule-card-chip octagon font-figure text-base leading-none font-black"
          >
            {entry.level}
          </span>
        </>
      )}
      {art ? (
        <div className={`rule-card-art ${locked ? "grayscale" : ""}`}>
          <Image src={art} alt="" width={667} height={580} />
        </div>
      ) : (
        <div className="rule-card-art flex items-center justify-center">
          <span aria-hidden className="text-5xl">
            {entry.icon}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-3 p-5">
        {locked ? (
          <span aria-hidden className="text-lg leading-none">
            🔒
          </span>
        ) : null}
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
            {entry.level === null ? "Not yet in the deck" : `Clear level ${entry.level}`}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function CardWall({
  awards,
  thrownById,
  coachedById,
}: {
  awards: PlayerAwards;
  /** stats.cards_thrown_by_id, real counts keyed by card id. */
  thrownById: Record<string, number>;
  /** stats.coach_flags_by_id, real counts keyed by card id. */
  coachedById: Record<string, number>;
}) {
  const held = new Set(awards.cardIds);
  const nextCardId =
    ladderFor(awards).find((rung) => rung.status === "current")?.cardId ?? null;

  const entries: CardWallEntry[] = CARD_WALL.map((entry) => ({
    ...entry,
    ownership: held.has(entry.id) ? "owned" : entry.id === nextCardId ? "next" : "later",
  }));

  return (
    <section className="mb-8">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <CardTile
            key={entry.id}
            entry={entry}
            thrown={entry.ownership === "owned" ? (thrownById[entry.id] ?? 0) : undefined}
            coached={
              entry.ownership === "owned" ? (coachedById[entry.id] ?? 0) : undefined
            }
          />
        ))}
      </ul>
    </section>
  );
}
