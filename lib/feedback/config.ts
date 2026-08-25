/**
 * Reads the feedback pop-up's destination out of build-time env vars. The
 * destination Google Form does not exist yet, so there is nothing to
 * hardcode: every id here comes from `NEXT_PUBLIC_`-prefixed vars, read at
 * call time, and the whole thing is designed to work correctly when those
 * vars are absent (the state this ships in). See `.env.example` for the
 * exact variable names and where real values come from once the form
 * exists.
 */

export type FeedbackFieldName =
  "stage" | "description" | "severity" | "userAgent" | "category";

export type FeedbackFormConfig = {
  actionUrl: string;
  entryIds: Record<FeedbackFieldName, string>;
};

const REQUIRED_FIELDS: FeedbackFieldName[] = [
  "stage",
  "description",
  "severity",
  "userAgent",
  "category",
];

function parseEntryIds(raw: string): Record<FeedbackFieldName, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const out = {} as Record<FeedbackFieldName, string>;
  for (const field of REQUIRED_FIELDS) {
    const value = record[field];
    if (typeof value !== "string" || value.length === 0) return null;
    out[field] = value;
  }
  return out;
}

/**
 * Returns the full form config, or null when it is not configured (or is
 * configured badly). Never throws: the pop-up stays usable either way, it
 * just cannot deliver anywhere yet.
 */
export function getFeedbackFormConfig(): FeedbackFormConfig | null {
  const actionUrl = process.env.NEXT_PUBLIC_FEEDBACK_FORM_ACTION_URL;
  const rawEntryIds = process.env.NEXT_PUBLIC_FEEDBACK_FORM_ENTRY_IDS;
  if (!actionUrl || !rawEntryIds) return null;
  const entryIds = parseEntryIds(rawEntryIds);
  if (!entryIds) return null;
  return { actionUrl, entryIds };
}

/** The optional link out to a longer standalone form. Null hides the link. */
export function getFeedbackShareMoreUrl(): string | null {
  return process.env.NEXT_PUBLIC_FEEDBACK_SHARE_MORE_URL || null;
}
