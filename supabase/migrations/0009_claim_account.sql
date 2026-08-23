-- ---------------------------------------------------------------------------
-- 0009: stamp claimed_at when an anonymous account actually becomes durable
-- ---------------------------------------------------------------------------
--
-- Attaching an email is a two-step: the app calls auth.updateUser({ email }),
-- Supabase mails a link, and the account only becomes durable when the player
-- clicks it. The moment that matters is the click, not the request.
--
-- Doing this in the app would mean stamping it on the auth callback, which is a
-- route that can be missed: a player who confirms on their phone, or from a mail
-- client that prefetches the link, would end up with a confirmed email and a
-- profile that still says anonymous. The database sees the confirmation either
-- way, so it does the stamping.
--
-- Idempotent by the null guard: re-confirming, or changing the email later,
-- leaves the original claim date alone. The date is when the account stopped
-- being disposable, and it only stops once.

create function public.handle_auth_user_claimed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only on the transition. email_confirmed_at going from null to a value is
  -- the single event worth reacting to; every other update to auth.users
  -- (a token refresh, a password set, last_sign_in_at) leaves this alone.
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.players
       set claimed_at = new.email_confirmed_at
     where id = new.id
       and claimed_at is null;
  end if;
  return new;
end;
$$;

comment on function public.handle_auth_user_claimed() is
  'Mirrors the moment an anonymous account confirmed an email onto '
  'players.claimed_at. Fires on confirmation, not on the request to change '
  'the email, because an unconfirmed address keeps nothing.';

create trigger on_auth_user_claimed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_auth_user_claimed();

-- Backfill: anyone who already confirmed an email before this trigger existed.
-- No-op on a fresh database, and correct on one that has been played in.
update public.players p
   set claimed_at = u.email_confirmed_at
  from auth.users u
 where u.id = p.id
   and u.email_confirmed_at is not null
   and p.claimed_at is null;
