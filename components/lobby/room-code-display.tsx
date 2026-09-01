"use client";

/**
 * The retired client demoted this to small print once you're already in a
 * room (RoomCodeDisplay.vue). Rannie's room-header pill (Figma 1096:251293)
 * gives the code the size a code you read aloud to another person deserves,
 * so as of BRAIN-T260831-76 this promotes it to the gold Anton numeral and
 * turns the whole line into the click target, still firing the same onCopy.
 */
interface RoomCodeDisplayProps {
  code: string;
  copied: boolean;
  onCopy: () => void;
}

export function RoomCodeDisplay({ code, copied, onCopy }: RoomCodeDisplayProps) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="flex flex-col items-center gap-0.5 text-center"
    >
      <span className="font-primary text-p-lg text-gold tracking-wide">{code}</span>
      <span className="font-secondary text-p-sm text-gray underline underline-offset-2">
        {copied ? "link copied" : "Share with your peer to join"}
      </span>
    </button>
  );
}
