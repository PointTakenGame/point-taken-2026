import { TileShape } from "@/components/board/tile-shape";

/**
 * Neutral topic octagon, ported from the retired `TopicTile.vue`: same
 * `font-tiles` typeface, and an optional `onClick` for a revision affordance.
 *
 * Standalone only. On the board the topic is a cell like any other and is
 * drawn at the same size as a reason tile, which is what Rannie's render
 * shows: her topic and her reasons both measure 234px square.
 */
export function TopicTile({
  text,
  onClick,
}: {
  text: string | null;
  /** Renders the tile as a hover/click affordance. Omit for a plain tile. */
  onClick?: () => void;
}) {
  const tile = (
    <TileShape side="neutral" size={15} watermark="TOPIC">
      {text ? (
        <p
          className={`font-tiles text-p-md px-2 text-center ${
            onClick ? "group-hover:text-gold" : ""
          }`}
        >
          {text}
        </p>
      ) : (
        <p className="font-secondary text-p-sm text-gray text-center italic">
          No topic was set.
        </p>
      )}
    </TileShape>
  );

  return (
    <div className="flex justify-center py-4">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          title="Click to propose a revised topic"
          className="group cursor-pointer rounded-none border-none bg-transparent p-0"
        >
          {tile}
        </button>
      ) : (
        tile
      )}
    </div>
  );
}
