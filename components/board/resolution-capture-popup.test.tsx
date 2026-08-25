/** @vitest-environment jsdom */

/**
 * Interaction tests for ResolutionCapturePopup: the opener can type and
 * submit, the peer sees the waiting/typing state before a submission
 * exists and the read-back afterward, and the peer's accept/reject buttons
 * are never gated on the (always-empty, for the peer) draft text.
 */

import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResolutionCapturePopup } from "./resolution-capture-popup";

afterEach(cleanup);

function isDisabled(element: HTMLElement): boolean {
  return (element as HTMLButtonElement).disabled === true;
}

function Harness({
  viewer,
  openerValue,
  openerTyping,
  onSubmit,
  onAccept,
  onReject,
}: {
  viewer: "opener" | "peer";
  openerValue: string | null;
  openerTyping?: boolean;
  onSubmit?: (value: string | { mine: string; theirs: string }) => void;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={anchorRef}>the tile</button>
      <ResolutionCapturePopup
        open
        onClose={() => {}}
        anchorRef={anchorRef}
        token="🔍"
        viewer={viewer}
        mySide="plus"
        openerValue={openerValue}
        openerTyping={openerTyping}
        onSubmit={onSubmit}
        onAccept={onAccept}
        onReject={onReject}
      />
    </div>
  );
}

describe("ResolutionCapturePopup: opener composing", () => {
  it("shows the opener's prompt heading and an empty field before submitting", () => {
    render(<Harness viewer="opener" openerValue={null} />);

    expect(screen.getByText("Disagree on a fact?")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("What's the fact that you two don't agree on?"),
    ).toBeTruthy();
  });

  it("lets the opener type, and typing updates the visible textarea", async () => {
    const user = userEvent.setup();
    render(<Harness viewer="opener" openerValue={null} />);

    const field = screen.getByPlaceholderText(
      "What's the fact that you two don't agree on?",
    ) as HTMLTextAreaElement;
    await user.type(field, "How many hours the office HVAC runs overnight");

    expect(field.value).toBe("How many hours the office HVAC runs overnight");
  });

  it("submits the typed value through onSubmit when the opener confirms", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness viewer="opener" openerValue={null} onSubmit={onSubmit} />);

    const field = screen.getByPlaceholderText(
      "What's the fact that you two don't agree on?",
    );
    await user.type(field, "Whether the thermostat log was ever shared");

    await user.click(screen.getByRole("button", { name: "DONE" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Whether the thermostat log was ever shared");
  });
});

describe("ResolutionCapturePopup: peer waiting and reviewing", () => {
  it("shows a waiting state for the peer before the opener has submitted", () => {
    render(<Harness viewer="peer" openerValue={null} />);

    expect(
      screen.queryByPlaceholderText("What's the fact that you two don't agree on?"),
    ).toBeNull();
  });

  it("shows the read-back heading and the opener's text once submitted", () => {
    render(
      <Harness viewer="peer" openerValue="Whether the thermostat log was ever shared" />,
    );

    expect(screen.getByText("This is why we do not agree")).toBeTruthy();
    expect(screen.getByText("Whether the thermostat log was ever shared")).toBeTruthy();
  });

  it("does not disable the peer's accept button even though the peer typed nothing", async () => {
    const onAccept = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        viewer="peer"
        openerValue="Whether the thermostat log was ever shared"
        onAccept={onAccept}
      />,
    );

    const acceptButton = screen.getByRole("button", { name: "ACCEPT" });
    expect(isDisabled(acceptButton)).toBe(false);

    await user.click(acceptButton);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("fires onReject when the peer cancels the review", async () => {
    const onReject = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        viewer="peer"
        openerValue="Whether the thermostat log was ever shared"
        onReject={onReject}
      />,
    );

    await user.click(screen.getByRole("button", { name: "REJECT" }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
