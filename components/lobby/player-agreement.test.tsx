/** @vitest-environment jsdom */

/**
 * Tests for PledgeText, the renderer both agreement screens (lobby and Gym
 * level intro) use for the SIGNING_LINES pledges: a newline starts a new
 * paragraph, a word wrapped in single asterisks is italic, and the real
 * pledge strings in lib/board/setup.ts render without leaving any literal
 * asterisks on screen.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PledgeText } from "./player-agreement";
import { SIGNING_LINES } from "@/lib/board/setup";

afterEach(cleanup);

describe("PledgeText", () => {
  it("turns each newline into its own paragraph span", () => {
    const { container } = render(<PledgeText text={"First line.\nSecond line."} />);
    const paragraphs = container.querySelectorAll(":scope > span > span");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe("First line.");
    expect(paragraphs[1].textContent).toBe("Second line.");
  });

  it("renders a starred word as italic and drops the asterisks", () => {
    const { container } = render(<PledgeText text="They *might* change my mind." />);
    const em = container.querySelector("em");
    expect(em?.textContent).toBe("might");
    expect(container.textContent).toBe("They might change my mind.");
  });

  it("renders every real pledge with no literal asterisks", () => {
    for (const line of SIGNING_LINES) {
      const { container, unmount } = render(
        <PledgeText text={line.pledge ?? line.text} />,
      );
      expect(container.textContent).not.toContain("*");
      unmount();
    }
  });
});
