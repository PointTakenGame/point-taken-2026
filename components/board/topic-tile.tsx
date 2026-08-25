import { TileShape } from "@/components/board/tile-shape";

/**
 * The topic, shown the way the retired client's `TopicTile.vue` showed it: a
 * neutral (non-side) diamond with a stroked "TOPIC" watermark, centered above
 * the thread list, echoing that component's topic-at-center structure.
 *
 * Display only in this pass. The retired component's click-to-propose-a-
 * revision affordance opens a tile-anchored pop-up, and building that pop-up
 * is explicitly the parallel "Build tile pop-up primitive" agent's job
 * (`components/ui/tile-popover*`), not this one's. `TopicRevisionForm`
 * further down the board still carries that behavior as a plain inline form;
 * wiring a click-to-open affordance here is deferred until that primitive
 * lands and can be reviewed rather than duplicated.
 */
export function TopicTile({ text }: { text: string | null }) {
  return (
    <div className="flex justify-center py-4">
      <TileShape side="neutral" size={15} watermark="topic">
        <p className="font-secondary text-p-md px-2 text-center">
          {text ?? "No topic was set."}
        </p>
      </TileShape>
    </div>
  );
}
