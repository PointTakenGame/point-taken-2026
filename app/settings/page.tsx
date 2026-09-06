import Link from "next/link";

import { getPlayer } from "@/lib/db/players";
import { currentPlayerId } from "@/lib/supabase/session";
import {
  AccountHeading,
  AccountShell,
  Panel,
  SectionHeading,
} from "@/components/account/account-shell";
import { StartPlaying } from "../account/start-playing";
import { SettingsForm } from "./settings-form";

/**
 * The three things a player controls: their name, the coach, and whether the
 * account outlives this browser.
 *
 * Rebuilt 2026-09-02 into the account hub as its Settings tab, from Rannie's
 * Settings frame `1096:222248` (spec BRAIN-T260902-21). Hers carries rows this
 * game does not have: a coach persona picker with named characters, a public
 * profile visibility control, and notification preferences for scheduled
 * events. The persona picker was added 2026-09-03, reading
 * lib/progression/sample.ts, since the coach is picked once per account
 * rather than per level (BIZ-T260823-68); it holds its pick in React state
 * only, because there is no players column for it yet. The other two still
 * hang off systems that are not decided (BRAIN-T260817-02), so they stay
 * out.
 *
 * What her frame did have and this page was missing is the F&Q, so it is here
 * now, written rather than lorem. Her copy calls the practice mode the Dojo;
 * the decided name is the Gym (BRAIN-T260816-18), so it says Gym.
 */

export const dynamic = "force-dynamic";

/**
 * The questions a first-time player actually asks, answered on the page where
 * they are already looking for a way to change something.
 *
 * Native `<details>` rather than a toggle component: it opens with no
 * JavaScript, it is findable by the browser's own in-page search even while
 * closed, and this page is server-rendered.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Is there a way to win?",
    a: "Two, and both need the other player. You either resolve every thread on the board, by agreeing what kind of disagreement each one turned out to be, or you agree together on a new wording of the topic itself. Nobody wins alone and nobody scores points off the other side.",
  },
  {
    q: "What does throwing a rule card do?",
    a: "It says a reason broke one of the four rules everybody holds. The other player answers it: they rewrite the reason, or they say the card does not fit. Either way the reason stays on the board. A card never removes a tile and never costs anybody anything.",
  },
  {
    q: "Who can see what the coach says about me?",
    a: "Only you. The coach reads your own reasons and its notes never reach the other player. It is off until you turn it on, and while it is off nothing you write is sent anywhere.",
  },
  {
    q: "What is the Gym?",
    a: "A practice board you can open on your own, to try the moves without a second person waiting on you. Games you play there are marked Gym in your history and are kept apart from live games.",
  },
  {
    q: "I never made an account. Do I have one?",
    a: "Yes. Starting a room made one, gave you a name, and put it in this browser as a cookie. It has no password because there is nothing to type: attaching an email above is what makes it survive a cleared cache, and signing back in later is a mailed link.",
  },
  {
    q: "What happens to my games if I sign out?",
    a: "If you have attached an email, nothing: sign back in and they are all there. If you have not, signing out ends the only thing that could reach them. The page says so before the second click.",
  },
];

function Faq() {
  return (
    <Panel className="mt-8">
      <SectionHeading title="F&Q" note={`${FAQ.length} answers`} />
      <ul className="flex flex-col">
        {FAQ.map((entry) => (
          <li key={entry.q} className="border-ink/15 border-t first:border-t-0">
            <details className="group">
              <summary className="font-label text-ink hover:text-stat-warm flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-bold transition-colors">
                {entry.q}
                <span
                  aria-hidden
                  className="text-ink-soft shrink-0 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="font-secondary text-ink-soft text-p-sm pr-8 pb-4">
                {entry.a}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default async function SettingsPage() {
  const playerId = await currentPlayerId();
  const player = playerId ? await getPlayer(playerId) : null;

  if (!player) {
    return (
      <AccountShell tab="settings">
        <AccountHeading title="Settings">
          You are not signed in. Starting a game gives you a name and an account, with no
          email and no password.
        </AccountHeading>
        <Panel className="flex max-w-2xl flex-col items-start gap-4">
          <StartPlaying />
          <p className="font-secondary text-ink-soft text-p-sm">
            Or, if you attached an email to an account before,{" "}
            <Link href="/signin" className="text-ink underline">
              sign in
            </Link>{" "}
            and it comes back with its games.
          </p>
        </Panel>
        <Faq />
      </AccountShell>
    );
  }

  return (
    <AccountShell tab="settings">
      <AccountHeading title="Settings">
        Signed in as {player.display_name ?? "a player with no name yet"}.
      </AccountHeading>

      <div className="max-w-3xl">
        <SettingsForm
          displayName={player.display_name ?? ""}
          coachEnabled={player.coach_enabled}
          claimed={player.claimed_at !== null}
        />
        <Faq />
      </div>
    </AccountShell>
  );
}
