/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitFeedback } from "./submit";

const ENV_KEYS = [
  "NEXT_PUBLIC_FEEDBACK_FORM_ACTION_URL",
  "NEXT_PUBLIC_FEEDBACK_FORM_ENTRY_IDS",
] as const;

const VALUES = {
  stage: "Playing a game",
  description: "the board froze",
  severity: "3",
  userAgent: "test-agent",
  category: "bug",
};

function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearEnv();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("submitFeedback: unconfigured destination", () => {
  beforeEach(clearEnv);

  it("warns naming the missing env vars and does not throw", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => submitFeedback(VALUES)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    expect(message).toContain("NEXT_PUBLIC_FEEDBACK_FORM_ACTION_URL");
    expect(message).toContain("NEXT_PUBLIC_FEEDBACK_FORM_ENTRY_IDS");
  });

  it("does not add any form or iframe to the page", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    submitFeedback(VALUES);
    expect(document.querySelector("form")).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("submitFeedback: configured destination", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FEEDBACK_FORM_ACTION_URL =
      "https://docs.google.com/forms/d/e/fake/formResponse";
    process.env.NEXT_PUBLIC_FEEDBACK_FORM_ENTRY_IDS = JSON.stringify({
      stage: "entry.111",
      description: "entry.222",
      severity: "entry.333",
      userAgent: "entry.444",
      category: "entry.555",
    });
  });

  it("builds a hidden iframe-targeted form with one hidden input per field, then submits it", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const forms: HTMLFormElement[] = [];
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (
      this: HTMLFormElement,
    ) {
      forms.push(this);
    });

    submitFeedback(VALUES);

    const form = document.querySelector("form");
    const iframe = document.querySelector("iframe");
    expect(form).not.toBeNull();
    expect(iframe).not.toBeNull();
    expect(form?.method).toBe("post");
    expect(form?.action).toBe("https://docs.google.com/forms/d/e/fake/formResponse");
    expect(form?.target).toBe(iframe?.name);
    expect(forms).toHaveLength(1);

    const inputs = Array.from(form?.querySelectorAll("input") ?? []);
    expect(inputs).toHaveLength(5);
    const byName = Object.fromEntries(inputs.map((input) => [input.name, input.value]));
    expect(byName["entry.111"]).toBe("Playing a game");
    expect(byName["entry.222"]).toBe("the board froze");
    expect(byName["entry.333"]).toBe("3");
    expect(byName["entry.444"]).toBe("test-agent");
    expect(byName["entry.555"]).toBe("bug");
  });

  it("never warns when the destination is fully configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    submitFeedback(VALUES);
    expect(warn).not.toHaveBeenCalled();
  });
});
