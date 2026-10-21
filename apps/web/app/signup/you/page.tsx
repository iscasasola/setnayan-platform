/**
 * /signup/you — "How should we call you?" The one card after a new account
 * exists (owner 2026-09-22, prototype `one_door_FINAL_2026-09-22.html`, approved).
 *
 * A first-run SUBSET of Profile & settings › Profile, in the same greige card
 * /signup and /login wear: photo (optional), display name (required), the
 * @account name with a live availability check (only while the account has
 * none), the formal name folded away (the five parts of the 2026-09-21 ruling:
 * self-declared, never verified, for guest lists and invitations), and a phone.
 * Done saves and continues to `next`; Later continues without saving. Every
 * field here also lives on the profile page, where it can be changed later —
 * this card exists so a brand-new person is not sent to Settings to be named.
 *
 * Reached from `signUp` (couples) and from the OAuth callback for a brand-new
 * customer account (`lib/signup-landing.ts`). Vendors skip it: /open-shop step 3
 * asks their name. A signed-out visitor is sent to /signup; a signed-in one who
 * types the URL later simply sees their current values.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { signInDestination } from '@/lib/sign-in-landing';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { saveYou } from './actions';
import { YouCard, type YouCardMe } from './_components/you-card';

export const metadata: Metadata = {
  title: 'You',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function YouPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Where Done and Later hand on to: the ONE sign-in rule — a real destination
  // (the event they came from, the onboarding resume) comes back whole; a bare
  // `/` becomes the dashboard, never the front door (audit 2026-09-25 §C).
  const next = signInDestination(safeNext(params.next));
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(next)}`);

  // Own row (RLS). Read exactly the columns the card shows; nothing else.
  const { data: profile } = await supabase
    .from('users')
    .select(
      'display_name, slug, name_prefix, first_name, middle_name, last_name, name_suffix, phone, profile_photo_url, account_type, public_summary_consent_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  const me = (profile ?? {}) as YouCardMe;

  const storedPhoto = me.profile_photo_url ?? null;
  // A brand-new account has no photo; a returning one may. The try/catch is
  // load-bearing (the presign throws when R2 is unset) — a thumbnail is
  // decoration, the card is the product.
  const photoDisplayMap: Record<string, string> = {};
  if (storedPhoto?.startsWith('r2://')) {
    try {
      const url = await displayUrlForStoredAsset(storedPhoto);
      if (url) photoDisplayMap[storedPhoto] = url;
    } catch {
      /* no thumbnail */
    }
  }

  return (
    <YouCard
      action={saveYou}
      next={next}
      errorMessage={errorMessage}
      userId={user.id}
      email={user.email ?? null}
      me={me}
      photoDisplayMap={photoDisplayMap}
    />
  );
}
