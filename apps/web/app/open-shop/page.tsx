import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { shopConsolePath } from '@/lib/shop-console-path';
import { fetchVendorServicePickerVocab } from '@/lib/vendor-service-vocab';
import { getVendorServableEventTypes } from '@/lib/event-types-db';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { OpenShopWizard } from './_components/open-shop-wizard';
import { getOpenShopServiceTree } from '@/lib/open-shop-service-tree';
import { readBookingFeeJoinSchedule } from '@/lib/booking-fee-disclosure.server';
import { bookingFeeJoinDisclosure } from '@/lib/booking-fee-disclosure';
import { getOAuthGate } from '@/lib/request-platform';
import { OAUTH_FLAGS } from '@/app/_components/oauth-button-row';
import { reviewedAliasesByLiveTrade } from '@/lib/service-trade-aliases';
import { getReviewedTradeAliasRows } from '@/lib/service-trade-aliases-db';
import { getServiceMergeForwards } from '@/lib/service-merge-forward-db';
import { categoryLadder } from '@/lib/vendor-tier-caps';

/**
 * /open-shop — the ONE smart entry point behind every "Register your business"
 * CTA + the vendor signup landing (owner 2026-07-03). Routes by state:
 *
 *   • logged OUT                     → the wizard, signed out (mode 'create'):
 *     the LAST step (4, "You" — owner 2026-11-06, the account goes last) also
 *     creates the account, and "Sign in" opens the sign-in pane over the
 *     wizard (owner 2026-09-22 "account inside step 3" — supersedes the
 *     2026-07-10 login-first bounce to /login?next=/open-shop&as=vendor, which
 *     survives only as the no-JavaScript fallback of that link)
 *   • logged in, shop with a NAME    → /vendor-dashboard (Today — first-timer fix 12)
 *   • logged in, no shop             → the onboarding wizard (mode 'create')
 *   • logged in, never-named shop    → the wizard (mode 'complete' — a fresh
 *     signup's trigger-provisioned bare shop lands here to fill the basics)
 *
 * The wizard collects the owner-locked basics (shop name · primary
 * service · owner name · contact number · company email · location); website
 * + social links and everything else continue on My Shop via the profile
 * checklist + Get-verified journey (owner 2026-07-05).
 */

export const metadata = { title: 'Open your shop' };

