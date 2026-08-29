"use client";

/**
 * The bottom-left toast queue, meant to be mounted once (in `app/layout.tsx`)
 * so it is present on every route. Anything in the app calls `alertActions`
 * from `./alert-store` (from anywhere, no provider needed) and a card
 * appears here; this file is only the rendering half.
 *
 * Interaction rebuilt from the retired Nuxt client's `AlertStack.vue` /
 * `useAlerts.ts` per the written spec
 * (`docs/reference/materials/design-briefs/2026-08-25_alerts-win-info-interaction-spec.md`,
 * BRAIN-T260825-34): fixed bottom-left placement, roughly a fifth of a
 * second fade-and-slide in both directions, a flag glyph on every toast, a
 * single "Dismiss" close button and no secondary action, unlimited
 * simultaneous toasts. Not a code port; the Vue `<TransitionGroup>`
 * machinery and the dead-code double-removal bug in `useAlerts.ts` are not
 * carried over (see `alert-store.ts`'s own header for that bug).
 *
 * NOT mounted in `app/layout.tsx` this round: that wiring, and the wiring
 * that would let `components/board/live-board.tsx` push a real toast, is
 * left for the orchestrator once the concurrent edit to that file lands.
 * See the build report for `BRAIN-T260825-12`.
 */

import { useSyncExternalStore } from "react";
import {
  type AlertVariant,
  getAlertsServerSnapshot,
  getAlertsSnapshot,
  removeAlert,
  subscribeAlerts,
} from "./alert-store";

// The design system has no red/blue/amber tokens, so the retired client's
// four hues are remapped onto the closest tone this palette actually has.
const VARIANT_CLASSES: Record<AlertVariant, string> = {
  success: "border-green bg-mint",
  error: "border-orange bg-peach",
  info: "border-brown bg-offwhite",
  warning: "border-gold bg-sand",
};

export function AlertStack() {
  const alerts = useSyncExternalStore(
    subscribeAlerts,
    getAlertsSnapshot,
    getAlertsServerSnapshot,
  );

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex w-[22rem] max-w-[92vw] flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          role="status"
          className={`flex items-start gap-2 rounded-xl border-2 p-3 font-secondary text-p-sm text-neutral-black shadow-md ${
            alert.leaving ? "animate-alert-out" : "animate-alert-in"
          } ${VARIANT_CLASSES[alert.variant]}`}
        >
          <span aria-hidden="true">⚑</span>
          <p className="flex-1 whitespace-pre-line">{alert.message}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => removeAlert(alert.id)}
            className="shrink-0 font-semibold leading-none opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
