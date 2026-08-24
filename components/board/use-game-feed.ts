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
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // One append often lands as several rows, so coalesce before refetching.
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 60);
    };

    // The socket has to be carrying this player's own token before it joins,
    // not a moment after. Every insert is authorised against the claims the
    // channel joined with, and the anonymous key has no read on game_events at
    // all, so a channel that wins the race against the session gets
    // "Unauthorized" for every row and never recovers by itself. The session is
    // read from a cookie, which is asynchronous, so waiting for it is the fix.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token);
      if (cancelled) return;

      channel = supabase
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
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setConnected(false);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [gameId, router]);

  return { connected };
}
