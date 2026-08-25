/**
 * The alert stack's state, held outside React so any component or module,
 * not only the one mounted `<AlertStack />`, can push a toast without a
 * context provider sitting in between. `AlertStack` subscribes to this with
 * `useSyncExternalStore`; nothing else needs to render for `alertActions.*`
 * to work.
 *
 * Rebuilt as an interaction, not ported as code, from the retired Nuxt
 * client's `app/composables/useAlerts.ts`, per the written spec at
 * `docs/reference/materials/design-briefs/2026-08-25_alerts-win-info-interaction-spec.md`
 * (BRAIN-T260825-34). That source has a confirmed dead-code bug: its four
 * convenience helpers (`success`/`error`/`info`/`warning`) each called the
 * removal function with the *timeout number* instead of the toast's *id*,
 * so that call almost never matched anything and did nothing; the real
 * auto-dismiss came entirely from a second, separate timer set inside
 * `push()`. That bug is not reproduced here: there is exactly one place a
 * toast's timer is armed (`pushAlert`) and exactly one place it is cleared
 * or fires (`removeAlert`), both keyed by the toast's real id.
 */

export type AlertVariant = "success" | "error" | "info" | "warning";

export type Alert = {
  id: number;
  message: string;
  variant: AlertVariant;
  /** True while the exit animation plays; the toast is removed after it. */
  leaving: boolean;
};

/** How long the exit animation runs before a leaving toast is dropped. */
const EXIT_DURATION_MS = 180;

let alerts: Alert[] = [];
let counter = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeAlerts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAlertsSnapshot(): Alert[] {
  return alerts;
}

export function getAlertsServerSnapshot(): Alert[] {
  return [];
}

/**
 * Starts a toast's exit: marks it `leaving` (still rendered, mid-animation)
 * and drops it from the list once the exit animation has had time to play.
 * Safe to call twice; the second call is a no-op. This is also what a live
 * auto-dismiss timer calls, so a button dismiss and a timeout dismiss are
 * the exact same code path.
 */
export function removeAlert(id: number): void {
  const pending = timers.get(id);
  if (pending !== undefined) {
    clearTimeout(pending);
    timers.delete(id);
  }
  const target = alerts.find((alert) => alert.id === id);
  if (!target || target.leaving) return;

  alerts = alerts.map((alert) => (alert.id === id ? { ...alert, leaving: true } : alert));
  emit();

  const exitTimer = setTimeout(() => {
    alerts = alerts.filter((alert) => alert.id !== id);
    timers.delete(id);
    emit();
  }, EXIT_DURATION_MS);
  timers.set(id, exitTimer);
}

/**
 * The low-level call every helper below goes through. `timeoutMs` of `0`
 * means persistent: dismissed only by calling `removeAlert` directly (a
 * click on the toast's own close button). Defaults to 3000ms, matching the
 * retired client's `push()` default, even though nothing in this app calls
 * `pushAlert` directly today, same as there.
 */
export function pushAlert(
  message: string,
  variant: AlertVariant = "info",
  timeoutMs = 3000,
): number {
  const id = counter++;
  alerts = [...alerts, { id, message, variant, leaving: false }];
  emit();
  if (timeoutMs > 0) {
    const timer = setTimeout(() => removeAlert(id), timeoutMs);
    timers.set(id, timer);
  }
  return id;
}

const DEFAULT_HELPER_TIMEOUT_MS = 4000;

function success(message: string, timeoutMs = DEFAULT_HELPER_TIMEOUT_MS): number {
  return pushAlert(message, "success", timeoutMs);
}
function error(message: string, timeoutMs = DEFAULT_HELPER_TIMEOUT_MS): number {
  return pushAlert(message, "error", timeoutMs);
}
function info(message: string, timeoutMs = DEFAULT_HELPER_TIMEOUT_MS): number {
  return pushAlert(message, "info", timeoutMs);
}
/** Variant exists for parity with the retired client; nothing calls it yet. */
function warning(message: string, timeoutMs = DEFAULT_HELPER_TIMEOUT_MS): number {
  return pushAlert(message, "warning", timeoutMs);
}

export const alertActions = {
  push: pushAlert,
  remove: removeAlert,
  success,
  error,
  info,
  warning,
};
