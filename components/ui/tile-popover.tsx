"use client";

/**
 * TilePopover: the one flexible pop-up the game uses everywhere a tile
 * needs to ask the player something, instead of five bespoke Vue surfaces
 * (EmojiResolutionModal, FactCheckModal, PrioritiesModal, PersonalTasteModal,
 * ResolveAgreementModal, SuggestedTopicsModal). Registry: BRAIN-T260825-16
 * (decision), BRAIN-T260825-07 (this build).
 *
 * It is a pop-up, not a screen-covering dialog: it anchors near the tile
 * that triggered it and never blocks the rest of the board. It is fully
 * controlled: the caller owns `open` and every value; this component only
 * renders and reports back through callbacks. It never decides game rules
 * (validity beyond "is there text/a selection" is the caller's problem).
 *
 * Body content is one of five shapes (`TilePopoverBody`): free text (one or
 * more fields), a small pick-one choice set, a pick-one-from-a-list, a
 * composite of a deselectable pick-one chip row above one or more text
 * fields, or no body at all for a pure confirm/cancel ask. The two-player
 * asymmetric case (one side composes, the other side waits then reviews) is modeled
 * explicitly via the `asymmetric` prop rather than left for each caller to
 * reinvent with ad hoc booleans, mirroring the pattern behind the retired
 * FactCheckModal/PersonalTasteModal/PrioritiesModal/ResolveAgreementModal.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { TokenGlyph } from "@/components/board/token-glyph";
import { computeAnchoredPosition } from "./tile-popover-position";

export type TilePopoverGlyph =
  | { kind: "token"; token: string; size?: number }
  | { kind: "image"; src: string; alt: string; size?: number };

export type TilePopoverTextField = {
  /** Key this field is read/written under in `value`/`onChange`. */
  id: string;
  placeholder: string;
  /** Accessible label. Falls back to `placeholder` when omitted. */
  ariaLabel?: string;
  /** Minimum trimmed length to count as filled in. Defaults to 1. */
  minLength?: number;
  /** Hard character cap, wired straight to the textarea's own `maxLength`. */
  maxLength?: number;
  /** Visible row count, wired straight to the textarea's own `rows`. */
  rows?: number;
  autoFocus?: boolean;
};

