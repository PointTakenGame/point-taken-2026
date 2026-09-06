"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { startLevel } from "@/app/gym/actions";

/** Opens a cooked game for one level and goes to its board. */
export function StartLevelButton({
  levelId,
  className,
  children = "Start",
}: {
  levelId: string;
  className: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startLevel(levelId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push(`/game/${result.gameId}`);
          });
        }}
      >
        {pending ? "Opening..." : children}
      </button>
      {error ? (
        <span className="font-secondary text-p-sm text-red-700">{error}</span>
      ) : null}
    </span>
  );
}
