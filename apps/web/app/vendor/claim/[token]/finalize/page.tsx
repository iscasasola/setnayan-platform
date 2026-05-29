import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchClaimLandingByToken } from '@/lib/vendor-invites';
import { applyClaimAutoLink } from '@/lib/vendor-invite-actions';

export const metadata = {
  title: 'Connecting your Setnayan profile',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/**
 * Auth-gated completion route for the couple-invite claim flow. Called as
 * the `next` redirect target from:
 *   • /vendor/claim/[token] → /signup → here (default branch · new vendor)
 *   • /vendor/claim/[token] → /login  → here (Already-on-Setnayan · existing vendor)
 *
 * Runs the auto-link transaction:
 *   1. Ensure a `vendor_profiles` row exists for the signed-in user
 *      (create with placeholder business_name if missing — vendor edits
 *      it later in /vendor-dashboard).
 *   2. Call `applyClaimAutoLink` to set marketplace_vendor_id, mark the
 *      invite claimed, and insert vendor_follows rows for the couple.
 *   3. Redirect to /vendor-dashboard.
 */
export default async function FinalizeClaimPage({ params }: Props) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Not authenticated — send them back through the public claim page
    // so the right sign-in/sign-up CTA appears.
    redirect(`/vendor/claim/${token}`);
  }

  // Load the invite (admin client — token IS the access gate).
  const admin = createAdminClient();
  const data = await fetchClaimLandingByToken(admin, token);
  if (!data) {
    return <ErrorShell title="Invite link not found." />;
  }
  if (data.invite.status === 'claimed') {
    redirect('/vendor-dashboard');
  }
  if (data.invite.status !== 'pending') {
    return (
      <ErrorShell
        title={`This invite is ${data.invite.status}.`}
        body={`Ask ${data.event?.couple_display_name ?? 'Setnayan'} to send you a new one.`}
      />
    );
  }

  // ------------------------------------------------------------------
  // 1. Resolve the vendor_profiles row to land in.
  //
  //    Three branches:
  //    (a) The signed-in user already has a vendor_profiles row
  //        (Already-on-Setnayan / Connect path).
  //    (b) 2026-05-21 — Admin-pre-staged unclaimed profile linked to
  //        this invite (data.invite.source === 'admin' and the invite's
  //        claimed_vendor_profile_id points at a row with user_id=NULL).
  //        Transfer ownership by UPDATEing user_id = claimant.
  //    (c) Default — create a fresh stub row.
  // ------------------------------------------------------------------
  let vendorProfileId: string;
  const { data: existingProfile } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingProfile) {
    vendorProfileId = existingProfile.vendor_profile_id as string;
  } else if (
    data.invite.source === 'admin' &&
    data.invite.claimed_vendor_profile_id
  ) {
    // Transfer ownership of the pre-staged row to the claimant. The
    // .is('user_id', null) guard prevents two parallel claims from
    // racing to take the same profile.
    const { data: transferred, error: transferErr } = await admin
      .from('vendor_profiles')
      .update({
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('vendor_profile_id', data.invite.claimed_vendor_profile_id)
      .is('user_id', null)
      .select('vendor_profile_id')
      .single();
    if (transferErr || !transferred) {
      return (
        <ErrorShell
          title="Couldn't transfer your vendor profile."
          body={transferErr?.message ?? 'The pre-staged profile may already be claimed.'}
        />
      );
    }
    vendorProfileId = transferred.vendor_profile_id as string;
  } else {
    const { data: created, error: createErr } = await admin
      .from('vendor_profiles')
      .insert({
        user_id: user.id,
        business_name: data.invite.business_name,
        contact_email: data.invite.email,
        services: data.invite.service_category ? [data.invite.service_category] : [],
        is_published: false,
      })
      .select('vendor_profile_id')
      .single();
    if (createErr || !created) {
      return (
        <ErrorShell
          title="Couldn't create your vendor profile."
          body={createErr?.message ?? 'Please try again or contact support.'}
        />
      );
    }
    vendorProfileId = created.vendor_profile_id as string;
  }

  // ------------------------------------------------------------------
  // 2. Auto-link transaction — sets event_vendors.marketplace_vendor_id,
  //    flips invite to 'claimed', and inserts vendor_follows for the
  //    couple members (per 0019 § Booking-implies-follow auto-insert).
  //
  //    2026-05-21 — Admin-source invites (no event_vendors parent) skip
  //    this step. We just flip the invite to 'claimed' so it can't be
  //    re-used; there's no event to follow.
  // ------------------------------------------------------------------
  if (data.invite.source === 'admin') {
    const { error: claimErr } = await admin
      .from('vendor_invites')
      .update({
        status: 'claimed',
        claimed_by_user_id: user.id,
        claimed_vendor_profile_id: vendorProfileId,
        claimed_at: new Date().toISOString(),
      })
      .eq('invite_id', data.invite.invite_id)
      .eq('status', 'pending');
    if (claimErr) {
      return (
        <ErrorShell
          title="Couldn't finish claim."
          body={claimErr.message}
        />
      );
    }
  } else {
    const linked = await applyClaimAutoLink({
      claimToken: token,
      claimedByUserId: user.id,
      claimedVendorProfileId: vendorProfileId,
    });

    if (!linked.ok) {
      return <ErrorShell title="Couldn't finish connecting." body={linked.message} />;
    }
  }

  // ------------------------------------------------------------------
  // 3. Done. Land them in the vendor dashboard with the new client
  //    visible in their Clients pipeline (couple-source) or just the
  //    fresh dashboard (admin-source).
  // ------------------------------------------------------------------
  redirect('/vendor-dashboard?claimed=1');
}

function ErrorShell({ title, body }: { title: string; body?: string }) {
  return (
    <main className="min-h-screen bg-page px-4 py-20">
      <div className="mx-auto max-w-md space-y-4 rounded-xl bg-cream p-8 text-center ring-1 ring-inset ring-ink/10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Setnayan · Claim
        </p>
        <h1 className="font-serif text-2xl font-medium text-ink">{title}</h1>
        {body ? <p className="text-sm text-ink/70">{body}</p> : null}
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream hover:bg-mulberry-700"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
