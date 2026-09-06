import { currentPlayerId } from "@/lib/supabase/session";
import { AccountShell, Panel } from "@/components/account/account-shell";
import { Profile } from "./profile";
import { StartPlaying } from "./start-playing";

/**
 * The Profile tab.
 *
 * The screen itself is `profile.tsx`, because `/` renders the same thing for a
 * signed-in player (Steve, 2026-09-03). This route stays because it is the href
 * in the tab bar, in every link already sent, and in the hub's own footer.
 */

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const playerId = await currentPlayerId();

  if (!playerId) {
    return (
      <AccountShell tab="profile">
        <Panel className="flex max-w-2xl flex-col items-start gap-4">
          <h1 className="font-primary text-ink text-3xl tracking-wide">Your account</h1>
          <p className="text-ink-soft font-secondary">
            You are not signed in. Starting a game gives you a name and an account, with
            no email and no password. You can attach an email later to keep it.
          </p>
          <StartPlaying />
        </Panel>
      </AccountShell>
    );
  }

  return <Profile playerId={playerId} />;
}
