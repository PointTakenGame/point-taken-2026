/** @vitest-environment jsdom */

/**
 * Tests for TilePicker, the chip row that replaced the three `<select>`
 * pickers on the live board. What matters here is that every option is on the
 * screen without opening anything, that pressing one reports its id, and that
 * the optional "no tile" chip reports the empty string rather than being
 * silently skipped.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TilePicker, type TileChoice } from "./tile-picker";

afterEach(cleanup);

const CHOICES: TileChoice[] = [
  { id: "t1", side: "plus", label: "Cheaper power over a decade" },
  { id: "t2", side: "minus", label: "The waste outlives the plant" },
];

describe("TilePicker", () => {
  it("shows every choice at once, with no menu to open", () => {
    render(
      <TilePicker legend="Hang it under" choices={CHOICES} value="" onChange={vi.fn()} />,
    );

    expect(screen.getByText("Cheaper power over a decade")).toBeTruthy();
    expect(screen.getByText("The waste outlives the plant")).toBeTruthy();
    expect(document.querySelector("select")).toBeNull();
  });

  it("reports the id of the chip that was pressed", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TilePicker
        legend="Hang it under"
        choices={CHOICES}
        value=""
        onChange={onChange}
      />,
    );

    await user.click(screen.getByText("The waste outlives the plant"));
    expect(onChange).toHaveBeenCalledWith("t2");
  });

  it("marks the chosen chip pressed and the others not", () => {
    render(
      <TilePicker
        legend="Hang it under"
        choices={CHOICES}
        value="t1"
        onChange={vi.fn()}
      />,
    );

    const pressed = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain("Cheaper power over a decade");
  });

  it("offers the no-tile chip only when a caller supplies its wording", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <TilePicker
        legend="Hang it under"
        choices={CHOICES}
        value="t1"
        noneLabel="Nothing: start its own thread"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByText("Nothing: start its own thread"));
    expect(onChange).toHaveBeenCalledWith("");

    rerender(
      <TilePicker
        legend="Hang it under"
        choices={CHOICES}
        value="t1"
        onChange={onChange}
      />,
    );
    expect(screen.queryByText("Nothing: start its own thread")).toBeNull();
  });

  it("disables every chip while a turn is in flight", () => {
    render(
      <TilePicker
        legend="Hang it under"
        choices={CHOICES}
        value=""
        disabled
        onChange={vi.fn()}
      />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
