import { getFeedbackFormConfig, type FeedbackFieldName } from "./config";

export type FeedbackValues = Record<FeedbackFieldName, string>;

/**
 * Posts a Google Form response via a hidden same-page iframe, the only
 * technique that actually works for this.
 *
 * The tempting shortcut is `fetch(actionUrl, { mode: "no-cors", ... })`.
 * Do not do that. A no-cors fetch cannot send the form's session cookie,
 * and its response is opaque by design, so there is no way to tell success
 * from failure from the caller's side. Google's endpoint silently discards
 * a request it does not accept: the fetch call resolves, nothing throws,
 * and no row ever appears in the destination sheet. That failure mode is
 * invisible in dev and in production alike, which is exactly why the next
 * person is likely to "simplify" this back to fetch. A real `<form>`
 * submission, targeted at a hidden `<iframe>` instead of navigating the
 * page, carries cookies the normal way and matches what a browser would do
 * if a player filled out the Google Form directly.
 */
function submitToGoogleForm(actionUrl: string, entries: Record<string, string>): void {
  const iframeName = `feedback-submit-target-${Date.now()}`;
  const iframe = document.createElement("iframe");
  iframe.name = iframeName;
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const form = document.createElement("form");
  form.action = actionUrl;
  form.method = "post";
  form.target = iframeName;
  form.style.display = "none";

  for (const [entryId, value] of Object.entries(entries)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = entryId;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();

  // The iframe response is opaque cross-origin anyway (Google Forms does
  // not set CORS headers for this), so there is nothing useful to read
  // back. Clean up shortly after, once the browser has had time to start
  // the navigation inside the iframe.
  window.setTimeout(() => {
    form.remove();
    iframe.remove();
  }, 2000);
}

/**
 * Submits one feedback report. Never throws: an unconfigured destination is
 * expected in this app right now (the Google Form does not exist yet), so
 * this logs a clear developer-facing warning naming the missing variable
 * and returns without sending anything. The caller still shows the player
 * the success acknowledgement either way; a missing developer config is not
 * something a player reporting a bug should ever see.
 */
export function submitFeedback(values: FeedbackValues): void {
  const config = getFeedbackFormConfig();
  if (!config) {
    console.warn(
      "[feedback] NEXT_PUBLIC_FEEDBACK_FORM_ACTION_URL and/or " +
        "NEXT_PUBLIC_FEEDBACK_FORM_ENTRY_IDS are not set, so this report was " +
        "not sent anywhere. See .env.example for what to fill in once the " +
        "destination form exists.",
    );
    return;
  }

  const entries: Record<string, string> = {};
  for (const field of Object.keys(values) as FeedbackFieldName[]) {
    entries[config.entryIds[field]] = values[field];
  }
  submitToGoogleForm(config.actionUrl, entries);
}
