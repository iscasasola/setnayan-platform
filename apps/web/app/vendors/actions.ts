'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Iteration 0041 — email capture for Coming-Soon event_type interest.
// Mirrors the 0043 `notifyWhenWeddingTypeLaunches` pattern but indexed by
// event_type instead of ceremony_type. The form lives on the /vendors
// empty-state banner that PR #184 added, fires when no vendors match the
// active event_type filter.
//
// user_id is stamped when the action is invoked with an authenticated
// session; anonymous submissions persist email only. Both paths use the
// admin client to bypass RLS on insert — the policy on
// couple_event_type_notify_signups grants INSERT to anon + auth anyway,
// but admin client keeps the signature identical to other "submit and
// confirm" forms in the app.

const ALLOWED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'wedding',
  'gender_reveal',
  'debut',
  'birthday',
  'celebration',
  'travel',
  'corporate',
  'tournament',
  'christening',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NotifyResult =
  | { status: 'ok' }
  | { status: 'invalid_email' }
  | { status: 'invalid_event_type' }
  | { status: 'error'; message: string };

export async function notifyWhenEventTypeLaunches(formData: FormData): Promise<NotifyResult> {
  const rawEmail = String(formData.get('email') ?? '').trim();
  const rawEventType = String(formData.get('event_type') ?? '').trim();

  if (!EMAIL_REGEX.test(rawEmail)) {
    return { status: 'invalid_email' };
  }
  if (!ALLOWED_EVENT_TYPES.has(rawEventType)) {
    return { status: 'invalid_event_type' };
  }

  // Stamp user_id if the visitor is signed in; leave null for anonymous
  // browsers. Either way the row is valid per the RLS policy + the column
  // schema.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin.from('couple_event_type_notify_signups').insert({
    user_id: user?.id ?? null,
    email: rawEmail.toLowerCase(),
    event_type: rawEventType,
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  // Marketplace page may want to repaint with a "thanks" banner — the
  // submitter's URL stays put so we revalidate the same path.
  revalidatePath('/vendors');
  return { status: 'ok' };
}
