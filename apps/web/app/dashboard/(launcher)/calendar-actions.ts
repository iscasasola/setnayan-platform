'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The person's ONE live calendar subscription link, minted on first use.
 *
 * ⚠ WRITTEN THROUGH THE CALLER'S OWN SESSION, NOT `service_role`. The feed
 * ROUTE has no session and must use the admin client; this does, so it uses it
 * — the RLS policies (`user_id = auth.uid()`, and an UPDATE that may only
 * produce a revoked row) are then a real second control rather than decoration.
 * Reaching for the admin client here because the route next door needed one is
 * how a table with correct policies ends up never enforcing them.
 */

/** 32 bytes → 43 URL-safe characters. Comfortably inside the column's 32..128
 *  CHECK, and not derivable from a user id, an email or a timestamp. */
function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Return this person's live token, creating one the first time they ask.
 *
 * 🔑 THE UNIQUE PARTIAL INDEX IS WHAT MAKES THIS SAFE UNDER A DOUBLE-CLICK.
 * `calendar_feed_tokens_one_live_per_user` refuses a second un-revoked row, so
 * two racing inserts cannot leave a person with two working links — one loses,
 * and this re-reads. A read-then-insert without that index would be a race that
 * only ever shows up as "why does my old link still work?".
 */
export async function getOrCreateCalendarToken(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: existing, error: readErr } = await supabase
    .from('calendar_feed_tokens')
    .select('token')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();

  // ⚠ A FAILED READ IS NOT "THEY HAVE NONE". Minting on a read error would
  // orphan the link already in their phone — it would keep working (nothing
  // revoked it) while the screen showed a different one, and the button would
  // silently stop matching what they subscribed to.
  if (readErr) {
    logQueryError('Calendar token (read)', readErr);
    return null;
  }
  if (existing) return (existing as { token: string }).token;

  const token = mintToken();
  const { error: insErr } = await supabase
    .from('calendar_feed_tokens')
    .insert({ user_id: user.id, token });
  if (insErr) {
    // Lost the race against the person's own second click: re-read rather than
    // reporting a failure for something that actually succeeded.
    const { data: raced } = await supabase
      .from('calendar_feed_tokens')
      .select('token')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .maybeSingle();
    if (raced) return (raced as { token: string }).token;
    logQueryError('Calendar token (insert)', insErr);
    return null;
  }
  return token;
}

/**
 * "Reset my link" — revoke the live one, then mint the next.
 *
 * ⚠ ORDER IS LOAD-BEARING, AND SO IS THE RETURN. Revoking FIRST means a failure
 * halfway through leaves the person with NO working link rather than TWO — a
 * broken subscription is visible and fixable, a leaked one that still works is
 * neither. And the partial unique index would refuse the new row anyway while
 * the old one stands, so minting first cannot work even by accident.
 */
export async function resetCalendarToken(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();

  const { error: revokeErr } = await supabase
    .from('calendar_feed_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('revoked_at', null);
  if (revokeErr) {
    // 🔑 STOP. Carrying on would mint a SECOND live link while the leaked one
    // is still serving — the exact outcome the person pressed this to prevent,
    // reported to them as success.
    logQueryError('Calendar token (revoke)', revokeErr);
    return;
  }

  await getOrCreateCalendarToken();
  revalidatePath('/dashboard');
}
