import Link from 'next/link';
import Image from 'next/image';
import { Pencil, Trash2, Coins } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayServiceLabel } from '@/lib/vendors';
import {
  VENDOR_PUBLIC_VISIBILITY_LABEL,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { InviteVendorForm } from './_components/invite-vendor-form';
import { revokeAdminVendorInvite } from './actions';

export const metadata = { title: 'Vendors · Admin' };

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
  is_published: boolean;
  public_visibility: VendorPublicVisibility;
  created_at: string;
};

type UnclaimedVendorRow = VendorRow & {
  invite_id: string | null;
  claim_token: string | null;
  expires_at: string | null;
};

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function AdminVendorsPage({ searchParams }: Props) {
  const search = await searchParams;
  const q = (search.q ?? '').trim();
  const status = (search.status ?? 'all') as 'all' | 'published' | 'draft';

  const admin = createAdminClient();
  let query = admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,contact_email,is_published,public_visibility,created_at',
    )
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status === 'published') query = query.eq('is_published', true);
  if (status === 'draft') query = query.eq('is_published', false);
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
  const [{ data, error }, { data: unclaimedRaw }] = await Promise.all([
    query,
    // 2026-05-21 — unclaimed admin-owned vendors (user_id NULL); their live
    // admin invite is joined below to render claim URL + expiry.
    admin
      .from('vendor_profiles')
      .select(
        'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,contact_email,is_published,public_visibility,created_at',
      )
      .is('user_id', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  if (error) {
    logQueryError('AdminVendorsPage (vendor_profiles)', error);
  }
  const vendors = (data ?? []) as VendorRow[];
  const unclaimedProfiles = (unclaimedRaw ?? []) as VendorRow[];

  // Fetch the matching live admin invites (status='pending', source='admin')
  // keyed by claimed_vendor_profile_id so we can show claim URL + expiry.
  const unclaimedIds = unclaimedProfiles.map((v) => v.vendor_profile_id);
  const inviteByProfileId = new Map<
    string,
    { invite_id: string; claim_token: string; expires_at: string }
  >();
  if (unclaimedIds.length > 0) {
    const { data: invites } = await admin
      .from('vendor_invites')
      .select('invite_id, claim_token, expires_at, claimed_vendor_profile_id')
      .in('claimed_vendor_profile_id', unclaimedIds)
      .eq('status', 'pending')
      .eq('source', 'admin');
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

  const unclaimedRows: UnclaimedVendorRow[] = unclaimedProfiles.map((v) => {
    const invite = inviteByProfileId.get(v.vendor_profile_id);
    return {
      ...v,
      invite_id: invite?.invite_id ?? null,
      claim_token: invite?.claim_token ?? null,
      expires_at: invite?.expires_at ?? null,
    };
  });

  // New vendor requests (owner 2026-06-09) — when a couple "Add manually"s a
  // vendor on their Shortlist, that mints a COUPLE-source claim invite. Surface
  // those pending requests here so the team can see who's being invited onto the
  // platform + nudge / reach out. Pending + couple-source only (admin-source
  // rows render in the Unclaimed section above; claimed/expired drop off).
  const { data: requestRaw } = await admin
    .from('vendor_invites')
    .select('invite_id, public_id, business_name, service_category, email, claim_token, sent_at, expires_at')
    .eq('source', 'couple')
    .eq('status', 'pending')
    .order('sent_at', { ascending: false })
    .limit(50);
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
  const requestRows = (requestRaw ?? []) as CoupleRequestRow[];

  const siteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
        <p className="text-sm text-ink/60">
          Vendor profiles in the database. Use this to spot incomplete profiles or to confirm
          contact emails (the email couples use to start a thread).
        </p>
      </header>

      <InviteVendorForm />

      {/* New vendor requests — couples' manual-adds awaiting a vendor claim
          (owner 2026-06-09). Each is a couple-source pending invite minted by
          the Shortlist "Add manually" flow. Hidden when there are none. */}
      {requestRows.length > 0 ? (
        <section className="mb-8 space-y-3">
          <header>
            <h2 className="text-base font-semibold tracking-tight">
              New vendor requests
              <span className="ml-2 rounded-full bg-warn-100 px-2 py-0.5 text-xs font-medium text-warn-900">
                {requestRows.length}
              </span>
            </h2>
            <p className="text-sm text-ink/60">
              Vendors a couple added by hand on their plan — waiting for the vendor to claim the
              invite. Reach out to help them onboard.
            </p>
          </header>
          <div className="overflow-hidden rounded-xl border border-ink/10">
            <table className="w-full text-sm">
              <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-wide text-ink/55">
                <tr>
                  <th className="px-4 py-2 font-medium">Business</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 font-medium">Requested</th>
                  <th className="px-4 py-2 font-medium">Claim link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {requestRows.map((r) => (
                  <tr key={r.invite_id}>
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {r.business_name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-ink/70">
                      {r.service_category ? displayServiceLabel(r.service_category) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-ink/70">{r.email ?? '—'}</td>
                    <td className="px-4 py-2.5 text-ink/55">
                      {r.sent_at ? new Date(r.sent_at).toLocaleDateString('en-PH') : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.claim_token ? (
                        <Link
                          href={`${siteUrl}/vendor/claim/${r.claim_token}`}
                          className="text-mulberry hover:underline"
                          target="_blank"
                        >
                          Open
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {unclaimedRows.length > 0 ? (
        <section className="mb-8 space-y-3">
          <header>
            <h2 className="text-base font-semibold tracking-tight">
              Pending claim · {unclaimedRows.length}
            </h2>
            <p className="text-xs text-ink/55">
              You staged these vendor profiles. They&rsquo;re unclaimed until the
              vendor signs up via their link. You can edit them like a vendor would
              and even publish them to the marketplace.
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
                      <Avatar logoUrl={v.logo_url} name={v.business_name || 'Vendor'} />
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
                    <details className="rounded-md bg-cream/70 p-2 text-[11px] text-ink/70 ring-1 ring-inset ring-warn-200">
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
                    {v.is_published ? (
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
          Claimed vendors · {vendors.length}
        </h2>
      </header>

      <form className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center" method="get">
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

      {error ? (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          Vendors couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment or check Sentry for the full detail.
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55 sm:col-span-2 lg:col-span-3">
            No vendor profiles match.
          </li>
        ) : (
          vendors.map((v) => (
            <li
              key={v.vendor_profile_id}
              className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar logoUrl={v.logo_url} name={v.business_name || 'Vendor'} />
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

              {/* Token grant link · admin can credit this vendor's wallet.
                  Migration 20260703500000 + actions.ts grantTokensToVendor.
                  Only render for CLAIMED vendors — unclaimed ones don't
                  have wallets yet (founder-bonus trigger fires on
                  verification which requires a claimed user_id). */}
              {v.user_id ? (
                <Link
                  href={`/admin/vendors/${v.vendor_profile_id}/tokens`}
                  className="inline-flex w-fit items-center gap-1 rounded-md bg-orange/10 px-2 py-1 text-[11px] font-medium text-orange hover:bg-orange/15"
                >
                  <Coins className="h-3 w-3" strokeWidth={2} />
                  Grant tokens
                </Link>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

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
      <span className="inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-cream">
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
