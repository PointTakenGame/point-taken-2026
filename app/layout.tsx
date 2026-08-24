import type { Metadata } from "next";

import { BuildStamp } from "@/components/build-stamp";
import "./globals.css";

export const metadata: Metadata = {
  title: "Point Taken",
  description: "A game about disagreeing well.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
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
