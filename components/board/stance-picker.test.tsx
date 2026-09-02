/** @vitest-environment jsdom */

/**
 * Interaction tests for StancePicker: the line above the buttons, a pick
 * emitting the right side, aria-pressed following the selected value, and a
 * disabled side refusing the click.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StancePicker } from "./stance-picker";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StancePicker: heading and buttons", () => {
  it("renders the heading and both side labels", () => {
    render(<StancePicker value={null} onPick={() => {}} />);

    expect(
      screen.getByText(
        "Agree or disagree with the topic above. Once the game starts, your side is fixed.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Agree \(\+\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Disagree \(-\)/ })).toBeTruthy();
  });
});

describe("StancePicker: picking a side", () => {
  it("calls onPick with plus when the plus button is clicked", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<StancePicker value={null} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: /Agree \(\+\)/ }));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("plus");
  });

  it("calls onPick with minus when the minus button is clicked", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<StancePicker value={null} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: /Disagree \(-\)/ }));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("minus");
  });
});

describe("StancePicker: selected state", () => {
  it("marks the chosen side aria-pressed and leaves the other one not pressed", () => {
    render(<StancePicker value="plus" onPick={() => {}} />);

    const plusButton = screen.getByRole("button", { name: /Agree \(\+\)/ });
    const minusButton = screen.getByRole("button", { name: /Disagree \(-\)/ });

    expect(plusButton.getAttribute("aria-pressed")).toBe("true");
    expect(minusButton.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("StancePicker: disabled sides", () => {
  it("does not call onPick when the clicked side is in disabledSides", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<StancePicker value={null} onPick={onPick} disabledSides={["minus"]} />);

    const minusButton = screen.getByRole("button", { name: /Disagree \(-\)/ });
    expect((minusButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(minusButton);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("disables both sides when the disabled prop is set", () => {
    render(<StancePicker value={null} onPick={() => {}} disabled />);

    const plusButton = screen.getByRole("button", { name: /Agree \(\+\)/ });
    const minusButton = screen.getByRole("button", { name: /Disagree \(-\)/ });

    expect((plusButton as HTMLButtonElement).disabled).toBe(true);
    expect((minusButton as HTMLButtonElement).disabled).toBe(true);
  });
});
