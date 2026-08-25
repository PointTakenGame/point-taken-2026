/** @vitest-environment jsdom */

/**
 * Interaction tests for TilePopover. The project's default vitest
 * environment is "node" (see vitest.config.mts) because most existing
 * component tests only assert on renderToStaticMarkup output. TilePopover's
 * required behaviors (Escape dismissal, click-driven confirm/cancel, live
 * validation, focus trap and restoration) need a real DOM, so this file
 * opts into jsdom on its own via the pragma above rather than changing the
 * shared config other agents' tests rely on.
 */

import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  TilePopover,
  type TilePopoverAsymmetric,
  type TilePopoverBody,
} from "./tile-popover";

afterEach(cleanup);

// No jest-dom matcher package is installed in this project, so a plain
// disabled-attribute check stands in for `toBeDisabled()`.
function isDisabled(element: HTMLElement): boolean {
  return (element as HTMLButtonElement).disabled === true;
}

function TriggerAndPopover({
  body,
  onConfirm,
  onCancel,
  asymmetric,
  initialOpen = true,
}: {
  body: TilePopoverBody;
  onConfirm?: (value: unknown) => void;
  onCancel?: () => void;
  asymmetric?: TilePopoverAsymmetric;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={anchorRef}>the tile</button>
      <TilePopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        heading="Disagree on a fact?"
        subtitle="Take a few minutes to source it together."
        body={body}
        onConfirm={onConfirm}
        onCancel={onCancel}
        asymmetric={asymmetric}
      />
    </div>
  );
}

describe("TilePopover: open and close", () => {
  it("renders the heading while open and nothing while closed", () => {
    const { rerender } = render(
      <TilePopover
        open={false}
        onClose={() => {}}
        anchorRef={{ current: null }}
        heading="Disagree on a fact?"
        body={{ kind: "none" }}
      />,
    );
    expect(screen.queryByText("Disagree on a fact?")).toBeNull();

    rerender(
      <TilePopover
        open
        onClose={() => {}}
        anchorRef={{ current: null }}
        heading="Disagree on a fact?"
        body={{ kind: "none" }}
      />,
    );
    expect(screen.getByText("Disagree on a fact?")).toBeTruthy();
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<TriggerAndPopover body={{ kind: "none" }} />);
    expect(screen.getByRole("dialog")).toBeTruthy();

    await user.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns focus to the trigger element once closed", async () => {
    const user = userEvent.setup();
    render(<TriggerAndPopover body={{ kind: "none" }} />);

    await user.click(screen.getByLabelText("Close"));
    expect(document.activeElement).toBe(screen.getByText("the tile"));
  });
});

