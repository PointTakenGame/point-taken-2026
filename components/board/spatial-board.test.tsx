/** @vitest-environment jsdom */

/**
 * Tests for the SpatialBoard's view controls: what the wheel does, and what
 * the zoom cluster offers.
 *
 * The wheel is the whole point of this file. Every wheel event used to zoom,
 * so a player who scrolled two fingers to look at the far side of the board
 * watched it shrink instead of slide. The rule now is the one every other
 * canvas uses: two fingers pan, and a pinch zooms, a pinch being a wheel
 * event carrying `ctrlKey`.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpatialBoard, type SpatialTile } from "./spatial-board";

afterEach(cleanup);

const TILES: SpatialTile[] = [{ id: "t1", parentId: null, placedAtSeq: 1 }];

function renderBoard() {
  const { container } = render(
    <SpatialBoard
      tiles={TILES}
      topic={<span>the topic</span>}
      renderTile={(tile) => <span>{tile.id}</span>}
    />,
  );
  // The component's root is the pane, and the pane's only positioned child is
  // the canvas that pan and zoom are written onto.
  const pane = container.firstElementChild as HTMLElement;
  const canvas = pane.firstElementChild as HTMLElement;
  return { pane, canvas };
}

/** The percentage readout, which is where zoom is observable from outside. */
function zoomPercent() {
  return screen.getByText(/^\d+%$/).textContent;
}

describe("SpatialBoard: the wheel", () => {
  it("pans by the scroll delta and leaves the zoom alone", () => {
    const { pane, canvas } = renderBoard();
    const before = { left: canvas.style.left, top: canvas.style.top };
    const zoomBefore = zoomPercent();

    fireEvent.wheel(pane, { deltaX: 30, deltaY: 40 });

    // Scrolling down and right moves the board up and left, the way content
    // moves under a scroll everywhere else.
    expect(canvas.style.left).toBe(`${parseFloat(before.left) - 30}px`);
    expect(canvas.style.top).toBe(`${parseFloat(before.top) - 40}px`);
    expect(zoomPercent()).toBe(zoomBefore);
  });

  it("zooms when the wheel carries ctrl, which is what a pinch sends", () => {
    const { pane } = renderBoard();
    const before = parseInt(zoomPercent() ?? "0", 10);

    fireEvent.wheel(pane, { deltaY: -100, ctrlKey: true });

    expect(parseInt(zoomPercent() ?? "0", 10)).toBeGreaterThan(before);
  });

  it("treats a line-mode wheel as lines rather than pixels", () => {
    const { pane, canvas } = renderBoard();
    const before = parseFloat(canvas.style.top);

    // deltaMode 1 means lines. Panning by 3 there is three lines, not three
    // pixels, which would otherwise be an imperceptible nudge.
    fireEvent.wheel(pane, { deltaY: 3, deltaMode: 1 });

    expect(parseFloat(canvas.style.top)).toBe(before - 48);
  });
});

describe("SpatialBoard: the zoom cluster", () => {
  it("offers zoom to fit as its own control, and the percentage as a readout", () => {
    renderBoard();

    expect(screen.getByLabelText("Zoom to fit")).toBeTruthy();
    expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    expect(screen.getByLabelText("Zoom out")).toBeTruthy();
    // The readout used to be a second, unlabelled Fit to screen, so the
    // cluster held two controls that did the same thing.
    expect(screen.getByText(/^\d+%$/).tagName).toBe("SPAN");
  });
});
