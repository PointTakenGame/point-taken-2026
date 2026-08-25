"use client";

import { useState } from "react";
import type { BoardTile } from "@/lib/board/project";
import { TileShape, type TileSide } from "@/components/board/tile-shape";

/**
 * A resolved thread, fanned into a stack of diamonds the way the retired
 * client's `CollapsedThread.vue` fanned a resolved thread's tiles: overlapping,
 * spaced apart on hover, most-recent tile on top.
 *
 * The retired component chose a prefix ("Yes, because" / "No, because") by
 * matching five hardcoded tile ids ('0' through '4') left over from a specific
 * early scripted thread in that engine. Tiles here carry UUIDs, so that
 * special case has nothing to attach to; what's ported is its general-case
 * fallback rule, unchanged: a tile that agrees with its parent's side reads
 * "Because," one that answers from the other side reads "Hmm."
 */

interface StackTile {
  id: string;
  side: TileSide;
  text: string;
  redacted: boolean;
  prefix: string;
}

function flattenInOrder(root: BoardTile): BoardTile[] {
  const out: BoardTile[] = [root];
  for (const child of root.children) {
    out.push(...flattenInOrder(child));
  }
  return out;
}

function buildStack(root: BoardTile): StackTile[] {
  const tiles = flattenInOrder(root);
  const bySide = new Map<string, TileSide>();
  return tiles.map((tile, index) => {
    const parentSide = tile.parentId ? bySide.get(tile.parentId) : undefined;
    bySide.set(tile.id, tile.side);
    const prefix = index === 0 ? "" : parentSide === tile.side ? "Because" : "Hmm";
    return {
      id: tile.id,
      side: tile.side,
      text: tile.text,
      redacted: tile.redacted,
      prefix,
    };
  });
}

export function CollapsedThread({ root }: { root: BoardTile }) {
  const [spread, setSpread] = useState(false);
  const stack = buildStack(root);
  const spacing = spread ? 3.5 : 1.5;

  return (
    <div
      className="relative"
      style={{ height: "9rem", width: `${9 + spacing * (stack.length - 1)}rem` }}
      onMouseEnter={() => setSpread(true)}
      onMouseLeave={() => setSpread(false)}
    >
      {stack.map((tile, index) => (
        <TileShape
          key={tile.id}
          side={tile.side}
          size={9}
          className="transition-[left] duration-150"
          style={{
            position: "absolute",
            top: 0,
            left: `${index * spacing}rem`,
            zIndex: 1 + (stack.length - index),
          }}
        >
          {tile.prefix && (
            <span className="text-p-sm opacity-60 italic">{tile.prefix}</span>
          )}
          <p className="text-p-sm line-clamp-3">
            {tile.redacted ? "[redacted]" : tile.text}
          </p>
        </TileShape>
      ))}
    </div>
  );
}
