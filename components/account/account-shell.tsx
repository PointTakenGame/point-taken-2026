import Link from "next/link";

import { Wordmark } from "@/components/brand/art";
import { OnboardingLauncher } from "@/components/onboarding/onboarding-launcher";
import { buildStamp } from "@/lib/build-id";

/**
 * The four-tab account hub, and the chrome every one of its pages sits in.
 *
 * Ported from Rannie's account frames (Figma 60wr75TY7I95UnL6jkLz2J, pulled
 * 2026-09-02, spec BRAIN-T260902-21) on Steve's 2026-09-02 instruction to make
 * her flow the base for the whole account area rather than a reference for it.
 * What comes from her: the warm grey ground, the dot grid across the top of it,
 * and the 1229-wide content column inside a 1280 canvas.
 *
 * Reworked 2026-09-04 (BRAIN-T260904-40) after Steve compared the built page
 * against her Profile frame (`1066:216757`) object by object and took all of
 * it. Two of those objects live here: the whole page is now **one sheet**, a
 * single bordered card with the hard shadow, rather than a column of separate
 * sticker panels each shouting equally; and the tabs are **folder tabs**
 * die-cut into the sheet's top edge, the active one the same colour as the
 * sheet with its bottom edge open, so tab and page are one piece of card. The
 * footer also carries the build id now, where she prints a version number.
 *
 * Three deliberate departures survive from the first port.
 *
 * Profile is a written tab, where she has the wordmark carrying it silently.
 * Steve ruled on 2026-09-03 that it has to read as a tab. The mark is still
 * there, to the left of the row, and is now only the way home.
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
  // Order is hers, left to right. Profile is a tab of its own as of
  // 2026-09-03: she leaves the wordmark to carry it, and a logo is not read as
  // a tab by anybody who has not been told it is one, least of all by a screen
  // reader. The wordmark stays beside it and still goes home. Profile points at
  // "/" rather than /account because home is the profile now, and a tab bar
  // whose first tab leaves the page you are on is a small lie.
  { tab: "profile", href: "/", label: "Profile" },
  { tab: "cards", href: "/cards", label: "Cards & Badges" },
  { tab: "history", href: "/account/history", label: "History" },
  { tab: "settings", href: "/settings", label: "Settings" },
];

/**
 * One folder tab.
 *
 * The shape is an SVG behind the label: a rounded top-left corner, a straight
 * top, and a slanted right edge, stroked on those three sides and open along
 * the bottom. `preserveAspectRatio="none"` lets one path stretch to whatever
 * width the label needs, and `vector-effect="non-scaling-stroke"` keeps the
 * stroke at 1.5px however far it is stretched. The active tab is filled with
 * the sheet's colour and overlaps the sheet's top border by that same 1.5px,
 * which is what cuts it into the page; the inactive ones are filled with the
 * ground and sit on the border instead.
 */
function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`folder-tab font-primary text-xl transition-colors ${
        active ? "text-ink" : "text-ink-soft hover:text-ink"
      }`}
    >
      <svg viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden>
        <path
          d="M0 44 V8 Q0 0 8 0 H82 L100 44"
          fill={active ? "var(--color-card)" : "var(--color-paper)"}
          stroke="var(--color-ink)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {label}
    </Link>
  );
}

