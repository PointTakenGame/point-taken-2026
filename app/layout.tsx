import type { Metadata } from "next";
import { Anton, Coming_Soon, Noto_Sans } from "next/font/google";

import { BuildStamp } from "@/components/build-stamp";
import { HideOnBoard } from "@/components/hide-on-board";
import { FeedbackPopover } from "@/components/feedback/feedback-popover";
import { AlertStack } from "@/components/alerts/alert-stack";
import "./globals.css";

/*
  The three faces the retired Nuxt client loads from Google Fonts. They are
  declared here rather than with a CSS @import so that Next self-hosts the
  files and nothing render-blocks on fonts.googleapis.com. Each exposes a CSS
  variable that app/globals.css reads in its @theme block.

  Anton and Coming Soon ship a single weight each, so weight is required.
*/
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

const comingSoon = Coming_Soon({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-coming-soon",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Point Taken",
  description: "A game about disagreeing well.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${anton.variable} ${notoSans.variable} ${comingSoon.variable}`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/*
          Every page. Renders whatever is currently in the toast stack
          (`components/alerts/alert-store.ts`); empty and invisible when
          nothing has been pushed. Nothing yet calls `alertActions.push` from
          `components/board/live-board.tsx` or elsewhere, so this mount makes
          the surface reachable without wiring any caller to it this round.
          See the build report for BRAIN-T260825-12.
        */}
        <AlertStack />
        {/*
          Every page except /game. This is the floating entry point into the
          shared feedback pop-up; it hides itself on game routes (see
          components/feedback/feedback-popover.tsx) so nothing floats over
          the board, and the inline "Report a bug" variant in the board's
          own utility row (components/board/live-board.tsx) takes over there.
        */}
        <FeedbackPopover variant="floating" />
        {/*
          Every page, not just the account page. Reviewers comment on the
          screen in front of them, and a comment is only attributable if the
          build id was visible from that screen. The board is the exception,
          and only in where rather than whether: it is a fixed full-screen
          surface, so a footer after it collapses into its top-left corner.
          LiveBoard prints the same stamp in its own bottom-left utility
          stack, beside Report a bug.
        */}
        <HideOnBoard>
          <footer className="px-8 pt-4 pb-6">
            <BuildStamp />
          </footer>
        </HideOnBoard>
      </body>
    </html>
  );
}
