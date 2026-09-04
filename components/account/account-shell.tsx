import Link from "next/link";

import { Wordmark } from "@/components/brand/art";
import { OnboardingLauncher } from "@/components/onboarding/onboarding-launcher";

/**
 * The four-tab account hub, and the chrome every one of its pages sits in.
 *
 * Ported from Rannie's account frames (Figma 60wr75TY7I95UnL6jkLz2J, pulled
 * 2026-09-02, spec BRAIN-T260902-21) on Steve's 2026-09-02 instruction to make
 * her flow the base for the whole account area rather than a reference for it.
 * What comes from her: the warm grey ground, the dot grid across the top of it,
 * the four ghost outline tabs with the wordmark itself acting as the Profile
 * tab, and the 1229-wide content column inside a 1280 canvas.
 *
 * Two deliberate departures.
 *
 * The wordmark is the game's real drawn logo, not her Figma approximation of
 * it. She rebuilds it as two offset layers of Anton because Figma has no way to
 * place an SVG she does not have; we have the actual file the game has always
 * shipped under, and reproducing an approximation of our own logo would be a
 * strange thing to do on purpose.
 *
 * Her tab bar is drawn over the four routes that are her four frames, and ours
 * points at the routes those already live on (/account, /cards, /settings)
 * rather than moving them under /account to match her layer names. A tab is a
 * link; where the link goes is not an art-direction question, and moving three
 * live routes to satisfy a Figma folder name would break every link anyone has
 * already sent.
 */

export type AccountTab = "profile" | "cards" | "history" | "settings";

const TABS: { tab: AccountTab; href: string; label: string }[] = [
  // Order is hers, left to right. Profile is the wordmark and is rendered
  // separately below, so it is not in this list.
  { tab: "cards", href: "/cards", label: "Cards & Badges" },
  { tab: "history", href: "/account/history", label: "History" },
  { tab: "settings", href: "/settings", label: "Settings" },
];

/**
 * One ghost tab.
 *
 * Outline only, in ink, filled with the page ground so the border is the whole
 * shape. The active one is not a filled pill, it is the same outline with the
 * label in full-strength ink instead of the soft grey, which is exactly how she
 * draws it: the tabs are all present, and one of them is simply awake.
 */
function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`font-primary rounded-[10px] border border-ink px-6 py-3 text-xl transition-colors hover:bg-card ${
        active ? "text-ink bg-card" : "text-ink-soft"
      }`}
    >
      {label}
    </Link>
  );
}

export function AccountShell({
  tab,
  children,
}: {
  tab: AccountTab;
  children: React.ReactNode;
}) {
  return (
    <div className="dot-ground min-h-screen w-full">
      <div className="mx-auto w-full max-w-[1229px] px-6 py-10">
        <nav
          aria-label="Your account"
          className="flex flex-wrap items-center gap-4 pb-10"
        >
          {/* The logo is the Profile tab. Hers is the only tab without a
              border, so the mark sits on the ground rather than in a box. */}
          <Link
            href="/account"
            aria-current={tab === "profile" ? "page" : undefined}
            className={`pr-6 transition-opacity ${tab === "profile" ? "" : "opacity-60 hover:opacity-100"}`}
          >
            <Wordmark width={132} />
            <span className="sr-only">Profile</span>
          </Link>
          {TABS.map((entry) => (
            <Tab
              key={entry.href}
              href={entry.href}
              label={entry.label}
              active={tab === entry.tab}
            />
          ))}
        </nav>
        {children}
        {/*
          Her footer stamp, minus the season number. She prints "Point Taken ·
          Season 3 · v2.4.1 · © 2026" at the foot of every account frame, and a
          season is one of the systems nobody has decided exists
          (BRAIN-T260817-02); a version number pinned in a component would be a
          lie the day after it is written.

          It carries the way home, which nothing else on these pages does now
          that the site nav is gone from them.
        */}
        <footer className="font-label text-ink-soft flex flex-wrap items-center gap-2 pt-12 text-[10px]">
          <Link href="/" className="hover:text-ink transition-colors">
            Point Taken
          </Link>
          <span aria-hidden>·</span>
          <OnboardingLauncher className="hover:text-ink transition-colors">
            How to play
          </OnboardingLauncher>
          <span aria-hidden>·</span>
          <span>&copy; 2026</span>
        </footer>
      </div>
    </div>
  );
}

/**
 * The heading every account tab opens with: a big Anton title and one line
 * under it. Hers is 48px upper with a grey subhead, and the subhead string is
 * the same on three of the four frames, so it is a default here rather than a
 * required prop.
 */
export function AccountHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2 pb-8">
      <h1 className="font-primary text-ink text-5xl tracking-wide uppercase">{title}</h1>
      {children ? <p className="text-ink-soft font-secondary">{children}</p> : null}
    </header>
  );
}

/** A sticker panel: ink border, hard offset shadow, no blur. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={`sticker p-6 ${className ?? ""}`}>{children}</section>;
}

/**
 * A section heading inside a tab. Condensed, heavy, upper, with an optional
 * counter chip to its right, which is how she labels every list on the account
 * pages ("Recent Matches" and "4 games", "Level Progress Ladder" and
 * "3 / 8 Cleared").
 */
export function SectionHeading({
  title,
  note,
  noteTone = "muted",
}: {
  title: string;
  note?: string;
  noteTone?: "muted" | "good";
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
      <h2 className="font-figure text-ink text-2xl font-black tracking-wide uppercase">
        {title}
      </h2>
      {note ? (
        <span
          className={`font-label text-xs font-bold tracking-widest uppercase ${
            noteTone === "good" ? "text-stat-good" : "text-ink-soft"
          }`}
        >
          {note}
        </span>
      ) : null}
    </div>
  );
}
