"use client";

/**
 * The boundary below the boundary: for when the root layout itself throws.
 *
 * `app/error.tsx` renders inside the layout, so it cannot catch a failure of
 * the layout. This one replaces the whole document, which is why it has to
 * carry its own html and body tags.
 *
 * Everything here is deliberately dependency-free. No stylesheet, because the
 * failure it handles may be the stylesheet. No Link, because a full page load
 * is exactly the right way out of a broken root. No shared components, because
 * a shared component is one more thing that can be the thing that broke. It is
 * the least clever file in the repo on purpose.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.5,
          margin: 0,
          padding: "3rem 2rem",
          maxWidth: "36rem",
        }}
      >
        <h1 style={{ fontSize: "1.25rem" }}>Point Taken did not load</h1>
        <p>
          Something failed early enough that none of the page could draw. Nothing you have
          played is lost.
        </p>
        <p>
          <button type="button" onClick={reset} style={{ font: "inherit" }}>
            Try again
          </button>
        </p>
        {error.digest ? (
          <p>
            If you report it, quote this:{" "}
            <code style={{ fontWeight: 600 }}>{error.digest}</code>
          </p>
        ) : null}
        <p>
          {/*
            A real page load, not a Link. Link does a soft navigation into the
            same React tree that just failed to render, which is the one place
            it cannot help. Throwing the document away is the way out.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Back to the front door</a>
        </p>
      </body>
    </html>
  );
}
