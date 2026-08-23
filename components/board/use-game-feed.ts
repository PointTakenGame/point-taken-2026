"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { browserClient } from "@/lib/supabase/browser";

/**
 * Hears the other player's moves.
 *
 * It does not read the events it is told about, and it does not project
 * anything: it asks the server to re-render, which re-reads the log and
 * re-projects. One projection, on the server, is the point. A client-side
 * projection would be a second implementation of the rules to keep in step.
 */
export function useGameFeed(gameId: string): { connected: boolean } {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = browserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    // One append often lands as several rows, so coalesce before refetching.
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 60);
    };

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_events",
          filter: `game_id=eq.${gameId}`,
        },
        refreshSoon,
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (timer) clearTimeout(timer);
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [gameId, router]);

  return { connected };
}
