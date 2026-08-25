"use client";

/**
 * One shared pop-up behind two entry points: the floating button rendered
 * globally from app/layout.tsx (every page, bottom-right corner) and an
 * inline pill meant to sit in the game page's utility row. The inline
 * variant is built and exported here but not wired into components/board/
 * yet, since another agent owns that directory right now; whoever adds it
 * there only needs `<FeedbackPopover variant="inline" />`.
 *
 * This component is the controlling caller for TilePopover: it owns all of
 * the local state (open, selected category, description text, sent) and
 * TilePopover just renders and reports back, per that component's own
 * contract.
 */

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  TilePopover,
  type TilePopoverCompositeBody,
  type TilePopoverConfirmValue,
} from "@/components/ui/tile-popover";
import { deriveFeedbackStage } from "@/lib/feedback/stage";
import { getFeedbackShareMoreUrl } from "@/lib/feedback/config";
import { submitFeedback } from "@/lib/feedback/submit";

const CATEGORY_CHIPS = [
  { id: "bug", label: "Bug" },
  { id: "ai", label: "AI issue" },
  { id: "other", label: "Other" },
];

const DESCRIPTION_FIELD_ID = "description";
const MAX_DESCRIPTION_LENGTH = 500;
const SUCCESS_CLOSE_DELAY_MS = 1800;

export function FeedbackPopover({ variant }: { variant: "floating" | "inline" }) {
  const pathname = usePathname();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  function resetAndClose() {
    setOpen(false);
    setSent(false);
    setCategory(null);
    setDescription({});
  }

  function handleConfirm(value: TilePopoverConfirmValue) {
    const text = typeof value === "string" ? value : "";
    submitFeedback({
      stage: deriveFeedbackStage(pathname ?? "/"),
      description: text,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      category: category ?? "",
    });
    setSent(true);
    window.setTimeout(resetAndClose, SUCCESS_CLOSE_DELAY_MS);
  }

  const shareMoreUrl = getFeedbackShareMoreUrl();
  const stage = deriveFeedbackStage(pathname ?? "/");

  const composeBody: TilePopoverCompositeBody = {
    kind: "composite",
    chips: CATEGORY_CHIPS,
    chipValue: category,
    onChipChange: setCategory,
    fields: [
      {
        id: DESCRIPTION_FIELD_ID,
        placeholder: "Tell us about a bug, a reaction, or an idea...",
        maxLength: MAX_DESCRIPTION_LENGTH,
        rows: 3,
        autoFocus: true,
      },
    ],
    value: description,
    onChange: setDescription,
  };

  return (
    <>
      {variant === "floating" ? (
        <button
          ref={anchorRef}
          type="button"
          aria-label="Share feedback"
          className="btn-icon fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-neutral-black bg-offwhite text-2xl shadow-lg"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true">💬</span>
        </button>
      ) : (
        <button
          ref={anchorRef}
          type="button"
          className="form-base rounded-full border-gray bg-offwhite px-4 py-2 text-p-sm font-secondary text-neutral-black"
          onClick={() => setOpen(true)}
        >
          Report a bug
        </button>
      )}

      <TilePopover
        open={open}
        onClose={resetAndClose}
        anchorRef={anchorRef}
        heading={sent ? "Thanks!" : "Share feedback"}
        subtitle={
          sent
            ? "Your report is on its way."
            : "Bugs, AI weirdness, confusing screens: all welcome."
        }
        glyph={{ kind: "token", token: "💬" }}
        body={sent ? { kind: "none" } : composeBody}
        onConfirm={sent ? undefined : handleConfirm}
        confirmLabel="Send"
        footnote={
          sent ? undefined : (
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-p-sm font-secondary text-gray">From: {stage}</p>
              {shareMoreUrl ? (
                <a
                  href={shareMoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-p-sm font-secondary text-neutral-black underline"
                >
                  Have more to say? Use the full form.
                </a>
              ) : null}
            </div>
          )
        }
      />
    </>
  );
}
