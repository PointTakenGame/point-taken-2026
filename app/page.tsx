import { RoomEntry } from "@/components/rooms/room-entry";

/**
 * The front door: start a room, or join one with its code.
 *
 * Plain type on purpose. Rannie's frames for this surface are aesthetics to
 * apply later, and the roadmap governs what is on the screen (BRAIN-T260823-09).
 */

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Point Taken</h1>
        <p className="opacity-70">
          A writing game for two people who disagree. You trade reasons, link
          them, and find out exactly where you part ways.
        </p>
      </header>
      <RoomEntry />
    </main>
  );
}
