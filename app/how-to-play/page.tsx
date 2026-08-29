import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { OnboardingLauncher } from "@/components/onboarding/onboarding-launcher";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import { COACH_CARDS } from "@/lib/coach/cards";
import { JOIN_CODE_LENGTH } from "@/lib/games/joinCode";
import {
  MAX_THREADS,
  MIN_THREADS_TO_END,
  RESOLUTION_TOKENS,
  TILE_MAX_CHARS,
} from "@/lib/board/rules";

/**
 * The rules, for somebody who has never seen this game.
 *
 * It exists because the repo says outright that there is no ruleset document in
 * it, and the people about to test the deployed site are landing cold. The front
 * door explains the game in one sentence, which is the right length for a front
 * door and the wrong length for a first game.
 *
 * Two things govern how it is written.
 *
 * Every number on this page is imported rather than typed. A rules page that
 * says "a hundred characters" is a second rulebook the moment somebody edits
 * `lib/board/rules.ts`, and the player who trusted it is the one who finds out.
 * The same goes for the token art, the card names, and the length of a room
 * code: each is read from the one place that already decides it.
 *
 * And it does not settle anything CLAUDE.md lists as still moving. The thread
 * minimum in particular is carried forward from the retired 2024 server and has
 * never been ratified (BRAIN-T260823-10), so it is described as what the code
 * currently does, and said out loud at the bottom rather than quietly asserted.
 * Writing "four" here would be choosing, and choosing is not this page's job.
 *
 * No politically readable examples anywhere on it. The game is about
 * disagreement and the instructions cannot be seen to have a side, so where an
 * example was needed it is about a word rather than about a position.
 */

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-current/10 pt-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function HowToPlay() {
  return (
    <>
      <SiteNav here="how" />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">How to play</h1>
          <p className="text-gray">
            Two people who disagree about one thing, writing short reasons at each other
            until they can name exactly where they part ways. Nobody wins by scoring
            points off the other one. Both ways the game can end are agreements.
          </p>
          {/*
            The least invasive entry point available to a presentation-layer
            change: this page already exists to teach a player cold, and this
            adds one button rather than touching a live board's render path.
            See components/onboarding/onboarding-overlay.tsx for why it is
            reachable only from here and not yet from the board itself.
          */}
          <OnboardingLauncher />
        </header>

        <Section title="Getting a second person in">
          <p className="text-p-sm text-gray">
            Start a room and you get a {JOIN_CODE_LENGTH}-character code. The other player
            types it on the front page, or opens the link you send them, and that seats
            them. One of you is Plus and one is Minus. The seat is yours for the rest of
            the game.
          </p>
          <p className="text-p-sm text-gray">
            Testing on your own? Open a second browser, or a private window, and join with
            the code there. The two seats are two sessions, so one window each is all it
            takes. There is no computer opponent.
          </p>
          <p className="text-p-sm text-gray">
            Either player can set the topic and start. There is no host, and no waiting on
            one.
          </p>
        </Section>

        <Section title="A turn">
          <p className="text-p-sm text-gray">
            You write one reason, up to {TILE_MAX_CHARS} characters, and hang it off a
            reason already on the board. That is what makes this a board rather than a
            chat log: everything points at the thing it is answering, so the argument
            grows as a set of threads instead of a scroll.
          </p>
          <p className="text-p-sm text-gray">
            A reason hung straight off the topic starts a new thread. A board holds at
            most {MAX_THREADS} of them, which is a limit on how many arguments you can
            have going at once, not on how deep any one of them goes.
          </p>
        </Section>

        <Section title="Ending a thread">
          <p className="text-p-sm text-gray">
            A thread ends when both of you put down the same token. Not when one of you
            concedes, and not when a timer runs out. The token is a shared answer to what
            kind of disagreement this turned out to be.
          </p>
          <ul className="flex flex-col gap-2">
            {RESOLUTION_TOKENS.map((token) => (
              <li key={token} className="flex items-center gap-3 text-p-sm">
                <TokenGlyph token={token} size={28} />
                <span className="text-gray">{tokenLabel(token)}</span>
              </li>
            ))}
          </ul>
          <p className="text-p-sm text-gray">
            Put one down and the other player sees it. If they put down a different one,
            nothing is settled and the thread stays open, which is the correct outcome:
            you do not yet agree about what you disagree about.
          </p>
        </Section>

        <Section title="Asking the other player for something">
          <p className="text-p-sm text-gray">
            Some moves need both of you. You send the ask, they accept or decline, and
            nothing changes on the board until they answer.
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-p-sm text-gray">
            <li>Move a reason to a place on the board where it fits better.</li>
            <li>Pin down a word, so the rest of the game uses it the same way.</li>
            <li>Say their side back to them, and ask whether you have it right.</li>
            <li>Write a reason for their side that you think they missed.</li>
            <li>Hand a reading back, if the version they wrote of your side is wrong.</li>
            <li>Propose a new wording for the topic itself.</li>
          </ul>
        </Section>

        <Section title="The cards">
          <p className="text-p-sm text-gray">
            Everyone holds the same {COACH_CARDS.length} cards. Throwing one says a reason
            broke that rule. The consequence is always that the reason gets rewritten,
            never that anybody loses anything.
          </p>
          <ul className="flex flex-col gap-2">
            {COACH_CARDS.map((card) => (
              <li key={card.id} className="flex gap-3 text-p-sm">
                <span aria-hidden className="text-p-lg leading-none">
                  {card.icon}
                </span>
                <span>
                  <span className="font-medium">{card.name}</span>
                  <span className="text-gray"> {card.plain}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-p-sm text-gray">
            The coach, if you turn it on in{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            , reads from these same {COACH_CARDS.length} cards and nothing else. It can
            tell you a reason of yours looks like one of them before you place it, and
            only you ever see that. It is off by default, and a game with it off is a
            complete game.
          </p>
        </Section>

        <Section title="How the game ends">
          <p className="text-p-sm text-gray">Two ways, and both are agreements.</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-p-sm text-gray">
            <li>
              Every thread on the board is resolved, once there are at least{" "}
              {MIN_THREADS_TO_END} of them.
            </li>
            <li>
              You agree on a rewritten wording of the topic, one both sides could sign.
            </li>
          </ul>
          <p className="text-p-sm text-gray">
            Either way the board stays readable afterwards, with every thread and the
            token you landed on for it.
          </p>
        </Section>

        <Section title="Things not to file a bug about yet">
          <p className="text-p-sm text-gray">
            This is a prototype, and some of it is genuinely undecided rather than
            unfinished. Known and being argued about: how many threads a game should need
            before it can end, what the levels and badges are called, how much of a turn
            the coach gets, and the wording of the agreement you sign at the start. If
            something in that list looks wrong to you, say so, but it is a decision
            waiting to be made and not a defect.
          </p>
          <p className="text-p-sm text-gray">
            Everything else is fair game.{" "}
            <Link href="/" className="underline">
              Start a room
            </Link>{" "}
            and see.
          </p>
        </Section>
      </main>
    </>
  );
}