export default async function OpenShopPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; step?: string; next?: string; taken?: string; check_inbox?: string; as?: string }>;
}) {
  const { error, step, next, taken, check_inbox: checkInbox, as: arrivedAs } = await searchParams;
  // Where a person who ALREADY has a shop is sent (e.g. "Get your invite link"
  // on /for-suppliers → `?next=/vendor-dashboard/shop/promote`). Same-origin by
  // `safeNext`, and only ever a page of the Shop console — /open-shop is not a
  // general-purpose redirector. Default: Today.
  const landing = shopConsolePath(next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Logged out is no longer a bounce (owner 2026-09-22): the wizard renders for a
  // stranger and step 4 creates the account with the shop. Every read below that
  // needs an account is guarded on `user`; the vocab reads are anon-readable, and
  // the tree falls back to the flat select if a read is refused.
  const guest = !user;
  // OAuth visibility by shell — the same gate /login applies (see login-data.ts):
  // web + desktop show the buttons; the phone app only its native variant.
  const gate = await getOAuthGate(OAUTH_FLAGS);

  // Own-row read passes RLS. A shop that has a NAME finished onboarding.
  const { data: owned, error: ownedError } = user ? await supabase
    // `vendor_profiles_self` (migration 20271217955839), never the table: the
    // projection names `business_owner_name`, off `authenticated`'s column
    // allowlist, and one denied column refuses the whole query — which here
    // would read as "you have no shop" and restart onboarding over a shop that
    // already exists.
    .from('vendor_profiles_self')
    .select(
      'vendor_profile_id, business_name, business_slug, logo_url, services, event_types, location_city, business_owner_name, business_owner_position, contact_phone, contact_email, hq_address, in_business_since_year',
    )
    .eq('user_id', user.id)
    .maybeSingle() : { data: null, error: null };
  // 🔒 A REFUSED READ IS NOT "NO SHOP". Read as empty, it re-opens the wizard
  // over a shop that already has a name — the restart the view above exists to
  // prevent. Throw to the error screen, which says the truth: try again.
  if (ownedError) {
    throw new Error(`open-shop: could not read your shop (${ownedError.message})`);
  }
  const row = owned as {
    vendor_profile_id?: string | null;
    business_name?: string | null;
    business_slug?: string | null;
    logo_url?: string | null;
    services?: string[] | null;
    event_types?: string[] | null;
    location_city?: string | null;
    hq_address?: string | null;
    business_owner_name?: string | null;
    business_owner_position?: string | null;
    in_business_since_year?: number | null;
    contact_phone?: string | null;
    contact_email?: string | null;
  } | null;
  if (row?.business_name?.trim()) redirect(landing);

  // Taxonomy-driven labels for the primary-service picker (degrades to the
  // in-code names on a hiccup).
  const { serviceLabels } = await fetchVendorServicePickerVocab();

  // Event-type roster the vendor can serve (admin-driven; same source the
  // marketplace ?event_type= filter + the My Shop coverage editor read). Without
  // this signal a new shop is stuck at the column default ['wedding'] and is
  // invisible for every non-wedding event it actually serves.
  // 🖼 `heroPhotoUrl` rides along (owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS ANSWERED", call 3): the
  // events are drawn as the SAME photos a couple picks from in Create event (`eventTypePhotoSrc`).
  const eventTypeOptions = (await getVendorServableEventTypes()).map((e) => ({
    key: e.key,
    label: e.label,
    emoji: e.emoji,
    heroPhotoUrl: e.heroPhotoUrl ?? null,
  }));
  // 🎟 EVERY EVENT TYPE STARTS TICKED (owner 2026-11-06: "All on, untick to remove"). The default is the FULL roster
  // just read — never a hard-coded copy — and the column default (`wedding`) is not changed. A shop whose own row
  // already says something richer than that column default (the coverage editor ran) keeps what it chose.
  const allEventKeys = eventTypeOptions.map((e) => e.key);
  const ownEvents = row?.event_types ?? [];
  const chosenEvents =
    ownEvents.length > 0 && !(ownEvents.length === 1 && ownEvents[0] === 'wedding') ? ownEvents : allEventKeys;

  // Pre-resolve a display URL for an already-uploaded logo so the <FileUpload>
  // thumbnail paints on first load (a fresh signup won't have one yet).
  // 🚨 THE TRY/CATCH IS LOAD-BEARING, NOT DEFENSIVE DECORATION (2026-08-08).
  // `displayUrlForStoredAsset` → `presignDisplayUrl` → `requireR2Client()`,
  // which THROWS when the R2 env is unset. This is a top-level await in the
  // page body, so an unhandled throw here does not degrade to "no thumbnail" —
  // it 500s the whole route, and only for a vendor who ALREADY uploaded a logo.
  // A returning vendor could not open their own onboarding wizard at all, while
  // a brand-new one sails through, which is the hardest possible shape to
  // reproduce. A logo thumbnail is decoration; the wizard is the product.
  const logoDisplayMap: Record<string, string> = {};
  if (row?.logo_url) {
    let displayUrl: string | null = null;
    try {
      displayUrl = await displayUrlForStoredAsset(row.logo_url);
    } catch {
      displayUrl = null;
    }
    if (displayUrl) logoDisplayMap[row.logo_url] = displayUrl;
  }

  // The parent -> branch -> leaf tree the picker drills (owner 2026-08-09).
  // First-party Setnayan SKUs are stripped inside — picking one would make the
  // shop invisible on /explore. Fail-soft: [] makes the wizard fall back to its
  // flat select rather than blocking a vendor from opening a shop.
  const bareTree = await getOpenShopServiceTree().catch(() => []);
  // 🔤 The reviewed aliases ride on each leaf (owner 2026-11-06 gate walk: the picker searches with the SAME ranker
  // and the SAME reviewed words as Explore and the card maker — `lib/service-card-maker.server.ts` builds them the
  // same way). Fail-soft: no aliases is today's search, never a blocked wizard.
  const [aliasRows, mergeForwards] = await Promise.all([
    getReviewedTradeAliasRows().catch(() => []),
    getServiceMergeForwards().catch(() => ({})),
  ]);
  const aliasesByLeaf = reviewedAliasesByLiveTrade(
    aliasRows,
    mergeForwards,
    new Set(bareTree.flatMap((p) => p.branches.flatMap((b) => b.leaves.map((l) => l.canonicalService)))),
  );
  const serviceTree = bareTree.map((p) => ({
    ...p,
    branches: p.branches.map((b) => ({
      ...b,
      leaves: b.leaves.map((l) => ({ ...l, aliases: aliasesByLeaf.get(l.canonicalService) })),
    })),
  }));
  // The signed-in account's own name — shown read-only on step 4 rather than
  // asked (owner 2026-08-10). Fail-soft: null keeps the field editable, which is
  // the right behaviour for an account that has no display name yet.
  const accountName = await (async () => {
    if (!user) return null;
    try {
      const { data } = await supabase
        .from('users')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const n = (data as { display_name?: string | null } | null)?.display_name?.trim();
      return n || null;
    } catch {
      return null;
    }
  })();
  // A re-run must show the NAME of the saved service, not its stored key.
  const savedService = row?.services?.[0] ?? '';
  const savedServiceLabel =
    serviceTree
      .flatMap((p) => p.branches.flatMap((b) => b.leaves))
      .find((l) => l.canonicalService === savedService)?.label ??
    serviceLabels?.[savedService] ??
    null;

  // WHAT "FREE" MEANS — the booking-fee disclosure, composed from the OWNER'S
  // LIVE schedule. Null while the fee system is dark, and the wizard then says
  // nothing rather than promising a fee that cannot be charged.
  // ⚠ 'off' and null are NOT the same. 'off' = no fee exists, so say nothing.
  // null = the read failed, and the disclosure then says it could not load the
  // rate rather than implying there is no fee.
  const feeSchedule = await readBookingFeeJoinSchedule().catch(() => null);
  const feeNotice = feeSchedule === 'off' ? null : bookingFeeJoinDisclosure(feeSchedule);

  return (
    <OpenShopWizard
      mode={row ? 'complete' : 'create'}
      feeNotice={feeNotice}
      serviceLabels={serviceLabels}
      serviceTree={serviceTree}
      accountName={accountName}
      existingSlug={row?.business_slug ?? null}
      savedServiceLabel={savedServiceLabel}
      eventTypeOptions={eventTypeOptions}
      vendorProfileId={row?.vendor_profile_id ?? null}
      logoDisplayMap={logoDisplayMap}
      defaults={{
        shopName: row?.business_name ?? '',
        logoUrl: row?.logo_url ?? '',
        primaryService: row?.services?.[0] ?? '',
        // Every type ticked to start (above); a re-run keeps a richer set the coverage editor already wrote.
        eventTypes: chosenEvents,
        locationCity: row?.location_city ?? '',
        hqAddress: row?.hq_address ?? '',
        contactName: row?.business_owner_name ?? '',
        contactPosition: row?.business_owner_position ?? '',
        contactPhone: row?.contact_phone ?? '',
        contactEmail: row?.contact_email ?? user?.email ?? '',
      }}
      guest={guest}
      // 🧭 `?as=coordinator` (the For Coordinators page's button): step 2 opens on the coordination services, read
      // from COORDINATOR_TRADE_SERVICES — owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS ANSWERED".
      coordinator={arrivedAs === 'coordinator'}
      oauth={gate}
      signInHref={
        '/login?next=' +
        encodeURIComponent(landing === '/vendor-dashboard' ? '/open-shop' : '/open-shop?next=' + encodeURIComponent(landing)) +
        '&as=vendor'
      }
      error={error}
      planCategories={categoryLadder()}
      // A8: the submit was refused because the email has an account → step 4 signs in, right there.
      emailTaken={taken === '1'}
      // A1: the shop is open (`?check_inbox=`, never `?sent=` — that word is a global "Sent." toast) and the account waits for its link (verification on). Only ever the signed-out page.
      sentTo={guest && checkInbox ? checkInbox.trim().slice(0, 254) : null}
      initialStep={(['1', '2', '3', '4'].includes(step ?? '') ? Number(step) : 1) as 1 | 2 | 3 | 4}
    />
  );
}
