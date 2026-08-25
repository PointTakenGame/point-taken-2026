"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { TilePopover, type TilePopoverAsymmetric } from "@/components/ui/tile-popover";
import { DEFERRED_RESOLUTION_TOKENS } from "@/lib/board/rules";
import type { Side } from "@/lib/events/types";

/**
 * The capture surface for the three deferred resolution tokens: magnifier
 * (a factual disagreement), scale (a priorities disagreement), wine glass
 * (a personal-taste disagreement). Ported from the retired client's
 * `FactCheckModal.vue` / `PrioritiesModal.vue` / `PersonalTasteModal.vue`,
 * which were three thin wrappers around one shared `EmojiResolutionModal.vue`
 * (a token, a title, a subtitle). This is that same idea, but configured
 * against `TilePopover`, this codebase's own generic tile-anchored pop-up,
 * rather than a fourth bespoke component. See `docs` in this file's own
 * header comment history for why no second primitive was built: TilePopover's
 * `asymmetric` prop and `text` body already cover the whole interaction.
 *
 * The interaction is two-sided and asymmetric, same shape as the retired
 * props (`isOpen, role, myRole, placerSubmission, peerSubmission,
 * peerTyping, peerWaiting`, emits `close, reject, typing, submit`), rebuilt
 * here as ordinary React props instead of Vue's isOpen/emit pairing:
 * the player who placed the token (the "opener") gets a text box asking
 * what the two of them do not agree about; the other player (the "peer")
 * sees three waiting dots while that is being typed, then reads it under a
 * "This is why we do not agree" heading and accepts or rejects it.
 *
 * CORE BOUNDARY: this component takes the opener's typed value and the
 * accept/reject decision as plain callback props. It does not persist
 * anything itself and invents no event type; wiring this to the event log
 * is out of this component's lane; see the build report for what event
 * vocabulary that would need.
 */

export type DeferredResolutionToken = (typeof DEFERRED_RESOLUTION_TOKENS)[number];

/** A priorities capture is a pair (mine, theirs); the other two tokens capture a single string. */
export type ResolutionCaptureValue = string | { mine: string; theirs: string };

interface TokenConfig {
  heading: string;
  subtitle: string;
  fields: Array<{
    id: string;
    placeholder: string;
  }>;
  /** Builds the peer's read-only preview out of the opener's submitted value. */
  renderPeerPreview: (value: ResolutionCaptureValue) => ReactNode;
}

const TOKEN_CONFIG: Record<DeferredResolutionToken, TokenConfig> = {
  "🔍": {
    heading: "Disagree on a fact?",
    subtitle: "Take a few minutes to try to source the fact together first.",
    fields: [
      {
        id: "fact",
        placeholder: "What's the fact that you two don't agree on?",
      },
    ],
    renderPeerPreview: (value) => <p>{typeof value === "string" ? value : ""}</p>,
  },
  "⚖️": {
    heading: "Disagree on priorities?",
    subtitle:
      "You might each be weighing this differently. Say what you're each prioritizing.",
    fields: [
      { id: "mine", placeholder: "Your priority" },
      { id: "theirs", placeholder: "Their priority" },
    ],
    renderPeerPreview: (value) => {
      const pair = typeof value === "string" ? { mine: "", theirs: "" } : value;
      return (
        <div className="flex flex-col gap-2">
          <p>Your peer says their priority is: {pair.mine}</p>
          <p>Your peer guesses your priority is: {pair.theirs}</p>
        </div>
      );
    },
  },
  "🍷": {
    heading: "Disagree on taste?",
    subtitle: "Some things are just personal preference.",
    fields: [
      {
        id: "taste",
        placeholder: "What comes down to personal taste here?",
      },
    ],
    renderPeerPreview: (value) => <p>{typeof value === "string" ? value : ""}</p>,
  },
};

const PEER_REVIEW_HEADING = "This is why we do not agree";

const ACCENT_FOR_SIDE: Record<Side, "plus" | "minus"> = {
  plus: "plus",
  minus: "minus",
};

