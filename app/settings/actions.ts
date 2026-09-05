"use server";

import { revalidatePath } from "next/cache";

import { isPlayerEmoji } from "@/lib/avatar";
import { setAvatarEmoji, setCoachEnabled, setDisplayName } from "@/lib/db/players";
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
 * Set the player's avatar emoji, or clear it back to the derived initials
 * mark with `emoji: null`. The nine choices live in `lib/avatar.ts`'s
 * `PLAYER_EMOJIS`; anything else is rejected here rather than trusted through
 * to the database constraint, so a bad value reads back as a settings error
 * instead of a failed update.
 */
export async function setAvatar(emoji: string | null): Promise<SettingsResult> {
  const playerId = await currentPlayerId();
  if (!playerId) return SIGNED_OUT;

  if (emoji !== null && !isPlayerEmoji(emoji)) {
    return { ok: false, error: "That is not one of the avatars on offer." };
  }

  await setAvatarEmoji(playerId, emoji);

  revalidatePath("/settings");
  revalidatePath("/account");
  return {
    ok: true,
    message: emoji ? "Avatar updated." : "Back to your initials.",
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
 *
 * This is the one setting that cannot be keyed on `currentPlayerId()`, because
 * the address lives on the auth user and only the auth server may change it.
 * That opens a gap the other two do not have: under the dev hot seat the id you
 * are pretending to be and the id your session actually holds are different
 * people, and `updateUser` would quietly attach the address to the latter. So
 * the two are compared, and a borrowed seat is refused rather than served.
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

  const { data, error: whoError } = await supabase.auth.getUser();
  if (whoError || !data.user) return SIGNED_OUT;
  if (data.user.id !== playerId) {
    // Only reachable in local dev, where the hot seat exists at all.
    return {
      ok: false,
      error:
        "This seat is borrowed, so it has no email of its own to keep. Leave the hot seat first.",
    };
  }

  const { error } = await supabase.auth.updateUser({ email: address });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    message: `Check ${address} for a link. Your account is kept once you click it.`,
  };
}
