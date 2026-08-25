"use client";

import { useEffect, useRef } from "react";

/**
 * Traps Tab focus inside a container while `active`, and restores focus to
 * whatever had it beforehand once `active` goes false. Adapted (not copied)
 * from the inline focus-trap effect in `components/ui/tile-popover.tsx`
 * (queries the same focusable-selector, wraps Tab/Shift+Tab at the ends,
 * restores to the pre-open element unless that element was `document.body`).
 *
 * The interaction spec for the win pop-up
 * (`docs/reference/materials/design-briefs/2026-08-25_alerts-win-info-interaction-spec.md`,
 * BRAIN-T260825-34) says explicitly it could not determine whether the
 * retired `WinAlert.vue` did anything with keyboard focus: "nothing in the
 * file suggests it did, but that absence is different from a confirmed
 * 'no.'" Trapping focus here, and an Escape key closing the overlay, are
 * both my own design decision for this rebuild, not a fact recovered from
 * the retired source, made because a full-viewport pop-up that blocks the
 * board is exactly the kind of surface screen-reader and keyboard users
 * expect to behave like a dialog.
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onEscape?: () => void,
) {
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);

  // Keeping the latest callback in a ref (rather than listing `onEscape` in
  // the effect below) means opening the trap does not re-run the whole
  // focus-capture/restore effect on every render that passes a fresh
  // closure. Writing to a ref belongs in an effect, not render, so this is
  // its own tiny effect instead of `onEscapeRef.current = onEscape` inline.
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function getFocusable(): HTMLElement[] {
      return Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    const focusable = getFocusable();
    (focusable[0] ?? container).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const withinContainer = document.activeElement
        ? container!.contains(document.activeElement)
        : false;

      if (event.shiftKey) {
        if (!withinContainer || document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (!withinContainer || document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      const toRestore = previouslyFocused.current;
      if (toRestore && toRestore !== document.body && document.contains(toRestore)) {
        toRestore.focus();
      }
    };
  }, [active, containerRef]);
}