function toConfirmedValue(
  token: DeferredResolutionToken,
  raw: string | Record<string, string>,
): ResolutionCaptureValue {
  if (token === "⚖️") {
    const record = typeof raw === "string" ? { mine: raw, theirs: "" } : raw;
    return { mine: record.mine ?? "", theirs: record.theirs ?? "" };
  }
  return typeof raw === "string" ? raw : (Object.values(raw)[0] ?? "");
}

export function ResolutionCapturePopup({
  open,
  onClose,
  anchorRef,
  token,
  viewer,
  mySide,
  openerValue,
  openerTyping = false,
  onTyping,
  onSubmit,
  onAccept,
  onReject,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  token: DeferredResolutionToken;
  /** Whether the local player placed the token ("opener") or is the other player ("peer"). */
  viewer: "opener" | "peer";
  /** The local player's own side, purely to pick the pop-up's accent color. */
  mySide: Side;
  /** What the opener has typed so far. Null until the opener submits. */
  openerValue: ResolutionCaptureValue | null;
  /** True while the opener is actively composing; only shown to the peer. */
  openerTyping?: boolean;
  /** Fired on every opener keystroke. Wire to a realtime "typing" broadcast upstream; see report. */
  onTyping?: () => void;
  /** The opener's Confirm, with the value from the field(s). */
  onSubmit?: (value: ResolutionCaptureValue) => void;
  /** The peer's Confirm during review ("ACCEPT"). */
  onAccept?: () => void;
  /** The peer's Cancel during review ("REJECT"). */
  onReject?: () => void;
}) {
  const config = TOKEN_CONFIG[token];
  const singleFieldId = config.fields.length === 1 ? config.fields[0].id : null;

  // The opener's in-progress typing lives here, as local UI state, not as
  // anything persisted: `onSubmit` below is the one moment the final value
  // leaves this component. Seeded from `openerValue` whenever the caller
  // hands one in (for example a submitted value coming back down from the
  // server after a reload), so the readback TilePopover renders during
  // "opener-waiting" always reflects the true submitted text.
  //
  // This resync happens during render, not in a useEffect: React's own
  // guidance for "adjusting state when a prop changes" is to compare the
  // incoming prop against the last-seen value inline and call setState
  // conditionally in the render body, which bails out after one extra
  // render instead of the effect body's extra commit-then-rerun cascade.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [lastSeenOpenerValue, setLastSeenOpenerValue] = useState(openerValue);

  if (openerValue !== lastSeenOpenerValue) {
    setLastSeenOpenerValue(openerValue);
    if (openerValue != null) {
      setDraft(
        typeof openerValue === "string"
          ? { [singleFieldId ?? "value"]: openerValue }
          : openerValue,
      );
    }
  }

  const asymmetric: TilePopoverAsymmetric = {
    viewer,
    openerSubmitted: openerValue != null,
    openerTyping,
    peerPreview: openerValue != null ? config.renderPeerPreview(openerValue) : null,
  };

  const heading =
    viewer === "peer" && openerValue != null ? PEER_REVIEW_HEADING : config.heading;

  return (
    <TilePopover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      heading={heading}
      subtitle={viewer === "opener" ? config.subtitle : undefined}
      glyph={{ kind: "token", token }}
      accent={ACCENT_FOR_SIDE[mySide]}
      body={{
        kind: "text",
        fields: config.fields.map((field, index) => ({
          id: field.id,
          placeholder: field.placeholder,
          minLength: 3,
          rows: 4,
          autoFocus: index === 0,
        })),
        value: draft,
        onChange: setDraft,
        onTyping,
      }}
      onConfirm={
        viewer === "opener"
          ? (raw) =>
              onSubmit?.(toConfirmedValue(token, raw as string | Record<string, string>))
          : onAccept
            ? () => onAccept()
            : undefined
      }
      onCancel={viewer === "peer" ? onReject : undefined}
      // The peer's Confirm ("ACCEPT") is a review decision, not a text
      // submission, so it must not be gated on `draft` being filled in:
      // the peer never types into this body at all.
      confirmDisabled={viewer === "peer" ? false : undefined}
      asymmetric={asymmetric}
    />
  );
}
