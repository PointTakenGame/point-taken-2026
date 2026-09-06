"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * The three-state "enter a topic" button, ported from `EnterTopicButton.vue`.
 * Purely presentational: hover/selected state only swaps the artwork.
 */
export function EnterTopicButton({
  selected = false,
  onClick,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const [hovering, setHovering] = useState(false);
  const src = selected
    ? "/buttons/EnterTopicSelected.svg"
    : hovering
      ? "/buttons/EnterTopicHover.svg"
      : "/buttons/EnterTopic.svg";

  return (
    <button
      type="button"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={onClick}
      className={`cursor-pointer ${className ?? ""}`}
    >
      <Image src={src} alt="Enter a topic" width={256} height={256} />
    </button>
  );
}
