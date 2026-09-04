import Link from "next/link";
import { OnboardingLauncher } from "@/components/onboarding/onboarding-launcher";

/** The rules link lives here, not only in SiteNav, which renders nothing for a
 *  signed-out visitor: exactly the person who has never played. */
export function HomeLinks({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="text-p-sm text-ink-soft flex flex-col items-center gap-2 text-center">
      <p>
        Never played?{" "}
        <OnboardingLauncher className="decoration-gold text-ink underline underline-offset-2">
          How to play
        </OnboardingLauncher>{" "}
        walks the four steps right here.
      </p>
      {signedIn ? null : (
        <p>
          Played before and attached an email?{" "}
          <Link
            href="/signin"
            className="decoration-gold text-ink underline underline-offset-2"
          >
            Sign in
          </Link>{" "}
          to get back to those games. Otherwise just start a room: an account comes with
          it.
        </p>
      )}
    </footer>
  );
}
