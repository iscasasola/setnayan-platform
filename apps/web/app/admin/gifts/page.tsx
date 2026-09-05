import Link from 'next/link';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { issueCompGrant, revokeCompGrant } from '@/app/admin/users/actions';
import { setVendorTier } from '@/app/admin/vendors/actions';
import {
  fetchAllActiveCompGrants,
  fetchEventsHostedBy,
  formatRetailValueCentavos,
  describeScope,
  describeSource,
  type CompGrantRow,
} from '@/lib/comp-grants';
import { fetchCompedVendors, type CompedVendorRow } from '@/lib/vendor-tier-comps';
import { VENDOR_TIERS, TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';

export const metadata = {
  title: 'Gifts · Admin',
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{
    vendor_q?: string;
    user_q?: string;
    grant_vendor?: string;
    grant_user?: string;
    banner?: string;
  }>;
};

/**
 * /admin/gifts — everything currently comped, for a vendor or a user, in one
 * place. v1 scope (owner-picked 2026-09-04): list + grant a SINGLE named
 * target. No cohort/date-window targeting yet — that needs
 * `promo_free_windows` (still flag-gated off) and a still-unbuilt
 * registration-window trigger for vendors.
 *
 * Deliberately reuses the EXISTING write paths rather than inventing a third:
 *   - Vendor comps write through `setVendorTier` (tier only — comp_grants
 *     explicitly excludes vendors, see its own docblock in admin/users/actions.ts).
 *   - User/event comps write through `issueCompGrant` / `revokeCompGrant`
 *     (comp_grants is scoped to a USER account, not to one specific event —
 *     there is no event_id column on the table. A comp reaches every event
 *     that user owns, not one.).
 *
 * This page is the READ-side union of those two writers plus a lightweight
 * search-and-select flow to reach either grant form without already knowing
 * the target's ID.
 */
export default async function AdminGiftsPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createAdminClient();

  const [compedVendors, activeGrants] = await Promise.all([
    fetchCompedVendors(admin),
    fetchAllActiveCompGrants(admin),
  ]);

  // Resolve display info for every user_id on an active grant, one query.
  const userIds = Array.from(
    new Set(activeGrants.map((g) => g.user_id).filter((id): id is string => !!id)),
  );
  const { data: grantUsers } = userIds.length
    ? await admin.from('users').select('user_id, email, display_name').in('user_id', userIds)
    : { data: [] as { user_id: string; email: string | null; display_name: string | null }[] };
  const userById = new Map((grantUsers ?? []).map((u) => [u.user_id, u]));

  // ── Vendor search + selection ──────────────────────────────────────────
  const vendorQuery = sp.vendor_q?.trim() ?? '';
  let vendorResults: { vendor_profile_id: string; public_id: string; business_name: string }[] = [];
  if (vendorQuery.length >= 2) {
    const { data } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, public_id, business_name')
      .ilike('business_name', `%${vendorQuery}%`)
      .order('business_name', { ascending: true })
      .limit(8);
    vendorResults = data ?? [];
  }
  let grantVendor: { vendor_profile_id: string; public_id: string; business_name: string; tier_state: string; tier_expires_at: string | null } | null = null;
  if (sp.grant_vendor) {
    const { data } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, public_id, business_name, tier_state, tier_expires_at')
      .eq('vendor_profile_id', sp.grant_vendor)
      .maybeSingle();
    grantVendor = data ?? null;
  }

  // ── User search + selection ────────────────────────────────────────────
  const userQuery = sp.user_q?.trim() ?? '';
  let userResults: { user_id: string; email: string | null; display_name: string | null }[] = [];
  if (userQuery.length >= 2) {
    const { data } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .or(`email.ilike.%${userQuery}%,display_name.ilike.%${userQuery}%`)
      .limit(8);
    userResults = data ?? [];
  }
  let grantUser: { user_id: string; email: string | null; display_name: string | null } | null = null;
  let grantUserEvents: Awaited<ReturnType<typeof fetchEventsHostedBy>> = [];
  if (sp.grant_user) {
    const { data } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .eq('user_id', sp.grant_user)
      .maybeSingle();
    grantUser = data ?? null;
    if (grantUser) {
      grantUserEvents = await fetchEventsHostedBy(admin, grantUser.user_id);
    }
  }

  // Resolve display names for every event a listed grant is scoped to.
  const grantEventIds = Array.from(
    new Set(activeGrants.map((g) => g.event_id).filter((id): id is string => !!id)),
  );
  const { data: grantEventsData } = grantEventIds.length
    ? await admin.from('events').select('event_id, display_name').in('event_id', grantEventIds)
    : { data: [] as { event_id: string; display_name: string }[] };
  const eventNameById = new Map((grantEventsData ?? []).map((e) => [e.event_id, e.display_name]));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMasthead titleNode="Gifts" />
      <div className="mb-6 space-y-1">
        <p className="text-2xl font-semibold tracking-tight">Gifts</p>
        <p className="text-sm text-ink/60">
          Every vendor tier comp and user/event comp currently active, in one place. Grants a single
          named vendor, or a user account either across every event they host or scoped to one
          specific event — cohort and date-window promos aren&rsquo;t built yet.
        </p>
      </div>

      {sp.banner && (
        <div className="mb-6 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ {sp.banner}
        </div>
      )}

      {/* ══════════════════ VENDOR SIDE ══════════════════ */}
      <section className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Vendor tier comps
        </h2>

        <form className="mb-4 flex gap-2" action="/admin/gifts">
          <input
            type="text"
            name="vendor_q"
            defaultValue={vendorQuery}
            placeholder="Search vendors by business name…"
            className="flex-1 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
          />
          <SubmitButton className="button-secondary h-10 px-4 text-sm" overlay={false}>
            Search
          </SubmitButton>
        </form>

        {vendorResults.length > 0 && !grantVendor && (
          <ul className="mb-4 divide-y divide-ink/10 rounded-md border border-ink/10">
            {vendorResults.map((v) => (
              <li key={v.vendor_profile_id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {v.business_name} <span className="font-mono text-xs text-ink/50">{v.public_id}</span>
                </span>
                <Link
                  href={`/admin/gifts?grant_vendor=${v.vendor_profile_id}`}
                  className="text-xs font-medium text-link hover:underline"
                >
                  Comp this vendor
                </Link>
              </li>
            ))}
          </ul>
        )}
        {vendorQuery.length >= 2 && vendorResults.length === 0 && !grantVendor && (
          <p className="mb-4 text-xs text-ink/50">No vendors match &ldquo;{vendorQuery}&rdquo;.</p>
        )}

        {grantVendor && (
          <div className="mb-4 rounded-md border border-ink/10 bg-paper p-4">
            <p className="mb-3 text-sm">
              Comping <strong>{grantVendor.business_name}</strong> — current tier:{' '}
              <span className="font-medium">{TIER_LABEL[asVendorTier(grantVendor.tier_state)]}</span>.{' '}
              <Link href="/admin/gifts" className="text-link hover:underline">
                Cancel
              </Link>
            </p>
            <form action={setVendorTier} className="space-y-3">
              <input type="hidden" name="vendor_id" value={grantVendor.vendor_profile_id} />
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="tier_state" className="block text-xs font-medium text-ink/70 mb-1">
                    Tier
                  </label>
                  <select
                    id="tier_state"
                    name="tier_state"
                    defaultValue={asVendorTier(grantVendor.tier_state)}
                    className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  >
                    {VENDOR_TIERS.map((t) => (
                      <option key={t} value={t}>
                        {TIER_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tier_expires_at" className="block text-xs font-medium text-ink/70 mb-1">
                    Ends <span className="text-ink/50">(optional)</span>
                  </label>
                  <input
                    type="date"
                    id="tier_expires_at"
                    name="tier_expires_at"
                    className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="reason" className="block text-xs font-medium text-ink/70 mb-1">
                  Reason <span className="text-ink/50">(logged, min. 10 characters)</span>
                </label>
                <input
                  type="text"
                  id="reason"
                  name="reason"
                  placeholder="e.g. Founding cohort — verified before Oct 15"
                  className="w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                />
              </div>
              <SubmitButton className="button-secondary h-10 px-4 text-sm" pendingLabel="Saving…">
                Set tier
              </SubmitButton>
            </form>
          </div>
        )}

        {compedVendors.length === 0 ? (
          <p className="text-sm text-ink/50">No vendor is currently comped onto a paid tier.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="py-2 pr-2">Vendor</th>
                <th className="py-2 pr-2">Tier</th>
                <th className="py-2 pr-2">Ends</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {compedVendors.map((v: CompedVendorRow) => (
                <tr key={v.vendor_profile_id} className="border-b border-ink/5">
                  <td className="py-2 pr-2">{v.business_name}</td>
                  <td className="py-2 pr-2">{TIER_LABEL[v.tier_state]}</td>
                  <td className="py-2 pr-2 font-mono text-xs">
                    {v.tier_expires_at
                      ? new Date(v.tier_expires_at).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Open-ended'}
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/vendors/${v.vendor_profile_id}/plan`}
                      className="text-xs font-medium text-link hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-ink/40">
          Every non-free tier here is a comp — self-serve vendor billing doesn&rsquo;t exist yet.
        </p>
      </section>

      {/* ══════════════════ USER SIDE ══════════════════ */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          User &amp; event comps
        </h2>

        <form className="mb-4 flex gap-2" action="/admin/gifts">
          <input
            type="text"
            name="user_q"
            defaultValue={userQuery}
            placeholder="Search users by name or email…"
            className="flex-1 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
          />
          <SubmitButton className="button-secondary h-10 px-4 text-sm" overlay={false}>
            Search
          </SubmitButton>
        </form>

        {userResults.length > 0 && !grantUser && (
          <ul className="mb-4 divide-y divide-ink/10 rounded-md border border-ink/10">
            {userResults.map((u) => (
              <li key={u.user_id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{u.display_name ?? u.email ?? u.user_id}</span>
                <Link
                  href={`/admin/gifts?grant_user=${u.user_id}`}
                  className="text-xs font-medium text-link hover:underline"
                >
                  Comp this user
                </Link>
              </li>
            ))}
          </ul>
        )}
        {userQuery.length >= 2 && userResults.length === 0 && !grantUser && (
          <p className="mb-4 text-xs text-ink/50">No user matches &ldquo;{userQuery}&rdquo;.</p>
        )}

        {grantUser && (
          <div className="mb-4 rounded-md border border-ink/10 bg-paper p-4">
            <p className="mb-3 text-sm">
              Comping <strong>{grantUser.display_name ?? grantUser.email ?? grantUser.user_id}</strong>.{' '}
              <Link href="/admin/gifts" className="text-link hover:underline">
                Cancel
              </Link>
            </p>
            <form action={issueCompGrant} className="space-y-3">
              <input type="hidden" name="user_id" value={grantUser.user_id} />
              <div>
                <label htmlFor="event_id" className="block text-xs font-medium text-ink/70 mb-1">
                  Applies to
                </label>
                {grantUserEvents.length === 0 ? (
                  <p className="text-xs text-ink/50">
                    This account hosts no events yet — the comp will apply account-wide, to whichever
                    event they create next.
                  </p>
                ) : (
                  <select
                    id="event_id"
                    name="event_id"
                    defaultValue=""
                    className="w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  >
                    <option value="">Every event this account hosts</option>
                    {grantUserEvents.map((e) => (
                      <option key={e.event_id} value={e.event_id}>
                        {e.display_name} ({e.event_type}
                        {e.event_date
                          ? `, ${new Date(e.event_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}`
                          : ''}
                        )
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium text-ink/70">Scope</span>
                <label className="mr-4 text-sm">
                  <input type="radio" name="scope" value="all_services" defaultChecked /> All services
                </label>
                <label className="text-sm">
                  <input type="radio" name="scope" value="specific_skus" /> Specific services (comma-separated SKUs below)
                </label>
              </div>
              <div>
                <label htmlFor="scoped_skus" className="block text-xs font-medium text-ink/70 mb-1">
                  SKUs <span className="text-ink/50">(only used when scope is specific services)</span>
                </label>
                <input
                  type="text"
                  id="scoped_skus"
                  name="scoped_skus"
                  placeholder="e.g. PAPIC_ONE_50, SEATING_3D"
                  className="w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label htmlFor="expiry_at" className="block text-xs font-medium text-ink/70 mb-1">
                    Expires <span className="text-ink/50">(optional, blank = lifetime)</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="expiry_at"
                    name="expiry_at"
                    className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="retail_value_php" className="block text-xs font-medium text-ink/70 mb-1">
                    Retail value, ₱ <span className="text-ink/50">(optional)</span>
                  </label>
                  <input
                    type="number"
                    id="retail_value_php"
                    name="retail_value_php"
                    min={0}
                    className="w-32 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="rationale" className="block text-xs font-medium text-ink/70 mb-1">
                  Rationale <span className="text-ink/50">(logged, min. 20 characters)</span>
                </label>
                <textarea
                  id="rationale"
                  name="rationale"
                  rows={2}
                  placeholder="Why this account, why this scope, who approved it."
                  className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                />
              </div>
              <SubmitButton className="button-secondary h-10 px-4 text-sm" pendingLabel="Saving…">
                Issue comp
              </SubmitButton>
            </form>
          </div>
        )}

        {activeGrants.length === 0 ? (
          <p className="text-sm text-ink/50">No user is currently comped.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="py-2 pr-2">User</th>
                <th className="py-2 pr-2">Applies to</th>
                <th className="py-2 pr-2">Covers</th>
                <th className="py-2 pr-2">Value</th>
                <th className="py-2 pr-2">Ends</th>
                <th className="py-2 pr-2">Source</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {activeGrants.map((g: CompGrantRow) => {
                const u = g.user_id ? userById.get(g.user_id) : null;
                return (
                  <tr key={g.grant_id} className="border-b border-ink/5 align-top">
                    <td className="py-2 pr-2">{u?.display_name ?? u?.email ?? g.user_id ?? '—'}</td>
                    <td className="py-2 pr-2">
                      {g.event_id ? (eventNameById.get(g.event_id) ?? 'One event (deleted?)') : 'Every event they host'}
                    </td>
                    <td className="py-2 pr-2">{describeScope(g.scope, g.scoped_skus)}</td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {formatRetailValueCentavos(g.retail_value_centavos)}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {g.expiry
                        ? new Date(g.expiry).toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Lifetime'}
                    </td>
                    <td className="py-2 pr-2 text-xs">{describeSource(g.source)}</td>
                    <td className="py-2 text-right">
                      <form action={revokeCompGrant} className="inline-flex items-center gap-1">
                        <input type="hidden" name="grant_id" value={g.grant_id} />
                        <input
                          type="text"
                          name="reason"
                          placeholder="Revoke reason…"
                          required
                          minLength={10}
                          className="w-32 rounded-md border border-ink/15 bg-paper px-2 py-1 text-xs"
                        />
                        <SubmitButton
                          className="text-xs font-medium text-mulberry hover:underline"
                          overlay={false}
                          pendingLabel="…"
                        >
                          Revoke
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