export type TilePopoverTextBody = {
  kind: "text";
  /** One field for a single free-text ask, two for a side-by-side pair
   * (the PrioritiesModal shape: "your word" / "their word"). */
  fields: TilePopoverTextField[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** Fired on every keystroke; wire to a socket "typing" event upstream. */
  onTyping?: () => void;
};

export type TilePopoverChoiceOption = { id: string; label: string };

export type TilePopoverChoiceBody = {
  kind: "choice";
  options: TilePopoverChoiceOption[];
  value: string | null;
  onChange: (id: string) => void;
};

export type TilePopoverListItem = { id: string; label: string; tag?: string };
export type TilePopoverListGroup = { heading: string; items: TilePopoverListItem[] };

export type TilePopoverListBody = {
  kind: "list";
  groups: TilePopoverListGroup[];
  /** Picking an item both submits and reports, same as SuggestedTopicsModal:
   * there is no separate confirm button for this body kind. */
  onSelect: (id: string) => void;
};

export type TilePopoverNoneBody = { kind: "none" };

export type TilePopoverCompositeChip = { id: string; label: string };

export type TilePopoverCompositeBody = {
  kind: "composite";
  /** A pick-one row above the text fields. Unlike `choice`, clicking the
   * already-selected chip deselects it: the row is an optional tag, not a
   * required answer, so the confirm gate below never depends on it. */
  chips: TilePopoverCompositeChip[];
  chipValue: string | null;
  onChipChange: (id: string | null) => void;
  /** Same shape and behavior as `TilePopoverTextBody.fields`. Filling every
   * field in is what the confirm gate actually checks; the chip row is
   * always optional. */
  fields: TilePopoverTextField[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
};

export type TilePopoverBody =
  | TilePopoverTextBody
  | TilePopoverChoiceBody
  | TilePopoverListBody
  | TilePopoverNoneBody
  | TilePopoverCompositeBody;

/**
 * The asymmetric two-player case. One viewer ("opener": whoever triggered
 * the pop-up, e.g. placed the tile) composes the body; the other ("peer")
 * waits, sees a typing cue, then reviews and accepts/rejects once the
 * opener has submitted. Omit this prop entirely for a single-viewer pop-up
 * (a plain confirmation, or a pick-from-list that either player can open).
 */
export type TilePopoverAsymmetric = {
  viewer: "opener" | "peer";
  /** Has the opener submitted yet? Drives both sides' waiting states. */
  openerSubmitted: boolean;
  /** True while the opener is actively composing; shown to the peer only. */
  openerTyping?: boolean;
  /** What the peer sees once the opener has submitted. The component does
   * not know how to render an opener's raw value for the peer (it may be a
   * compound value like the priorities pair), so the caller supplies the
   * already-formatted preview. Ignored for the opener's own view. */
  peerPreview?: ReactNode;
};

export type TilePopoverConfirmValue = string | Record<string, string> | true;

export interface TilePopoverProps {
  open: boolean;
  /** Dismiss without answering: close button, Escape, and outside click all
   * route here. Suppressed as a visible affordance (not as a keyboard
   * shortcut) during the peer's binding accept/reject review, per Steve's
   * 2026-07-20 ruling captured in the retired ResolveAgreementModal.vue:
   * a binding yes/no ask must not offer a silent "dismiss" disguised as a
   * close button. Escape still calls this in every phase. */
  onClose: () => void;
  /** The tile (or other element) this pop-up anchors near. */
  anchorRef: RefObject<HTMLElement | null>;
  heading: string;
  subtitle?: string;
  glyph?: TilePopoverGlyph;
  body: TilePopoverBody;
  /** Called with the current value when Confirm is pressed. Not used for
   * `body.kind === "list"`, which reports through `onSelect` instead. */
  onConfirm?: (value: TilePopoverConfirmValue) => void;
  confirmLabel?: string;
  /** Extra caller-supplied disable condition, in addition to this
   * component's own "is the body filled in" check. */
  confirmDisabled?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  asymmetric?: TilePopoverAsymmetric;
  /** Which side of the plus/minus color language to accent the card with.
   * Purely cosmetic; the component has no opinion on what plus/minus mean. */
  accent?: "plus" | "minus" | "neutral";
  closeLabel?: string;
  waitingCopy?: string;
  typingCopy?: string;
  /** Small extra content rendered below the body and above the footer
   * buttons: a read-only hint, a link out, or anything else that is not
   * part of the answer itself. Generic on purpose, so any caller can use it
   * for its own non-editable context, not just a stage/category hint. */
  footnote?: ReactNode;
  /** DOM id prefix for internal ids (heading, subtitle, fields). Generated
   * automatically when omitted; only pass this for stable ids in tests. */
  id?: string;
}

const DEFAULT_WAITING_COPY = "Waiting for your peer...";
const DEFAULT_TYPING_COPY = "Your peer is typing";
const DEFAULT_CONFIRM_LABEL = "DONE";
const DEFAULT_CANCEL_LABEL = "CANCEL";

type Phase = "solo" | "compose" | "opener-waiting" | "peer-waiting" | "peer-review";

function getPhase(asymmetric: TilePopoverAsymmetric | undefined): Phase {
  if (!asymmetric) return "solo";
  if (asymmetric.viewer === "opener") {
    return asymmetric.openerSubmitted ? "opener-waiting" : "compose";
  }
  return asymmetric.openerSubmitted ? "peer-review" : "peer-waiting";
}

function isBodyFilledIn(body: TilePopoverBody): boolean {
  switch (body.kind) {
    case "text":
    case "composite":
      return body.fields.every(
        (field) => (body.value[field.id] ?? "").trim().length >= (field.minLength ?? 1),
      );
    case "choice":
      return body.value != null;
    case "none":
      return true;
    case "list":
      return true;
  }
}

function getConfirmValue(body: TilePopoverBody, phase: Phase): TilePopoverConfirmValue {
  if (phase === "peer-review") return true;
  if (body.kind === "text" || body.kind === "composite") {
    if (body.fields.length === 1) {
      return (body.value[body.fields[0].id] ?? "").trim();
    }
    const out: Record<string, string> = {};
    for (const field of body.fields) {
      out[field.id] = (body.value[field.id] ?? "").trim();
    }
    return out;
  }
  if (body.kind === "choice") return body.value ?? "";
  return true;
}

const ACCENT_CLASSES: Record<"plus" | "minus" | "neutral", string> = {
  plus: "border-green",
  minus: "border-orange",
  neutral: "border-gray",
};

const ACCENT_BUTTON_CLASSES: Record<"plus" | "minus" | "neutral", string> = {
  plus: "bg-green border-green text-neutral-black",
  minus: "bg-orange border-orange text-neutral-black",
  neutral: "bg-neutral-black border-neutral-black text-offwhite",
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true" focusable="false">
      <path
        d="M2 2 L14 14 M14 2 L2 14"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function WaitingDots({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2" role="status">
      <span className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-gray [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-gray [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-gray [animation-delay:240ms]" />
      </span>
      <span className="text-p-sm font-secondary text-gray">{label}</span>
    </div>
  );
}

function TextBodyView({
  body,
  headingId,
}: {
  body: TilePopoverTextBody;
  headingId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {body.fields.map((field) => (
        <textarea
          key={field.id}
          className={`form-base input-primary resize-none ${field.rows ? "" : "min-h-20"}`}
          placeholder={field.placeholder}
          aria-label={field.ariaLabel ?? field.placeholder}
          aria-describedby={headingId}
          autoFocus={field.autoFocus}
          maxLength={field.maxLength}
          rows={field.rows}
          value={body.value[field.id] ?? ""}
          onChange={(event) => {
            body.onChange({ ...body.value, [field.id]: event.target.value });
            body.onTyping?.();
          }}
        />
      ))}
    </div>
  );
}

function CompositeBodyView({
  body,
  headingId,
}: {
  body: TilePopoverCompositeBody;
  headingId: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group">
        {body.chips.map((chip) => {
          const selected = body.chipValue === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={selected}
              className={`form-base rounded-full px-4 py-2 text-p-sm font-secondary transition-colors ${
                selected
                  ? "bg-neutral-black text-offwhite border-neutral-black"
                  : "bg-offwhite text-neutral-black border-gray"
              }`}
              // Clicking the already-selected chip clears it: this row is a
              // pick-one-or-none tag, not a required radio group.
              onClick={() => body.onChipChange(selected ? null : chip.id)}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        {body.fields.map((field) => (
          <textarea
            key={field.id}
            className={`form-base input-primary resize-none ${field.rows ? "" : "min-h-20"}`}
            placeholder={field.placeholder}
            aria-label={field.ariaLabel ?? field.placeholder}
            aria-describedby={headingId}
            autoFocus={field.autoFocus}
            maxLength={field.maxLength}
            rows={field.rows}
            value={body.value[field.id] ?? ""}
            onChange={(event) => {
              body.onChange({ ...body.value, [field.id]: event.target.value });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ChoiceBodyView({ body }: { body: TilePopoverChoiceBody }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {body.options.map((option) => {
        const selected = body.value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`form-base rounded-full px-4 py-2 text-p-sm font-secondary transition-colors ${
              selected
                ? "bg-neutral-black text-offwhite border-neutral-black"
                : "bg-offwhite text-neutral-black border-gray"
            }`}
            onClick={() => body.onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ListBodyView({ body }: { body: TilePopoverListBody }) {
  return (
    <div className="flex max-h-64 flex-col gap-4 overflow-y-auto pr-1">
      {body.groups.map((group) => (
        <div key={group.heading} className="flex flex-col gap-1">
          <p className="font-primary text-p-sm text-gray">{group.heading}</p>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="form-base input-primary flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => body.onSelect(item.id)}
                >
                  <span>{item.label}</span>
                  {item.tag ? (
                    <span className="text-p-sm font-secondary text-gray">{item.tag}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ReadOnlyBodyPreview({ body }: { body: TilePopoverBody }) {
  if (body.kind === "text") {
    return (
      <div className="flex flex-col gap-2">
        {body.fields.map((field) => (
          <p
            key={field.id}
            className="form-base input-primary bg-offwhite text-neutral-black"
          >
            {body.value[field.id] ?? ""}
          </p>
        ))}
      </div>
    );
  }
  if (body.kind === "choice") {
    const selected = body.options.find((option) => option.id === body.value);
    return (
      <p className="form-base input-primary bg-offwhite text-neutral-black">
        {selected?.label ?? ""}
      </p>
    );
  }
  if (body.kind === "composite") {
    const selectedChip = body.chips.find((chip) => chip.id === body.chipValue);
    return (
      <div className="flex flex-col gap-2">
        {selectedChip ? (
          <p className="form-base input-primary bg-offwhite text-neutral-black">
            {selectedChip.label}
          </p>
        ) : null}
        {body.fields.map((field) => (
          <p
            key={field.id}
            className="form-base input-primary bg-offwhite text-neutral-black"
          >
            {body.value[field.id] ?? ""}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// useSyncExternalStore helpers for the SSR-safe mount flag above. There is
// nothing to subscribe to (mount status never changes after the fact), so
// the subscribe function is a no-op; the two snapshots differ only by
// server vs. client, which is exactly what useSyncExternalStore is for.
function subscribeNoop() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

export function TilePopover({
  open,
  onClose,
  anchorRef,
  heading,
  subtitle,
  glyph,
  body,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  onCancel,
  cancelLabel,
  asymmetric,
  accent = "neutral",
  closeLabel = "Close",
  waitingCopy = DEFAULT_WAITING_COPY,
  typingCopy = DEFAULT_TYPING_COPY,
  footnote,
  id,
}: TilePopoverProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const headingId = `${baseId}-heading`;
  const subtitleId = `${baseId}-subtitle`;

  const rootRef = useRef<HTMLDivElement>(null);
  // SSR-safe "are we on the client yet" flag for the portal below, without
  // calling setState from inside an effect: the snapshot is true once
  // mounted on the client and false on the server, so hydration always
  // matches what the server rendered.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const phase = getPhase(asymmetric);
  const dismissible = phase !== "peer-review";

  // Positioning: measure the anchor and the popover itself, then clamp to
  // the viewport via the pure helper in tile-popover-position.ts.
  useLayoutEffect(() => {
    if (!open) return;

    function reposition() {
      const anchorEl = anchorRef.current;
      const popoverEl = rootRef.current;
      if (!anchorEl || !popoverEl) return;
      const anchorRect = anchorEl.getBoundingClientRect();
      const popoverRect = popoverEl.getBoundingClientRect();
      const next = computeAnchoredPosition(
        {
          top: anchorRect.top,
          left: anchorRect.left,
          width: anchorRect.width,
          height: anchorRect.height,
        },
        { width: popoverRect.width, height: popoverRect.height },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setPosition({ left: next.left, top: next.top });
    }

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && rootRef.current) {
      observer = new ResizeObserver(reposition);
      observer.observe(rootRef.current);
    }

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      observer?.disconnect();
    };
  }, [open, anchorRef, phase, body.kind]);

  // Escape dismissal, focus trap, and focus restoration on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const anchorAtOpen = anchorRef.current;

    function getFocusable(): HTMLElement[] {
      const container = rootRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      );
    }

    const focusable = getFocusable();
    (focusable[0] ?? rootRef.current)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      // Restore to whatever was actually focused before opening, unless
      // that was just the document body (nothing meaningfully focused, as
      // when the popover is opened programmatically rather than by a click
      // on the anchor tile). In that fallback case, restore to the anchor
      // itself, since the anchor tile is the trigger this popover answers for.
      const restoreTarget =
        previouslyFocused && previouslyFocused !== document.body
          ? previouslyFocused
          : anchorAtOpen;
      restoreTarget?.focus?.();
    };
  }, [open, anchorRef]);

  // Outside click dismissal, matching the visible close button's rules.
  useEffect(() => {
    if (!open || !dismissible) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open, dismissible, anchorRef]);

  const filledIn = useMemo(() => isBodyFilledIn(body), [body]);
  const confirmIsDisabled = confirmDisabled ?? !filledIn;

  const handleConfirm = useCallback(() => {
    if (confirmIsDisabled) return;
    onConfirm?.(getConfirmValue(body, phase));
  }, [confirmIsDisabled, onConfirm, body, phase]);

  if (!open || !mounted) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    left: position?.left ?? -9999,
    top: position?.top ?? -9999,
    visibility: position ? "visible" : "hidden",
  };

  const resolvedConfirmLabel =
    confirmLabel ?? (phase === "peer-review" ? "ACCEPT" : DEFAULT_CONFIRM_LABEL);
  const resolvedCancelLabel =
    cancelLabel ?? (phase === "peer-review" ? "REJECT" : DEFAULT_CANCEL_LABEL);

  const showBody = phase === "solo" || phase === "compose";
  const showReadback = phase === "opener-waiting" && body.kind !== "none";
  const showPeerWaiting = phase === "peer-waiting";
  const showPeerPreview = phase === "peer-review";

  const footerConfirmVisible =
    Boolean(onConfirm) &&
    (phase === "solo" || phase === "compose" || phase === "peer-review");
  const footerCancelVisible =
    Boolean(onCancel) &&
    (phase === "solo" ||
      phase === "compose" ||
      phase === "opener-waiting" ||
      phase === "peer-review");
  const showFooter =
    body.kind !== "list" && (footerConfirmVisible || footerCancelVisible);

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-labelledby={headingId}
      aria-describedby={subtitle ? subtitleId : undefined}
      tabIndex={-1}
      style={style}
      className={`relative z-50 flex w-72 flex-col gap-3 rounded-2xl border-2 bg-offwhite p-4 pt-6 shadow-lg outline-none ${ACCENT_CLASSES[accent]}`}
    >
      {glyph ? (
        <div className="absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-2 border-inherit bg-offwhite shadow-sm">
          {glyph.kind === "token" ? (
            <TokenGlyph token={glyph.token} size={glyph.size ?? 22} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={glyph.src}
              alt={glyph.alt}
              width={glyph.size ?? 22}
              height={glyph.size ?? 22}
            />
          )}
        </div>
      ) : null}

      {dismissible ? (
        <button
          type="button"
          className="btn-icon absolute right-2 top-2 text-gray"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      ) : null}

      <div className="flex flex-col gap-1 text-center">
        <h2 id={headingId} className="font-primary text-p-lg text-neutral-black">
          {heading}
        </h2>
        {subtitle ? (
          <p id={subtitleId} className="font-secondary text-p-sm text-gray">
            {subtitle}
          </p>
        ) : null}
      </div>

      {showBody && body.kind === "text" ? (
        <TextBodyView body={body} headingId={headingId} />
      ) : null}
      {showBody && body.kind === "choice" ? <ChoiceBodyView body={body} /> : null}
      {showBody && body.kind === "list" ? <ListBodyView body={body} /> : null}
      {showBody && body.kind === "composite" ? (
        <CompositeBodyView body={body} headingId={headingId} />
      ) : null}

      {showReadback ? <ReadOnlyBodyPreview body={body} /> : null}
      {showReadback ? <WaitingDots label={waitingCopy} /> : null}

      {showPeerWaiting ? (
        <WaitingDots label={asymmetric?.openerTyping ? typingCopy : waitingCopy} />
      ) : null}

      {showPeerPreview ? (
        <div className="flex flex-col gap-2">{asymmetric?.peerPreview}</div>
      ) : null}

      {showBody && footnote ? <div>{footnote}</div> : null}

      {showFooter ? (
        <div className="flex justify-center gap-2">
          {footerCancelVisible ? (
            <button
              type="button"
              className="form-base border-gray bg-offwhite text-neutral-black"
              onClick={onCancel}
            >
              {resolvedCancelLabel}
            </button>
          ) : null}
          {footerConfirmVisible ? (
            <button
              type="button"
              className={`form-base btn-primary ${ACCENT_BUTTON_CLASSES[accent]} disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={confirmIsDisabled}
              onClick={handleConfirm}
            >
              {resolvedConfirmLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
