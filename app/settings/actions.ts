"use server";

import { revalidatePath } from "next/cache";

import { setCoachEnabled, setDisplayName } from "@/lib/db/players";
import { validateDisplayName } from "@/lib/names/validate";
import { currentPlayerId, sessionClient } from "@/lib/supabase/session";

/**
 * The three things a player can change about themselves: their name, whether
 * the coach reads their reasons, and whether the account survives this browser.
 *
 * Every one of these starts by asking who is signed in rather than taking a
 * player id from the caller. The hot seat can change the answer, but it cannot
 * make one player edit another: the id is read here, on the server, and the
 * form never sends one.
 */

export type SettingsResult = { ok: true; message: string } | { ok: false; error: string };

/** Postgres unique violation, which here means someone else has that name. */
const UNIQUE_VIOLATION = "23505";

const SIGNED_OUT: SettingsResult = {
  ok: false,
  error: "You are not signed in.",
};

export async function renamePlayer(raw: string): Promise<SettingsResult> {
  const playerId = await currentPlayerId();
  if (!playerId) return SIGNED_OUT;

  const verdict = validateDisplayName(raw);
  if (!verdict.ok) return { ok: false, error: verdict.error };

  try {
    await setDisplayName(playerId, verdict.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes(UNIQUE_VIOLATION) || /duplicate key/i.test(message)) {
      return { ok: false, error: "Someone already goes by that name." };
    }
    throw err;
  }

  revalidatePath("/settings");
  revalidatePath("/account");
  return { ok: true, message: `You are ${verdict.name}.` };
}

export async function setCoach(enabled: boolean): Promise<SettingsResult> {
  const playerId = await currentPlayerId();
  if (!playerId) return SIGNED_OUT;

  await setCoachEnabled(playerId, enabled);

  revalidatePath("/settings");
  return {
    ok: true,
    message: enabled ? "The coach will read your reasons." : "The coach will stay quiet.",
  };
}

/**
 * Attach an email to an anonymous account.
 *
 * This only asks for the change. Supabase mails a confirmation link, and the
 * account does not become durable until it is clicked; `players.claimed_at` is
 * stamped by a database trigger at that moment, not here (migration 0009). So
 * the honest thing to tell the player is "check your mail", never "done".
 *
 * No password is set, and none is asked for. Signing back in later is a mailed
 * link, which is also why an unconfirmed address would keep nothing.
 */
export async function claimAccount(email: string): Promise<SettingsResult> {
  const playerId = await currentPlayerId();
  if (!playerId) return SIGNED_OUT;

  const address = email.trim();
  // Deliberately shallow. The confirmation mail is the real validator: an
  // address that does not exist simply never comes back.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    return { ok: false, error: "That does not look like an email address." };
  }

  const supabase = await sessionClient();
  const { error } = await supabase.auth.updateUser({ email: address });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    message: `Check ${address} for a link. Your account is kept once you click it.`,
  };
}
