/** @vitest-environment jsdom */

/**
 * Interaction tests for the rendered toast stack. `alert-store.ts` is
 * module-singleton state, so each test resets modules and re-imports both
 * the store and the component fresh, the same pattern as
 * `alert-store.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as AlertStoreModule from "./alert-store";
import type { AlertStack as AlertStackComponent } from "./alert-stack";

let store: typeof AlertStoreModule;
let AlertStack: typeof AlertStackComponent;

beforeEach(async () => {
  vi.resetModules();
  store = await import("./alert-store");
  ({ AlertStack } = await import("./alert-stack"));
});

afterEach(() => {
  cleanup();
});

describe("AlertStack: visibility", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(<AlertStack />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a pushed toast's message", () => {
    render(<AlertStack />);
    act(() => {
      store.pushAlert("Tile placed.", "success", 0);
    });
    expect(screen.getByText("Tile placed.")).toBeTruthy();
  });
});

describe("AlertStack: dismissal", () => {
  it("removes the toast when its Dismiss button is clicked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AlertStack />);
    act(() => {
      store.pushAlert("Tile placed.", "success", 0);
    });

    await user.click(screen.getByLabelText("Dismiss"));
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(screen.queryByText("Tile placed.")).toBeNull();
    vi.useRealTimers();
  });
});

describe("AlertStack: multiple toasts", () => {
  it("keeps every simultaneous toast on screen at once", () => {
    render(<AlertStack />);
    act(() => {
      store.pushAlert("First.", "info", 0);
      store.pushAlert("Second.", "error", 0);
      store.pushAlert("Third.", "warning", 0);
    });

    expect(screen.getByText("First.")).toBeTruthy();
    expect(screen.getByText("Second.")).toBeTruthy();
    expect(screen.getByText("Third.")).toBeTruthy();
  });
});
