/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { RuleCardTray } from "./rule-card-tray";

afterEach(cleanup);

describe("RuleCardTray: an empty hand", () => {
  it("says so, and where cards come from, instead of drawing an empty box", () => {
    render(
      <RuleCardTray
        deck={[]}
        counts={{}}
        armedCardId={null}
        onArm={vi.fn()}
        hint={null}
      />,
    );

    expect(screen.getByText("You don\u2019t have any cards yet")).toBeTruthy();
    expect(screen.getByText("Cards are earned in the Gym, one per level.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the cards, and not the message, once there is a hand", () => {
    render(
      <RuleCardTray
        deck={["you_is_taboo"]}
        counts={{}}
        armedCardId={null}
        onArm={vi.fn()}
        hint={null}
      />,
    );

    expect(screen.queryByText("You don\u2019t have any cards yet")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
