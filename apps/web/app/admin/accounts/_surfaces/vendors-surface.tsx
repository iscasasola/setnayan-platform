import Link from 'next/link';
import Image from 'next/image';
import { Pencil, Trash2, BadgeCheck, Users } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { displayServiceLabel } from '@/lib/vendors';
import {
  VENDOR_PUBLIC_VISIBILITY_LABEL,
  isShopLive,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { InviteVendorForm } from '@/app/admin/vendors/_components/invite-vendor-form';
import { revokeAdminVendorInvite } from '@/app/admin/vendors/actions';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * The three read ceilings on this surface, named once each and disclosed where
 * the rows they cap are rendered. All three were bare `.limit(...)` calls and
 * nothing on the page said any of them existed.
 */
const CLAIMED_ROW_LIMIT = 200;
const UNCLAIMED_ROW_LIMIT = 50;
const REQUEST_ROW_LIMIT = 50;

/**
 * VendorsSurface — the Vendors LIST body, re-homed byte-identical from
 * app/admin/vendors/page.tsx into the tabbed /admin/accounts studio (Accounts
 * Studio slice 3). Behaviour is unchanged: the ?q + ?status filters, the invite
 * form, the New-vendor-requests + Pending-claim sections, and the rows linking
 * to the standalone /admin/vendors/[id]/edit + /tokens + /team routes. Only two
 * things differ, both mechanical:
 *   1. It accepts the surface's own searchParams (q, status) as props from the
 *      /admin/accounts shell instead of awaiting them itself.
 *   2. The filter form posts to /admin/accounts with a hidden tab=vendors input
 *      so submitting a filter stays on the Vendors tab.
 *
 * The row links to /admin/vendors/[id]/edit + /tokens + /team STAY pointing at
 * those standalone routes — they are not absorbed into the studio. The invite
 * form + its createAdminVendorInvite/revokeAdminVendorInvite actions are
 * imported from their existing /admin/vendors locations (unmoved). This surface
 * has no logAdminDataAccess/after() audit side-effect (the original vendors
 * page had none — only logQueryError, which moves with the body).
 */
/**
 * ── 2026-08-17 · onto <ConsoleTable>, and it was NOT a looks change ──────────
 * FOUR reads, ONE of which looked at its own error. The other three were written
 * `const { data: x } = await …` — the error not even destructured — and then
 * coerced with `?? []`.
 *
 * 🚨 AND THE WORST CASE HERE IS NOT AN EMPTY LIST, IT IS A SECTION THAT VANISHES.
 * "New vendor requests" and "Pending claim" are both wrapped in
 * `rows.length > 0 ? … : null`, which is right when there is genuinely nothing
 * pending — but a REFUSED read produced the same empty array, so the entire
 * section disappeared from the page. A list saying "none" at least tells you
 * where to look; a section that is not there tells you nothing at all, and
 * couples were waiting at the other end of those invites. Both sections now
 * render when the read failed, and only hide on a measured zero.
 *
 * The claimed-vendor list stays a CARD GRID on purpose — it carries each shop's
 * logo, which is how the team identifies a shop, and cards are what that does
 * best. Only the requests table was a `<table>`, so only it becomes a
 * ConsoleTable. Converting the grid to a table would be a redesign, and the
 * defect here was never the shape.
 */
/**
 * 🪤 `logo_url` DOES NOT ALWAYS HOLD A URL. Anything uploaded through the shop
 * editor is stored as an `r2://bucket/key` reference, which a browser cannot
 * fetch — handed to <Image> it renders a broken-image glyph, throws nothing and
 * logs nothing. Both vendor lists on this surface (Pending claim + Claimed) did
 * exactly that, so the team read this console with no logos to identify shops by.
 *
 * Swallows presign failures on purpose: a logo is decoration and <Avatar> falls
 * back to the vendor's initials. Losing the whole admin list because one R2
 * signature could not be minted would be a worse outcome than no picture.
 */
async function resolveDisplayUrl(value: string | null | undefined): Promise<string | null> {
  try {
    return await displayUrlForStoredAsset(value);
  } catch {
    return null;
  }
}

export async function VendorsSurface({
  q: qRaw,
  status: statusRaw,
}: {
  q: string;
  status: string;
}) {
  const q = (qRaw ?? '').trim();
  const status = (statusRaw ?? 'all') as 'all' | 'published' | 'draft';

  const admin = createAdminClient();
  let query = admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,contact_email,public_visibility,verification_state,created_at',
    )
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(CLAIMED_ROW_LIMIT);
  // 🚨 BOTH TABS WERE KEYED ON `is_published`, which the approval flow never
  // sets — so Published was permanently EMPTY and Draft was every shop in the
  // system, including approved ones. An admin filtering to "published" saw a
  // blank list and had no reason to doubt it.
  if (status === 'published') {
    query = query.eq('public_visibility', 'verified').eq('verification_state', 'verified');
  }
  if (status === 'draft') {
    // Anything that is not both-verified. PostgREST `.or()` over the negations —
    // a shop verified on one column and not the other belongs in Draft, because
    // it is not live.
    query = query.or('public_visibility.neq.verified,verification_state.neq.verified');
  }
  if (q.length > 0) {
    // PostgREST's `.or()` parses the string as comma-separated filters
    // where each is `field.operator.value`. Raw user input would let a
    // crafted `q` (containing `,`, `(`, `)`, `:`) inject additional
    // filter clauses and read rows the search wasn't meant to match.
    // Strip the structural delimiters before interpolation — admins
    // searching by business name don't legitimately need them, and
    // `%` / `_` are still allowed so ilike wildcards behave as expected.
    const safeQ = q.replace(/[,()*\\]/g, '').slice(0, 100);
    if (safeQ.length > 0) {
      query = query.or(
        `business_name.ilike.%${safeQ}%,business_slug.ilike.%${safeQ}%,contact_email.ilike.%${safeQ}%,public_id.ilike.%${safeQ}%`,
      );
    }
  }

  // Main (claimed) vendor list + the unclaimed admin-owned vendors are
  // independent reads — one parallel batch instead of two serial round-trips
  // (owner perf pass 2026-06-03). The invite lookup below stays sequential
  // (it needs the unclaimed ids).
  const [{ data, error }, { data: unclaimedRaw, error: unclaimedError }] = await Promise.all([
    query,
    // 2026-05-21 — unclaimed admin-owned vendors (user_id NULL); their live
    // admin invite is joined below to render claim URL + expiry.
    admin
      .from('vendor_profiles')
      .select(
        'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,contact_email,public_visibility,verification_state,created_at',
      )
      .is('user_id', null)
      .order('created_at', { ascending: false })
      .limit(UNCLAIMED_ROW_LIMIT),
  ]);
  if (error) {
    logQueryError('AdminVendorsPage (vendor_profiles)', error);
  }
  if (unclaimedError) {
    logQueryError('AdminVendorsPage (unclaimed vendor_profiles)', unclaimedError);
  }
  // Both nullable to the render. `vendors === null` is "we could not read the
  // shops", which is a different sentence from "no shop matches your filter".
  const vendors = data as VendorRow[] | null;
  const unclaimedProfiles = unclaimedRaw as VendorRow[] | null;
  // The flattened copies, for the id/logo lookups that genuinely need an array.
  const listedVendors = vendors ?? [];
  const listedUnclaimed = unclaimedProfiles ?? [];

  // Fetch the matching live admin invites (status='pending', source='admin')
  // keyed by claimed_vendor_profile_id so we can show claim URL + expiry.
  const unclaimedIds = listedUnclaimed.map((v) => v.vendor_profile_id);
  const inviteByProfileId = new Map<
    string,
    { invite_id: string; claim_token: string; expires_at: string }
  >();
  // Whether the invite join was READ. A refused join left every claim link
  // missing, which renders identically to "this profile has no invite" — and the
  // claim link is the only way the vendor can ever take the profile over.
  let invitesMeasured = true;
  if (unclaimedIds.length > 0) {
    const { data: invites, error: invitesError } = await admin
      .from('vendor_invites')
      .select('invite_id, claim_token, expires_at, claimed_vendor_profile_id')
      .in('claimed_vendor_profile_id', unclaimedIds)
      .eq('status', 'pending')
      .eq('source', 'admin');
    if (invitesError) {
      logQueryError('AdminVendorsPage (admin claim invites)', invitesError);
    }
    invitesMeasured = Array.isArray(invites) && !invitesError;
    for (const inv of invites ?? []) {
      if (inv.claimed_vendor_profile_id) {
        inviteByProfileId.set(inv.claimed_vendor_profile_id, {
          invite_id: inv.invite_id,
          claim_token: inv.claim_token,
          expires_at: inv.expires_at,
        });
      }
    }
  }

  const unclaimedRows: UnclaimedVendorRow[] | null =
    unclaimedProfiles === null
      ? null
      : unclaimedProfiles.map((v) => {
          const invite = inviteByProfileId.get(v.vendor_profile_id);
          return {
            ...v,
            invite_id: invite?.invite_id ?? null,
            claim_token: invite?.claim_token ?? null,
            expires_at: invite?.expires_at ?? null,
          };
        });

  // Logos resolved ONCE per render, in one batch, before any row is drawn — the
  // row callbacks below are not async, so a stored `r2://` reference cannot be
  // turned into something fetchable inside them. Keyed by profile id; the two
  // lists are disjoint (claimed rows have a user_id, unclaimed ones do not).
  const [claimedLogos, unclaimedLogos] = await Promise.all([
    Promise.all(listedVendors.map((v) => resolveDisplayUrl(v.logo_url))),
    Promise.all(listedUnclaimed.map((v) => resolveDisplayUrl(v.logo_url))),
  ]);
  const logoByProfileId = new Map<string, string | null>();
  listedVendors.forEach((v, i) =>
    logoByProfileId.set(v.vendor_profile_id, claimedLogos[i] ?? null),
  );
  listedUnclaimed.forEach((v, i) =>
    logoByProfileId.set(v.vendor_profile_id, unclaimedLogos[i] ?? null),
  );

  // New vendor requests (owner 2026-06-09) — when a couple "Add manually"s a
  // vendor on their Shortlist, that mints a COUPLE-source claim invite. Surface
  // those pending requests here so the team can see who's being invited onto the
  // platform + nudge / reach out. Pending + couple-source only (admin-source
  // rows render in the Unclaimed section above; claimed/expired drop off).
  const { data: requestRaw, error: requestError } = await admin
    .from('vendor_invites')
    .select('invite_id, public_id, business_name, service_category, email, claim_token, sent_at, expires_at')
    .eq('source', 'couple')
    .eq('status', 'pending')
    .order('sent_at', { ascending: false })
    .limit(REQUEST_ROW_LIMIT);
  if (requestError) {
    logQueryError('AdminVendorsPage (couple vendor requests)', requestError);
  }
  type CoupleRequestRow = {
    invite_id: string;
    public_id: string | null;
    business_name: string | null;
    service_category: string | null;
    email: string | null;
    claim_token: string | null;
    sent_at: string | null;
    expires_at: string | null;
  };
  const requestRows = requestRaw as CoupleRequestRow[] | null;

  const siteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');

  return (
    <div>
      <PageMasthead
        className="mb-6"
        title="Vendors"
        lede="Vendor profiles in the database. Use this to spot incomplete profiles or to confirm contact emails (the email couples use to start a thread)."
      />

      <InviteVendorForm />

      {/* New vendor requests — couples' manual-adds awaiting a vendor claim
          (owner 2026-06-09). Each is a couple-source pending invite minted by
          the Shortlist "Add manually" flow.
          ⚖ Hidden on a MEASURED zero — an empty pending list is not news. NOT
          hidden when the read failed: that is the case where a couple is waiting
          on the other end and the section used to disappear without a trace. */}
      {requestRows === null || requestRows.length > 0 ? (
        <section className="mb-8 space-y-3">
          <header>
            <h2 className="text-base font-semibold tracking-tight">
              New vendor requests
              <span className="ml-2 rounded-full bg-warn-100 px-2 py-0.5 text-xs font-medium text-warn-900">
                {requestRows === null ? 'not measured' : requestRows.length}
              </span>
            </h2>
            <p className="text-sm text-ink/70">
              Vendors a couple added by hand on their plan — waiting for the vendor to claim the
              invite. Reach out to help them onboard.
            </p>
          </header>
          <ConsoleTable
            rows={requestRows}
            readPermitted
            readError={requestError}
            reads="the new vendor requests"
            cap={REQUEST_ROW_LIMIT}
            label="New vendor requests"
            minWidth="42rem"
            rowKey={(r) => r.invite_id}
            empty={{
              Icon: Users,
              title: 'No vendor requests waiting',
              blurb:
                'Nothing is pending a vendor claim right now. When a couple adds a supplier by hand on their plan, the invite appears here.',
              verifiedNote: 'Verified: read permitted · 0 pending requests',
            }}
            columns={[
              {
                header: 'Business',
                cell: (r) => (
                  <span className="font-medium text-ink">{r.business_name ?? '—'}</span>
                ),
              },
              {
                header: 'Category',
                hideBelow: 'md',
                cell: (r) => (
                  <span className="text-ink/70">
                    {r.service_category ? displayServiceLabel(r.service_category) : '—'}
                  </span>
                ),
              },
              {
                header: 'Contact',
                cell: (r) => <span className="text-ink/70">{r.email ?? '—'}</span>,
              },
              {
                header: 'Requested',
                hideBelow: 'md',
                mono: true,
                cell: (r) => (
                  <span className="text-ink/70">
                    {r.sent_at ? new Date(r.sent_at).toLocaleDateString('en-PH') : '—'}
                  </span>
                ),
              },
              {
                header: 'Claim link',
                align: 'right',
                cell: (r) =>
                  r.claim_token ? (
                    <Link
                      href={`${siteUrl}/vendor/claim/${r.claim_token}`}
                      className="text-mulberry hover:underline"
                      target="_blank"
                    >
                      Open
                    </Link>
                  ) : (
                    <span className="text-ink/70">—</span>
                  ),
              },
            ]}
          />
        </section>
      ) : null}

      {unclaimedRows === null ? (
        <section className="mb-8 space-y-2">
          <h2 className="text-base font-semibold tracking-tight">Pending claim</h2>
          <p className="rounded-xl border border-dashed border-warn-300/60 bg-warn-50/30 px-4 py-4 text-sm text-ink/70">
            The staged (unclaimed) vendor profiles could not be read on this load,
            so none are listed. This is <strong>not</strong> a statement that there
            are none waiting — and each one holds the claim link a vendor needs to
            take their shop over. Reload; if it repeats, the read is being refused
            rather than returning nothing.
          </p>
        </section>
      ) : null}

      {unclaimedRows !== null && unclaimedRows.length > 0 ? (
        <section className="mb-8 space-y-3">
          <header>
            <h2 className="text-base font-semibold tracking-tight">
              Pending claim · {unclaimedRows.length}
            </h2>
            <p className="text-xs text-ink/70">
              You staged these vendor profiles. They&rsquo;re unclaimed until the
              vendor signs up via their link. You can edit them like a vendor would
              and even publish them to the marketplace.
              {unclaimedRows.length >= UNCLAIMED_ROW_LIMIT ? (
                <>
                  {' '}
                  <strong>
                    Showing the first {UNCLAIMED_ROW_LIMIT} — there are more.
                  </strong>
                </>
              ) : null}
              {!invitesMeasured ? (
                <>
                  {' '}
                  <strong>
                    The claim invites could not be read on this load, so no claim
                    link is shown below even where one exists.
                  </strong>
                </>
              ) : null}
            </p>
          </header>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unclaimedRows.map((v) => {
              const claimUrl =
                v.claim_token ? `${siteUrl}/vendor/claim/${v.claim_token}` : null;
              return (
                <li
                  key={v.vendor_profile_id}
                  className="flex flex-col gap-3 rounded-xl border border-dashed border-warn-300/60 bg-warn-50/30 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        logoUrl={logoByProfileId.get(v.vendor_profile_id) ?? null}
                        name={v.business_name || 'Vendor'}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {v.business_name || 'Unnamed'}
                        </p>
                        {v.contact_email ? (
                          <p className="truncate text-[11px] text-ink/55">
                            {v.contact_email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-warn-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-warn-900">
                      Unclaimed
                    </span>
                  </div>

                  {v.location_city ? (
                    <p className="text-xs text-ink/65">📍 {v.location_city}</p>
                  ) : null}
                  {v.services.length > 0 ? (
                    <p className="text-xs text-ink/65">
                      🧰{' '}
                      {v.services.slice(0, 3).map(displayServiceLabel).join(', ')}
                      {v.services.length > 3 ? ` +${v.services.length - 3}` : ''}
                    </p>
                  ) : null}

                  {claimUrl ? (
                    <details className="rounded-md bg-white/70 p-2 text-[11px] text-ink/70 ring-1 ring-inset ring-warn-200">
                      <summary className="cursor-pointer font-medium text-ink/80">
                        Claim link
                      </summary>
                      <code className="mt-2 block break-all font-mono text-[10px] text-ink/65">
                        {claimUrl}
                      </code>
                      {v.expires_at ? (
                        <p className="mt-1 text-ink/45">
                          Expires {new Date(v.expires_at).toLocaleDateString('en-PH')}
                        </p>
                      ) : null}
                    </details>
                  ) : null}

                  <div className="mt-auto flex items-center gap-2">
                    <Link
                      href={`/admin/vendors/${v.vendor_profile_id}/edit`}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-md bg-ink/5 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-ink/10"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={2} />
                      Edit
                    </Link>
                    {v.invite_id ? (
                      <ConfirmForm
                        action={revokeAdminVendorInvite}
                        message={`Revoke this invite and delete the staged profile for "${v.business_name}"? The vendor can no longer claim via the existing link.`}
                      >
                        <input type="hidden" name="invite_id" value={v.invite_id} />
                        <SubmitButton
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-md bg-ink/5 px-2.5 py-1.5 text-xs font-medium text-ink/70 hover:bg-danger-100 hover:text-danger-900"
                          pendingLabel="Revoking…"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={2} />
                          Revoke
                        </SubmitButton>
                      </ConfirmForm>
                    ) : null}
                    {/* Was `v.is_published` — the dead column, so this badge
                        never appeared on ANY shop, however thoroughly approved. */}
                    {isShopLive(v) ? (
                      <span className="ml-auto rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-success-800">
                        Published
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <header className="mb-3">
        <h2 className="text-base font-semibold tracking-tight">
          Claimed vendors · {vendors === null ? 'not measured' : vendors.length}
        </h2>
        {vendors !== null && vendors.length >= CLAIMED_ROW_LIMIT ? (
          <p className="text-xs text-ink/70">
            Showing the first {CLAIMED_ROW_LIMIT}. There are more — this is not the
            whole list. Narrow it with the search below.
          </p>
        ) : null}
      </header>

      <form
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center"
        method="get"
        action="/admin/accounts"
      >
        <input type="hidden" name="tab" value="vendors" />
        <input
          name="q"
          defaultValue={q}
          placeholder="name · slug · email · S89B-…"
          className="input-field flex-1"
        />
        <select
          name="status"
          defaultValue={status}
          className="input-field min-w-[12rem]"
        >
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <button type="submit" className="button-secondary">Apply</button>
      </form>

      {/* ⚖ THE BANNER AND THE EMPTY CARD USED TO RENDER TOGETHER. On a refused
          read this said "Vendors couldn't load right now" AND, right underneath,
          "No vendor profiles match." — and the second sentence is the one that
          reads as an answer. The refusal is now the ONLY thing said, and it says
          what it means. This grid keeps its cards deliberately (the logo is how
          a shop is recognised), so it states the case itself instead of handing
          it to the table archetype. */}
      {vendors === null ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-300/60 bg-danger-50/60 px-4 py-4 text-sm text-danger-900"
        >
          <strong>Couldn&apos;t read the vendor profiles.</strong> Nothing loaded,
          so this is not a statement that no shop matches — it is a statement that
          we do not know. The failure is logged. Reload; if it repeats, the query
          is being refused rather than returning nothing, and the column, value or
          migration it names is the thing to check.
        </p>
      ) : (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ink/15 bg-white/50 p-8 text-center text-sm text-ink/70 sm:col-span-2 lg:col-span-3">
            No vendor profiles match.
          </li>
        ) : (
          vendors.map((v) => (
            <li
              key={v.vendor_profile_id}
              className="flex flex-col gap-3 sn-tile p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    logoUrl={logoByProfileId.get(v.vendor_profile_id) ?? null}
                    name={v.business_name || 'Vendor'}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {v.business_name || 'Unnamed'}
                    </p>
                    {v.business_slug ? (
                      <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        /v/{v.business_slug}
                      </p>
                    ) : null}
                  </div>
                </div>
                <VisibilityBadge value={parseVisibility(v.public_visibility)} />
              </div>

              {v.tagline ? (
                <p className="text-xs text-ink/65">{v.tagline}</p>
              ) : null}

              <div className="space-y-0.5 text-xs text-ink/65">
                {v.contact_email ? <p>📧 {v.contact_email}</p> : null}
                {v.location_city ? <p>📍 {v.location_city}</p> : null}
                {v.services.length > 0 ? (
                  <p>
                    🧰{' '}
                    {v.services.slice(0, 3).map(displayServiceLabel).join(', ')}
                    {v.services.length > 3 ? ` +${v.services.length - 3}` : ''}
                  </p>
                ) : null}
              </div>

              <p className="mt-auto font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                {v.public_id}
              </p>

              {/* Plan link · admin sets the vendor's subscription tier. Was
                  "Grant tokens" until the token currency was retired
                  2026-08-07; the tier form is what the page is now for, and it
                  is the ONLY way to put a vendor on Pro/Enterprise until
                  self-serve checkout lands. Only render for CLAIMED vendors. */}
              {v.user_id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/vendors/${v.vendor_profile_id}/plan`}
                    className="inline-flex w-fit items-center gap-1 rounded-md bg-orange/10 px-2 py-1 text-[11px] font-medium text-orange hover:bg-orange/15"
                  >
                    <BadgeCheck className="h-3 w-3" strokeWidth={2} />
                    Set plan
                  </Link>
                  <Link
                    href={`/admin/vendors/${v.vendor_profile_id}/team`}
                    className="inline-flex w-fit items-center gap-1 rounded-md bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-200"
                  >
                    <Users className="h-3 w-3" strokeWidth={2} />
                    Team &amp; roles
                  </Link>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
      )}
    </div>
  );
}

type VendorRow = {
  vendor_profile_id: string;
  public_id: string;
  user_id: string | null;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  contact_email: string | null;
  // `is_published` is DELIBERATELY ABSENT. It is the dead column: nothing in the
  // approval flow writes it, so the badge it used to drive said "not published"
  // about every approved shop in the system. Liveness is public_visibility +
  // verification_state, read through `isShopLive`.
  public_visibility: VendorPublicVisibility;
  verification_state: string | null;
  created_at: string;
};

type UnclaimedVendorRow = VendorRow & {
  invite_id: string | null;
  claim_token: string | null;
  expires_at: string | null;
};

function VisibilityBadge({ value }: { value: VendorPublicVisibility }) {
  const tone: Record<VendorPublicVisibility, string> = {
    coming_soon: 'bg-warn-100 text-warn-900',
    verified: 'bg-success-100 text-success-800',
    hidden: 'bg-ink/8 text-ink/65',
    archived: 'bg-ink/8 text-ink/45',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone[value]}`}
    >
      {VENDOR_PUBLIC_VISIBILITY_LABEL[value]}
    </span>
  );
}

function Avatar({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <span className="inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-white/70">
        <Image
          src={logoUrl}
          alt={`${name} logo`}
          width={40}
          height={40}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-mono text-xs font-semibold text-terracotta-700">
      {initials || '?'}
    </span>
  );
}