describe("TilePopover: Escape dismissal", () => {
  it("closes on Escape even without touching the close button", () => {
    render(<TriggerAndPopover body={{ kind: "none" }} />);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("still closes on Escape during the peer's binding review, even though the close button is hidden", () => {
    render(
      <TriggerAndPopover
        body={{ kind: "none" }}
        onConfirm={() => {}}
        onCancel={() => {}}
        asymmetric={{ viewer: "peer", openerSubmitted: true }}
      />,
    );
    expect(screen.queryByLabelText("Close")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("TilePopover: free-text path", () => {
  it("keeps confirm disabled until the field has content, then reports the trimmed value", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function Field() {
      const [value, setValue] = useState<Record<string, string>>({});
      return (
        <TriggerAndPopover
          onConfirm={onConfirm}
          body={{
            kind: "text",
            fields: [{ id: "fact", placeholder: "What's the fact?" }],
            value,
            onChange: setValue,
          }}
        />
      );
    }
    render(<Field />);

    const confirmButton = screen.getByRole("button", { name: "DONE" });
    expect(isDisabled(confirmButton)).toBe(true);

    await user.type(
      screen.getByPlaceholderText("What's the fact?"),
      "  the sky is blue  ",
    );
    expect(isDisabled(confirmButton)).toBe(false);

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith("the sky is blue");
  });

  it("requires every field to be filled in for a two-field body", async () => {
    const user = userEvent.setup();
    function Fields() {
      const [value, setValue] = useState<Record<string, string>>({ mine: "equity" });
      return (
        <TriggerAndPopover
          onConfirm={() => {}}
          body={{
            kind: "text",
            fields: [
              { id: "mine", placeholder: "Your priority" },
              { id: "theirs", placeholder: "Your peer's priority" },
            ],
            value,
            onChange: setValue,
          }}
        />
      );
    }
    render(<Fields />);

    expect(isDisabled(screen.getByRole("button", { name: "DONE" }))).toBe(true);
    await user.type(screen.getByPlaceholderText("Your peer's priority"), "liberty");
    expect(isDisabled(screen.getByRole("button", { name: "DONE" }))).toBe(false);
  });
});

describe("TilePopover: pick-one path", () => {
  it("keeps confirm disabled until an option is chosen, then reports the option id", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function Choice() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <TriggerAndPopover
          onConfirm={onConfirm}
          body={{
            kind: "choice",
            options: [
              { id: "salty", label: "Salty" },
              { id: "sweet", label: "Sweet" },
            ],
            value,
            onChange: setValue,
          }}
        />
      );
    }
    render(<Choice />);

    expect(isDisabled(screen.getByRole("button", { name: "DONE" }))).toBe(true);
    await user.click(screen.getByRole("radio", { name: "Sweet" }));
    expect(isDisabled(screen.getByRole("button", { name: "DONE" }))).toBe(false);

    await user.click(screen.getByRole("button", { name: "DONE" }));
    expect(onConfirm).toHaveBeenCalledWith("sweet");
  });

  it("selecting from a list reports and submits immediately, with no confirm button", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <TriggerAndPopover
        body={{
          kind: "list",
          groups: [
            {
              heading: "Suggestions",
              items: [
                { id: "topic-a", label: "Topic A" },
                { id: "topic-b", label: "Topic B" },
              ],
            },
          ],
          onSelect,
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: "DONE" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Topic B" }));
    expect(onSelect).toHaveBeenCalledWith("topic-b");
  });
});

describe("TilePopover: asymmetric two-player case", () => {
  it("opener view: shows the interactive body and no peer-review controls before submitting", () => {
    render(
      <TriggerAndPopover
        onConfirm={() => {}}
        body={{
          kind: "text",
          fields: [{ id: "fact", placeholder: "What's the fact?" }],
          value: {},
          onChange: () => {},
        }}
        asymmetric={{ viewer: "opener", openerSubmitted: false }}
      />,
    );

    expect(screen.getByPlaceholderText("What's the fact?")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ACCEPT" })).toBeNull();
  });

  it("opener view: after submitting, shows a frozen readback and waits, with no confirm button", () => {
    render(
      <TriggerAndPopover
        onConfirm={() => {}}
        onCancel={() => {}}
        body={{
          kind: "text",
          fields: [{ id: "fact", placeholder: "What's the fact?" }],
          value: { fact: "the sky is blue" },
          onChange: () => {},
        }}
        asymmetric={{ viewer: "opener", openerSubmitted: true }}
      />,
    );

    expect(screen.queryByPlaceholderText("What's the fact?")).toBeNull();
    expect(screen.getByText("the sky is blue")).toBeTruthy();
    expect(screen.getByText("Waiting for your peer...")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "DONE" })).toBeNull();
    expect(screen.getByRole("button", { name: "CANCEL" })).toBeTruthy();
  });

  it("peer view: shows a waiting indicator and a typing cue before the opener submits", () => {
    render(
      <TriggerAndPopover
        body={{ kind: "none" }}
        asymmetric={{ viewer: "peer", openerSubmitted: false, openerTyping: true }}
      />,
    );

    expect(screen.getByText("Your peer is typing")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ACCEPT" })).toBeNull();
  });

  it("peer view: shows the preview and accept/reject once the opener has submitted", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <TriggerAndPopover
        body={{ kind: "none" }}
        onConfirm={onConfirm}
        onCancel={onCancel}
        asymmetric={{
          viewer: "peer",
          openerSubmitted: true,
          peerPreview: <p>the sky is blue</p>,
        }}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("the sky is blue")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "ACCEPT" }));
    expect(onConfirm).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("button", { name: "REJECT" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
