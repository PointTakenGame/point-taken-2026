import type { Metadata } from "next";
import { Anton, Coming_Soon, Noto_Sans } from "next/font/google";

import { BuildStamp } from "@/components/build-stamp";
import { FeedbackPopover } from "@/components/feedback/feedback-popover";
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
          Every page. This is the floating entry point into the shared
          feedback pop-up; the inline "Report a bug" variant lives inside
          the game board's own utility row instead.
        */}
        <FeedbackPopover variant="floating" />
        {/*
          Every page, not just the account page. Reviewers comment on the
          screen in front of them, and a comment is only attributable if the
          build id was visible from that screen.
        */}
        <footer className="px-8 pt-4 pb-6">
          <BuildStamp />
        </footer>
      </body>
    </html>
  );
}
