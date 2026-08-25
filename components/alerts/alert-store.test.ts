/**
 * Unit tests for the alert stack's headless store. Each test re-imports the
 * module fresh (`vi.resetModules()`) because its state is a module-level
 * singleton, not a class instance; without a reset, toasts pushed in one
 * test would leak into the next.
 *
 * The behaviour under test that matters most: `removeAlert` is reachable
 * from exactly one id-keyed path, whether it fires from a timeout or from a
 * direct call, so the retired client's dead-code bug (helpers removing by
 * the timeout number instead of the toast id) cannot recur here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as AlertStoreModule from "./alert-store";

let store: typeof AlertStoreModule;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  store = await import("./alert-store");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pushAlert", () => {
  it("adds a toast and notifies listeners", () => {
    const listener = vi.fn();
    store.subscribeAlerts(listener);

    const id = store.pushAlert("Saved.", "success", 0);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getAlertsSnapshot()).toEqual([
      { id, message: "Saved.", variant: "success", leaving: false },
    ]);
  });

  it("auto-dismisses after its timeout by marking leaving, then removing", () => {
    store.pushAlert("Heads up.", "info", 1000);

    vi.advanceTimersByTime(999);
    expect(store.getAlertsSnapshot()[0].leaving).toBe(false);

    vi.advanceTimersByTime(1);
    expect(store.getAlertsSnapshot()[0].leaving).toBe(true);

    vi.advanceTimersByTime(180);
    expect(store.getAlertsSnapshot()).toEqual([]);
  });

  it("never auto-dismisses when timeoutMs is 0", () => {
    store.pushAlert("Stays put.", "error", 0);

    vi.advanceTimersByTime(1000 * 60);
    expect(store.getAlertsSnapshot()).toHaveLength(1);
  });
});

describe("removeAlert", () => {
  it("removes by the toast's real id, not by a timer handle", () => {
    const id = store.pushAlert("Bye.", "info", 0);
    const bogusTimerLikeNumber = 999999;

    store.removeAlert(bogusTimerLikeNumber);
    vi.advanceTimersByTime(180);
    expect(store.getAlertsSnapshot()).toHaveLength(1);

    store.removeAlert(id);
    vi.advanceTimersByTime(180);
    expect(store.getAlertsSnapshot()).toEqual([]);
  });

  it("is a no-op the second time it is called on the same id", () => {
    const listener = vi.fn();
    const id = store.pushAlert("Once.", "info", 0);
    store.subscribeAlerts(listener);

    store.removeAlert(id);
    const callsAfterFirst = listener.mock.calls.length;
    store.removeAlert(id);

    expect(listener.mock.calls.length).toBe(callsAfterFirst);
  });

  it("cancels a pending auto-dismiss timer so it does not fire twice", () => {
    const id = store.pushAlert("Timed.", "info", 500);

    store.removeAlert(id);
    vi.advanceTimersByTime(180);
    expect(store.getAlertsSnapshot()).toEqual([]);

    // If the original 500ms timer were still armed it would call removeAlert
    // again here; that must be a harmless no-op, not a throw or a second
    // removal of something already gone.
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });
});

describe("alertActions helpers", () => {
  it("success/error/info/warning each push the matching variant", () => {
    store.alertActions.success("s", 0);
    store.alertActions.error("e", 0);
    store.alertActions.info("i", 0);
    store.alertActions.warning("w", 0);

    const variants = store.getAlertsSnapshot().map((alert) => alert.variant);
    expect(variants).toEqual(["success", "error", "info", "warning"]);
  });

  it("removes by id when called through alertActions.remove", () => {
    const id = store.alertActions.info("i", 0);
    store.alertActions.remove(id);
    vi.advanceTimersByTime(180);
    expect(store.getAlertsSnapshot()).toEqual([]);
  });
});

describe("getAlertsServerSnapshot", () => {
  it("is always empty, for SSR", () => {
    store.pushAlert("x", "info", 0);
    expect(store.getAlertsServerSnapshot()).toEqual([]);
  });
});