/** The footer's version line: her "v2.4.1", on the id Vercel actually stamped. */
function BuildLine() {
  const { id, where } = buildStamp();
  if (where === "local") return <span>Local build</span>;
  return (
    <span>
      {where === "preview" ? "Preview " : "Build "}
      <code className="font-mono select-all">{id}</code>
    </span>
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
      <div className="mx-auto w-full max-w-[1229px] px-6 pt-8 pb-10">
        <nav aria-label="Your account" className="flex flex-wrap items-end gap-x-2 pl-3">
          {/* The mark sits on the ground rather than in a box, which is how
              she draws it. It is the way home, not a tab. */}
          <Link href="/" className="pr-5 pb-2 transition-opacity hover:opacity-70">
            <Wordmark width={112} />
            <span className="sr-only">Point Taken home</span>
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
        <div className="account-sheet px-10 pt-10 pb-8 sm:px-12">
          {children}
          {/*
            Her footer stamp, minus the season number. She prints "Point Taken ·
            Season 3 · v2.4.1 · © 2026" at the foot of every account frame. A
            season is one of the systems nobody has decided exists
            (BRAIN-T260817-02), so it is left out; the version is the deploy id,
            which is the one version string that is never out of date.

            The launcher reads "Help" now, not "How to play" (Steve, 2026-09-04),
            styled as the small pill so it matches the "?" the live board already
            shows: same control, same word, two different surfaces to reach it
            from.
          */}
          <footer className="font-label text-ink-soft flex flex-wrap items-center justify-center gap-2 pt-12 text-[10px]">
            <Link href="/" className="hover:text-ink transition-colors">
              Point Taken
            </Link>
            <span aria-hidden>·</span>
            <OnboardingLauncher className="font-label border-ink/40 text-ink hover:bg-paper rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest uppercase">
              Help
            </OnboardingLauncher>
            <span aria-hidden>·</span>
            <BuildLine />
            <span aria-hidden>·</span>
            <span>&copy; 2026</span>
          </footer>
        </div>
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
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`sticker p-6 ${className ?? ""}`}>
      {children}
    </section>
  );
}

/**
 * A small filled chip: her "3 / 8 CLEARED" beside a heading, the LEVEL 4 tag
 * on the boss card, the category on an event row. One shape, four inks. The
 * tones are the ones her frame uses and no more: green for a count that is
 * going well, orange for something live or current, purple for a category,
 * and muted for a plain label.
 */
export function Chip({
  tone = "muted",
  className,
  children,
}: {
  tone?: "good" | "warm" | "category" | "muted";
  className?: string;
  children: React.ReactNode;
}) {
  const TONE = {
    good: "bg-mint/60 text-stat-good",
    warm: "bg-peach/70 text-stat-warm",
    category: "bg-[#e7dcf5] text-[#6b4fa3]",
    muted: "bg-paper text-ink-soft",
  } as const;
  return (
    <span
      className={`font-label inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${TONE[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

/**
 * A section heading inside a tab. Condensed, heavy, upper, with an optional
 * counter beside it, which is how she labels every list on the account pages
 * ("Recent Matches" and "4 games", "Level Progress Ladder" and "3 / 8
 * Cleared"). As of 2026-09-04 the counter is her filled chip rather than bare
 * coloured text, and sits beside the title rather than across from it.
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
    <div className="flex flex-wrap items-center gap-3 pb-4">
      <h2 className="font-figure text-ink text-2xl font-black tracking-wide uppercase">
        {title}
      </h2>
      {note ? <Chip tone={noteTone}>{note}</Chip> : null}
    </div>
  );
}

/**
 * The circled arrow inside a button that goes somewhere. Her rule, made ours:
 * a button that leaves the page carries it, a button that acts in place (sign
 * up, start a room) does not, so the glyph is the difference between "go" and
 * "do" without a word of copy.
 */
export function ArrowGlyph({ onDark = false }: { onDark?: boolean }) {
  return (
    <span
      aria-hidden
      className={`ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[13px] leading-none ${
        onDark ? "bg-card text-ink" : "bg-ink text-card"
      }`}
    >
      →
    </span>
  );
}

/** Her two button weights: orange for the recommended path, ink for the other one. */
export const BUTTON_PRIMARY =
  "font-primary inline-flex items-center rounded-lg border-[1.5px] border-ink bg-orange px-5 py-2.5 tracking-wide uppercase text-ink shadow-sticker-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";
export const BUTTON_SECONDARY =
  "font-primary inline-flex items-center rounded-lg border-[1.5px] border-ink bg-ink px-5 py-2.5 tracking-wide uppercase text-card shadow-sticker-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";
