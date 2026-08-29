"use client";

/**
 * The retired client demoted this to small print once you're already in a
 * room (RoomCodeDisplay.vue). Kept minimal here; copy-link stays a sibling
 * action next to it rather than a whole new card.
 */
interface RoomCodeDisplayProps {
  code: string;
  copied: boolean;
  onCopy: () => void;
}

export function RoomCodeDisplay({ code, copied, onCopy }: RoomCodeDisplayProps) {
  return (
    <p className="font-secondary text-p-sm text-gray flex items-center gap-2 font-medium tracking-wide">
      <span>
        Room <span className="text-neutral-black font-mono font-semibold">{code}</span>
      </span>
      <button type="button" onClick={onCopy} className="text-gold underline underline-offset-2">
        {copied ? "link copied" : "copy link"}
      </button>
    </p>
  );
}
