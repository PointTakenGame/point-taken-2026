"use client";

import { useSyncExternalStore } from "react";

/** The reader's timezone never changes mid-visit, so there is nothing to watch. */
const subscribe = () => () => {};

/**
 * A date written in the reader's own timezone.
 *
 * The server has no idea where the reader is, so the markup it sends says UTC
 * and the browser corrects it on hydration. Without this a game played on a
 * Sunday evening in Chicago is filed under Monday, which is the kind of small
 * lie that makes a history feel untrustworthy.
 *
 * useSyncExternalStore rather than an effect: the two snapshots are exactly the
 * server reading and the client reading of one value, which is what it is for.
 */
export function LocalDay({
  iso,
  month = "short",
}: {
  iso: string;
  /** Matches Intl's month field: "short" for lists, "long" for a headline. */
  month?: "short" | "long";
}) {
  const format = (timeZone: string | undefined) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month,
      day: "numeric",
      timeZone,
    }).format(new Date(iso));

  const text = useSyncExternalStore(
    subscribe,
    () => format(undefined),
    () => format("UTC"),
  );

  return <time dateTime={iso}>{text}</time>;
}
