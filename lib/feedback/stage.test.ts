import { describe, expect, it } from "vitest";
import { deriveFeedbackStage } from "./stage";

describe("deriveFeedbackStage", () => {
  it("maps the home route", () => {
    expect(deriveFeedbackStage("/")).toBe("Home");
  });

  it("maps auth and signin routes", () => {
    expect(deriveFeedbackStage("/auth/callback")).toBe("Sign in");
    expect(deriveFeedbackStage("/signin")).toBe("Sign in");
  });

  it("maps the account route and its subpaths", () => {
    expect(deriveFeedbackStage("/account")).toBe("Account");
    expect(deriveFeedbackStage("/account/start-playing")).toBe("Account");
  });

  it("maps the join route", () => {
    expect(deriveFeedbackStage("/join/ABC123")).toBe("Joining a room");
  });

  it("maps every game subroute to the same single stage", () => {
    expect(deriveFeedbackStage("/game/some-uuid")).toBe("Playing a game");
  });

  it("maps cards and settings", () => {
    // How to play was a route until 2026-09-03, when the page was retired in
    // favour of the onboarding overlay. A stale link to it now falls through
    // to Other, which is the honest answer: it is not a part of the game.
    expect(deriveFeedbackStage("/how-to-play")).toBe("Other");
    expect(deriveFeedbackStage("/cards")).toBe("Cards");
    expect(deriveFeedbackStage("/settings")).toBe("Settings");
  });

  it("falls back to Other for an unrecognized route", () => {
    expect(deriveFeedbackStage("/some-future-page")).toBe("Other");
  });
});
