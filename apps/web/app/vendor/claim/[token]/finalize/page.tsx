import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchClaimLandingByToken } from '@/lib/vendor-invites';
import { applyClaimAutoLink } from '@/lib/vendor-invite-actions';
import { seatClaimedCoupleAsCustomer } from '@/lib/claimed-couple-is-a-customer.server';
import { ensureBusinessAlaga } from '@/lib/business-alaga-ensure';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { DoorShell } from '@/app/_components/door/door-shell';

const VENDOR_CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

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
 *   1b. Give the shop its business alaga (`ensureBusinessAlaga`) — the shop
 *      is now the account's, so it is a business they care for.
 *   2. Call `applyClaimAutoLink` to mark the invite claimed, raise the ONE
 *      access ask the couple approves (owner 2026-10-20 — the record is bonded
 *      to the shop only on Approve), and insert vendor_follows for the couple.
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
    // The person who used it (a retry, a refresh) goes on to their dashboard.
    // Anybody else holding the same link is told it was used — never dropped on
    // a dashboard with an empty shop and no word about the couple (2026-10-19).
    if (data.invite.claimed_by_user_id === user.id) redirect('/vendor-dashboard');
    return (
      <ErrorShell
        title="This link was already used."
        body={`Someone has already joined with it. If that wasn't you, ask ${data.event?.couple_display_name ?? 'whoever sent it'} for a new link.`}
      />
    );
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
  //
  //    🔑 2026-10-19 — (a) WAS EVERY FRESH SIGN-UP, AND IT WROTE NOTHING.
  //    `/signup?as=vendor` makes the account a vendor, and the database trigger
  //    `handle_new_vendor_user` opens an EMPTY shop the same instant (no name,
  //    no service). So by the time this page ran the supplier always "had a
  //    shop", (c) never ran, and everyone who joined from a couple's link
  //    arrived nameless and in no category. A couple-made link now goes through
  //    `claim_ready_the_shop` (migration 20271280303462) — find or open the
  //    shop, fill ONLY its blank name and service from the couple's record,
  //    make sure it has its admin seat. Proven end to end by
  //    tests/db/a-supplier-joins-from-the-couples-link.db.test.ts.
  //
  //    🎁 2026-10-23 — Setnayan's own invite had the same trap, worse: (b) never ran either, so the staged row the
  //    admin filled was orphaned. It now goes through `claim_ready_the_invited_shop` (below), which does (a)–(c)
  //    in one statement and applies the personal invite's offer.
  // ------------------------------------------------------------------
  let vendorProfileId: string;

  if (data.invite.source !== 'admin') {
    const { data: readied, error: readyErr } = await admin.rpc('claim_ready_the_shop', {
      p_user_id: user.id,
      p_claim_token: token,
    });
    if (readyErr || typeof readied !== 'string' || !readied) {
      return (
        <ErrorShell
          title="Couldn't set up your supplier profile."
          body={readyErr?.message ?? 'Please try again or contact support.'}
        />
      );
    }
    vendorProfileId = readied;
  } else {
    // 🎁 SETNAYAN'S OWN INVITE (migration `the_personal_invite_carries_its_offer`, owner 2026-10-23). The same
    // trap as the couple's link: the vendor sign-up has ALREADY opened an empty shop, so the old "already has a
    // shop" branch won every time and the staged row the admin filled was never reached — the supplier arrived
    // nameless. `claim_ready_the_invited_shop` hands the staged row over (or fills the empty shop's blanks from it
    // and drops it), seats the admin, and applies the personal invite's offer — the plan until its day as an admin
    // comp (the same columns and log line as `setVendorTier`), and the photos, kept. Proven by
    // tests/db/the-personal-invite-carries-its-offer.db.test.ts.
    const { data: readied, error: readyErr } = await admin.rpc('claim_ready_the_invited_shop', {
      p_user_id: user.id,
      p_claim_token: token,
    });
    if (readyErr || typeof readied !== 'string' || !readied) {
      return (
        <ErrorShell
          title="Couldn't set up your supplier profile."
          body={readyErr?.message ?? 'Please try again or contact support.'}
        />
      );
    }
    vendorProfileId = readied;
  }

  // ------------------------------------------------------------------
  // 1b. THE SHOP IS NOW THEIRS, SO IT BECOMES THEIR BUSINESS ALAGA.
  //
  //    Owner 2026-09-30: "if you create a business. it also creates a beloved
  //    that is your business." Opening a shop has written that record since
  //    then; a shop that became the account's HERE — the couple's link
  //    (`claim_ready_the_shop`), the admin pre-staged transfer, the stub create,
  //    or an existing shop connecting — never did, so its owner could not pick
  //    "For · <shop>" when creating an event (2026-10-22).
  //
  //    The name is read back from the shop row, because `claim_ready_the_shop`
  //    may have just filled it from the couple's record. Owner = the
  //    authenticated caller, and only when the row says the shop is theirs.
  //    Best-effort: `ensureBusinessAlaga` never throws or redirects, and nothing
  //    here can stop the claim. Same gates, same exactly-once key as open-shop.
  // ------------------------------------------------------------------
  {
    const { data: shopRow, error: shopErr } = await admin
      .from('vendor_profiles')
      .select('user_id, business_name')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    // A refused read skips the record (never the claim) — and says so.
    if (shopErr) {
      console.error('[supabase-error] vendor/claim/finalize · from:vendor_profiles.select (alaga)', shopErr);
    }
    const shop = shopRow as { user_id?: string | null; business_name?: string | null } | null;
    if (shop?.user_id === user.id) {
      await ensureBusinessAlaga(admin, {
        ownerUserId: user.id,
        vendorProfileId,
        shopName: shop.business_name,
      });
    }
  }

  // ------------------------------------------------------------------
  // 2. Auto-link — flips the invite to 'claimed', raises the couple's
  //    approval (`claim_ask_for_access`; NOTHING of the event opens until they
  //    approve — owner 2026-10-20), and inserts vendor_follows for the couple
  //    members (per 0019 § Booking-implies-follow auto-insert).
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

    // The couple who invited them is their CUSTOMER, not a new inquiry (owner
    // 2026-10-10). On the supplier's own session — the unlock checks the caller.
    // Fail-soft: a refusal leaves the thread as an inquiry they can accept.
    if (data.parentVendor?.event_id) {
      await seatClaimedCoupleAsCustomer(supabase, {
        vendorProfileId,
        eventId: data.parentVendor.event_id,
      });
    }
  }

  // ------------------------------------------------------------------
  // 3. PR-C — guided first-service setup.
  //
  //    On a FRESH couple-source claim (a manually-added off-platform vendor
  //    who just signed up), route them into the EXISTING services-creation
  //    wizard with the invite's category pre-picked, carrying the claim
  //    token so the new service registers back to the couple's plan
  //    (event_vendors.service_id) on submit.
  //
  //    Gates (any failing → fall through to the plain dashboard):
  //      • Couple/auto_share_link source only (admin-source has no event_vendors
  //        row to register against).
  //      • Vendor has NO services yet (don't interrupt an established vendor
  //        connecting to a new couple — they already have a catalog).
  //      • The invite carries a service_category that maps to a real vendor
  //        category route (else the /new/[category] page 404s).
  // ------------------------------------------------------------------
  if (data.invite.source !== 'admin') {
    const category = data.invite.service_category;
    if (category && VENDOR_CATEGORY_SET.has(category)) {
      const { count } = await admin
        .from('vendor_services')
        .select('vendor_service_id', { count: 'exact', head: true })
        .eq('vendor_profile_id', vendorProfileId);
      if ((count ?? 0) === 0) {
        redirect(
          `/vendor-dashboard/services/new/${encodeURIComponent(category)}?claim=${encodeURIComponent(token)}`,
        );
      }
    }
  }

  // 🎁 Setnayan's own invite lands on Shop › Your details (prototype frame B4): the staged rows are already in,
  // and the one step left is right there. The spotlight tour starts wherever they land (frame B5).
  if (data.invite.source === 'admin') redirect('/vendor-dashboard/profile');

  // Default — land them in the vendor dashboard with the new client visible in
  // their Clients pipeline (couple-source) or just the fresh dashboard
  // (already-has-services).
  redirect('/vendor-dashboard?claimed=1');
}

/**
 * The finalize step's refusals — ported onto the shared <DoorShell> in
 * `dead_end` tone (2026-08-17), so the last screen of the supplier's claim
 * looks like the last screen of every other door.
 *
 * The one control stays "Back to sign in" rather than "Back to Setnayan": a
 * person only reaches this page mid-claim, already part-way through an account,
 * so signing in is the step that actually un-sticks them.
 */
function ErrorShell({ title, body }: { title: string; body?: string }) {
  return (
    <DoorShell tone="dead_end" eyebrow="Claim" title={title} sub={body}>
      <Link href="/login" className="button-secondary">
        Back to sign in
      </Link>
    </DoorShell>
  );
}
