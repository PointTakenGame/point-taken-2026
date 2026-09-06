/** @vitest-environment jsdom */

/**
 * Tests for RuleCardPopup: it renders the right card for each of the three
 * rule types, shows the agreement text and the two example tiles, and
 * closes on the dismiss control since a rule card has no confirm decision,
 * only a read-and-close action.
 */

import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RuleCardPopup, type RuleCardType } from "./rule-card-popup";

afterEach(cleanup);

function Harness({ type, onClose }: { type: RuleCardType; onClose?: () => void }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={anchorRef}>the tile</button>
      <RuleCardPopup
        open
        onClose={onClose ?? (() => {})}
        anchorRef={anchorRef}
        type={type}
      />
    </div>
  );
}

describe("RuleCardPopup: mutual-respect", () => {
  it("shows the header, subheader, and agreement text", () => {
    render(<Harness type="mutual-respect" />);

    expect(screen.getByText("Mutual Respect")).toBeTruthy();
    expect(screen.getByText("'You' is Taboo")).toBeTruthy();
    expect(
      screen.getByText(
        "I won't use 'you' or 'yours'. I'll critique arguments, not people.",
      ),
    ).toBeTruthy();
  });

  it("shows both example tiles", () => {
    render(<Harness type="mutual-respect" />);

    expect(
      screen.getByText("Hmm, why don't you care about the thermostat setting?"),
    ).toBeTruthy();
    expect(screen.getByText("Hmm, that thermostat setting wastes energy")).toBeTruthy();
  });
});

describe("RuleCardPopup: honest-thinking", () => {
  it("shows the header and subheader", () => {
    render(<Harness type="honest-thinking" />);

    expect(screen.getByText("Honest Thinking")).toBeTruthy();
    expect(screen.getByText("Let's Clarify?")).toBeTruthy();
  });
});

describe("RuleCardPopup: shared-facts", () => {
  it("shows the header and subheader", () => {
    render(<Harness type="shared-facts" />);

    expect(screen.getByText("Shared Evidence")).toBeTruthy();
    expect(screen.getByText("Fact Check?")).toBeTruthy();
  });
});

describe("RuleCardPopup: dismissing", () => {
  it("calls onClose from the close control, with no confirm control present", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness type="mutual-respect" onClose={onClose} />);

    expect(screen.queryByRole("button", { name: /confirm/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
