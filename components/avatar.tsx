import { avatarMark } from "@/lib/avatar";

/**
 * The coloured disc that stands in for a player.
 *
 * Hidden from screen readers on purpose. It carries no information that the
 * name beside it does not already carry, and it is always beside a name, so
 * announcing it would just read the same player twice.
 */

const SIZE = {
  sm: "h-8 w-8 text-xs",
  lg: "h-14 w-14 text-p-md",
} as const;

export function Avatar({
  playerId,
  name,
  size = "sm",
}: {
  playerId: string;
  name: string | null;
  size?: keyof typeof SIZE;
}) {
  const { background, initials } = avatarMark(playerId, name);

  return (
    <span
      aria-hidden="true"
      style={{ background }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide text-neutral-white ${SIZE[size]}`}
    >
      {initials}
    </span>
  );
}
