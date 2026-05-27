import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Trash2, Mail, Phone, Star, ShieldOff, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORY_LABEL,
  VENDOR_STATUSES,
  VENDOR_STATUS_LABEL,
  VENDOR_STATUS_TONE,
  computeVendorStats,
  fetchEventVendors,
  formatPhp,
  type EventVendorRow,
  type VendorStatus,
} from '@/lib/vendors';
import {
  fetchLatestInvitesByVendorIds,
  pillVariantFor,
  daysLeftFor,
  INVITE_PILL_COPY,
  INVITE_PILL_TONE,
  type VendorInviteRow,
  type VendorPillVariant,
} from '@/lib/vendor-invites';
import { revokeVendorInvite } from '@/lib/vendor-invite-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { FollowGate } from '@/app/_components/follow-gate';
import {
  detectSelfReviewSignal,
  SELF_REVIEW_SIGNAL_TONE,
  type SelfReviewSignal,
} from '@/lib/self-review-gate';
import { MiniTour } from '@/app/_components/mini-tour';
import { createVendor, deleteVendor, updateVendorStatus } from './actions';
import { InviteVendorButton } from './invite-modal';
import {
  CancelBookingButton,
  DisputeLinkButton,
} from './_components/cancel-booking-button';
import { NavLinksRow } from '@/app/_components/nav-links';

export const metadata = { title: 'Vendors' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function VendorsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Per the no-cron lock (PR #47, 2026-05-14): lazy review-request emit.
  // Any vendor still in `contracted` / `deposit_paid` 24h after the event
  // date is flipped to `delivered` and a review_request notification
  // (+ Resend email when configured) is fired. The manual "mark
  // delivered" flow on the vendor card stays as the primary trigger; this
  // sweep is the safety net for couples who never get around to flipping
  // it. Idempotent — flipped rows no longer match the filter.
  await sweepRipeReviewRequests(eventId, user.id);

  const vendors = await fetchEventVendors(supabase, eventId);
  const stats = computeVendorStats(vendors);

  // 2026-05-21 — batch-fetch HQ coords for every marketplace-linked vendor
  // so each tracker row can surface Google Maps / Waze / Apple Maps nav
  // chips. Vendors without marketplace_vendor_id (off-platform couple-encoded
  // rows) or without geocoded coords just don't render the nav row.
  const marketplaceIds = vendors
    .map((v) => v.marketplace_vendor_id)
    .filter((id): id is string => Boolean(id));
  const hqCoordsByProfileId = new Map<
    string,
    { latitude: number | null; longitude: number | null; address: string | null }
  >();
  if (marketplaceIds.length > 0) {
    const { data: hqRows } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, hq_latitude, hq_longitude, hq_address, location_city')
      .in('vendor_profile_id', marketplaceIds);
    for (const row of hqRows ?? []) {
      const r = row as {
        vendor_profile_id: string;
        hq_latitude: number | null;
        hq_longitude: number | null;
        hq_address: string | null;
        location_city: string | null;
      };
      hqCoordsByProfileId.set(r.vendor_profile_id, {
        latitude: r.hq_latitude,
        longitude: r.hq_longitude,
        address: r.hq_address ?? r.location_city,
      });
    }
  }

  // Couple-invite state per vendor row (iteration 0006 § Invite-to-Setnayan
  // flow, locked 2026-05-19). Single query joined client-side; renders the
  // status pill + the "Invite to Setnayan" CTA inline on each card.
  const latestInvites = await fetchLatestInvitesByVendorIds(
    supabase,
    vendors.map((v) => v.vendor_id),
  );

  // Build a per-event_vendor "has the couple already reviewed this one?"
  // lookup. We fetch all reviews this user has posted for this event in one
  // query, then match by the same contact_email join key the review page
  // uses. Vendor rows without a profile bridge (no contact_email match) are
  // never eligible for a review CTA — handled in the link target itself.
  const { data: ownReviews } = await supabase
    .from('vendor_reviews')
    .select('vendor_profile_id, event_id')
    .eq('event_id', eventId)
    .eq('couple_user_id', user.id);

  const reviewedProfileIds = new Set(
    (ownReviews ?? []).map((r) => r.vendor_profile_id as string),
  );
  // Resolve contact_email -> vendor_profile_id so we can flag which vendor
  // cards on the tracker have already been reviewed. We only need the rows
  // that are eligible (delivered/complete) AND carry a contact_email.
  const emails = vendors
    .filter((v) => v.status === 'delivered' || v.status === 'complete')
    .map((v) => v.contact_email)
    .filter((e): e is string => !!e);
  const emailToProfileId = new Map<string, string>();
  if (emails.length > 0) {
    const { data: profiles } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, contact_email')
      .in('contact_email', emails);
    for (const p of profiles ?? []) {
      if (p.contact_email) {
        emailToProfileId.set(
          String(p.contact_email).toLowerCase(),
          p.vendor_profile_id as string,
        );
      }
    }
  }

  function isAlreadyReviewed(v: EventVendorRow): boolean {
    if (!v.contact_email) return false;
    const pid = emailToProfileId.get(v.contact_email.toLowerCase());
    return !!pid && reviewedProfileIds.has(pid);
  }

  // Iteration 0019 § Gate — for every event-vendor row whose contact_email
  // maps to a Setnayan vendor_profile_id, surface a FollowGate so the couple
  // can follow + (gated) message directly from this list. Rows without a
  // profile match (manually-tracked vendors) skip the gate row.
  const profileIds = Array.from(new Set(emailToProfileId.values()));
  let followedProfileIds = new Set<string>();
  if (profileIds.length > 0) {
    const { data: follows } = await supabase
      .from('vendor_follows')
      .select('vendor_profile_id')
      .eq('follower_user_id', user.id)
      .in('vendor_profile_id', profileIds);
    followedProfileIds = new Set((follows ?? []).map((f) => f.vendor_profile_id));
  }
  function vendorProfileForRow(v: EventVendorRow): string | null {
    if (!v.contact_email) return null;
    return emailToProfileId.get(v.contact_email.toLowerCase()) ?? null;
  }

  // Decision 1 (CLAUDE.md 2026-05-15) — § 2.2d.i Self-review block.
  // For every linked vendor profile that's review-eligible, probe the
  // self-review gate. If a signal matches, the card renders the disabled
  // CTA + appeal link instead of the regular "Leave a review" button.
  const selfReviewSignals = new Map<string, SelfReviewSignal>();
  for (const pid of profileIds) {
    const sig = await detectSelfReviewSignal(supabase, pid, user.id);
    if (sig) selfReviewSignals.set(pid, sig);
  }

  const activeFilter = (search.status ?? 'all') as 'all' | VendorStatus;
  const visible =
    activeFilter === 'all' ? vendors : vendors.filter((v) => v.status === activeFilter);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vendors</h1>
        <p className="max-w-prose text-base text-ink/65">
          Track every vendor through the 6-stage readiness flow: considering → shortlisted →
          contracted → deposit paid → delivered → complete. Costs are in PHP.
        </p>
      </header>

      <StatsStrip stats={stats} />

      <AddVendorForm eventId={eventId} />

      <StatusFilters eventId={eventId} active={activeFilter} stats={stats} />

      {visible.length === 0 ? (
        <EmptyVendors filtered={activeFilter !== 'all'} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((v) => {
            const profileId = vendorProfileForRow(v);
            const selfReviewSignal =
              profileId !== null ? (selfReviewSignals.get(profileId) ?? null) : null;
            const latestInvite = latestInvites.get(v.vendor_id) ?? null;
            const pillVariant = pillVariantFor(v.marketplace_vendor_id, latestInvite);
            return (
              <VendorCard
                key={v.vendor_id}
                eventId={eventId}
                vendor={v}
                alreadyReviewed={isAlreadyReviewed(v)}
                vendorProfileId={profileId}
                isFollowing={profileId !== null && followedProfileIds.has(profileId)}
                selfReviewSignal={selfReviewSignal}
                latestInvite={latestInvite}
                pillVariant={pillVariant}
                hqCoords={
                  v.marketplace_vendor_id
                    ? hqCoordsByProfileId.get(v.marketplace_vendor_id) ?? null
                    : null
                }
              />
            );
          })}
        </ul>
      )}
      <MiniTour tourKey="customer_vendors_v1" />
    </section>
  );
}

async function sweepRipeReviewRequests(
  eventId: string,
  coupleUserId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: ripe } = await admin
      .from('event_vendors')
      .select('vendor_id, vendor_name, events!inner(event_date)')
      .eq('event_id', eventId)
      .in('status', ['contracted', 'deposit_paid'])
      .lt('events.event_date', cutoffIso);
    const rows = (ripe ?? []) as Array<{
      vendor_id: string;
      vendor_name: string | null;
    }>;
    for (const v of rows) {
      // Race guard: `.in('status', […])` ensures a concurrent sweep doesn't
      // double-update. `.select('vendor_id')` returns only rows that this
      // query actually mutated, so we skip the notification emit if a
      // sibling render already won the race.
      const { data: updated, error: updErr } = await admin
        .from('event_vendors')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('vendor_id', v.vendor_id)
        .in('status', ['contracted', 'deposit_paid'])
        .select('vendor_id');
      if (updErr || !updated || updated.length === 0) continue;
      await emitNotification({
        userId: coupleUserId,
        type: 'review_request',
        title: `How was ${v.vendor_name ?? 'your vendor'}?`,
        body: 'Their service is marked delivered. Take a minute to leave a public review.',
        relatedUrl: `/dashboard/${eventId}/vendors/${v.vendor_id}/review`,
      });
    }
  } catch (e) {
    console.error('[reviews] ripe-review sweep failed:', e);
  }
}

function StatsStrip({
  stats,
}: {
  stats: { count: number; totalCost: number; depositPaid: number; remaining: number };
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Vendors" value={String(stats.count)} />
      <StatTile label="Total cost" value={formatPhp(stats.totalCost)} />
      <StatTile label="Deposits paid" value={formatPhp(stats.depositPaid)} />
      <StatTile
        label="Remaining"
        value={formatPhp(stats.remaining)}
        tone={stats.remaining > 0 ? 'warn' : 'default'}
      />
    </ul>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <li className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tracking-tight ${
          tone === 'warn' ? 'text-terracotta-700' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </li>
  );
}

function AddVendorForm({ eventId }: { eventId: string }) {
  return (
    <details className="rounded-xl border border-ink/10 bg-cream">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
        <Plus aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Add a vendor
      </summary>
      <form action={createVendor} className="space-y-4 border-t border-ink/10 p-4">
        <input type="hidden" name="event_id" value={eventId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vendor name" htmlFor="vendor_name">
            <input
              id="vendor_name"
              name="vendor_name"
              required
              maxLength={128}
              placeholder="e.g. Bistro Ramos"
              className="input-field"
            />
          </Field>
          <Field label="Category" htmlFor="category">
            <select
              id="category"
              name="category"
              defaultValue="catering"
              className="input-field"
            >
              {SERVICE_GROUPS.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  {g.members.map((c) => (
                    <option key={c} value={c}>
                      {VENDOR_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Email" htmlFor="contact_email">
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              className="input-field"
              placeholder="hello@vendor.ph"
            />
          </Field>
          <Field label="Phone" htmlFor="contact_phone">
            <input
              id="contact_phone"
              name="contact_phone"
              className="input-field"
              placeholder="+63 917 …"
            />
          </Field>
          <Field label="Total cost (PHP)" htmlFor="total_cost_php">
            <input
              id="total_cost_php"
              name="total_cost_php"
              type="number"
              min={0}
              step="0.01"
              className="input-field"
              placeholder="0"
            />
          </Field>
          <Field label="Deposit paid (PHP)" htmlFor="deposit_paid_php">
            <input
              id="deposit_paid_php"
              name="deposit_paid_php"
              type="number"
              min={0}
              step="0.01"
              className="input-field"
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="input-field min-h-[80px] py-2"
            placeholder="Inclusions, follow-ups, contract dates…"
          />
        </Field>
        <SubmitButton className="button-primary" pendingLabel="Adding…">
          Add vendor
        </SubmitButton>
      </form>
    </details>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusFilters({
  eventId,
  active,
  stats,
}: {
  eventId: string;
  active: 'all' | VendorStatus;
  stats: { count: number; byStatus: Partial<Record<VendorStatus, number>> };
}) {
  return (
    <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
      <FilterChip
        eventId={eventId}
        statusKey="all"
        label="All"
        count={stats.count}
        active={active === 'all'}
      />
      {VENDOR_STATUSES.map((s) => (
        <FilterChip
          key={s}
          eventId={eventId}
          statusKey={s}
          label={VENDOR_STATUS_LABEL[s]}
          count={stats.byStatus[s] ?? 0}
          active={active === s}
        />
      ))}
    </nav>
  );
}

function FilterChip({
  eventId,
  statusKey,
  label,
  count,
  active,
}: {
  eventId: string;
  statusKey: 'all' | VendorStatus;
  label: string;
  count: number;
  active: boolean;
}) {
  const href =
    statusKey === 'all'
      ? `/dashboard/${eventId}/vendors`
      : `/dashboard/${eventId}/vendors?status=${statusKey}`;
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-terracotta text-cream' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] ${
          active ? 'bg-cream/20 text-cream' : 'bg-ink/5 text-ink/55'
        }`}
      >
        {count}
      </span>
    </a>
  );
}

function EmptyVendors({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
      {filtered
        ? 'No vendors in this status. Switch filter to All to see everyone.'
        : 'No vendors yet — open the Add a vendor section above to track your first one.'}
    </div>
  );
}

function VendorCard({
  eventId,
  vendor,
  alreadyReviewed,
  vendorProfileId,
  isFollowing,
  selfReviewSignal,
  latestInvite,
  pillVariant,
  hqCoords,
}: {
  eventId: string;
  vendor: EventVendorRow;
  alreadyReviewed: boolean;
  vendorProfileId: string | null;
  isFollowing: boolean;
  selfReviewSignal: SelfReviewSignal | null;
  latestInvite: VendorInviteRow | null;
  pillVariant: VendorPillVariant;
  hqCoords: {
    latitude: number | null;
    longitude: number | null;
    address: string | null;
  } | null;
}) {
  const remaining =
    vendor.total_cost_php !== null
      ? Number(vendor.total_cost_php) - Number(vendor.deposit_paid_php ?? 0)
      : null;
  const daysLeft = latestInvite ? daysLeftFor(latestInvite) : null;
  // Show the "Invite to Setnayan" CTA when the vendor row is off-platform
  // (no marketplace_vendor_id), there's no email-soft-link to an existing
  // vendor_profile, and no invite is currently pending. Other states
  // (declined / expired / revoked) still get the CTA so the couple can
  // resend after the lifecycle hits a terminal state.
  const canInvite =
    vendor.marketplace_vendor_id === null &&
    vendorProfileId === null &&
    (latestInvite === null || latestInvite.status !== 'pending');
  const reviewEligible =
    (vendor.status === 'delivered' || vendor.status === 'complete') && !alreadyReviewed;
  const isSoftBlock =
    selfReviewSignal !== null && SELF_REVIEW_SIGNAL_TONE[selfReviewSignal] === 'soft';

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-base font-semibold text-ink">{vendor.vendor_name}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {VENDOR_CATEGORY_LABEL[vendor.category]}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
            VENDOR_STATUS_TONE[vendor.status]
          }`}
        >
          {VENDOR_STATUS_LABEL[vendor.status]}
        </span>
      </div>

      {vendor.contact_email || vendor.contact_phone ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/65">
          {vendor.contact_email ? (
            <a
              href={`mailto:${vendor.contact_email}`}
              className="inline-flex items-center gap-1 hover:text-terracotta"
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
              {vendor.contact_email}
            </a>
          ) : null}
          {vendor.contact_phone ? (
            <a
              href={`tel:${vendor.contact_phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1 hover:text-terracotta"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
              {vendor.contact_phone}
            </a>
          ) : null}
        </div>
      ) : null}

      {hqCoords && (hqCoords.latitude !== null || hqCoords.address) ? (
        <NavLinksRow
          latitude={hqCoords.latitude}
          longitude={hqCoords.longitude}
          addressFallback={hqCoords.address}
          label="Directions"
          compact
        />
      ) : null}

      {vendor.total_cost_php !== null ? (
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <Money label="Total" value={formatPhp(vendor.total_cost_php)} />
          <Money
            label="Deposit"
            value={formatPhp(vendor.deposit_paid_php ?? 0)}
            tone="muted"
          />
          <Money
            label="Remaining"
            value={formatPhp(remaining ?? 0)}
            tone={remaining && remaining > 0 ? 'warn' : 'good'}
          />
        </dl>
      ) : null}

      {vendor.notes ? (
        <p className="rounded-md bg-ink/[0.03] p-2 text-xs text-ink/75">{vendor.notes}</p>
      ) : null}

      {/* Off-platform invite state — pill + actions. Hidden when the vendor
          row has an explicit marketplace link (showing the Joined pill in
          that case would duplicate the FollowGate's own state). */}
      {vendor.marketplace_vendor_id === null && vendorProfileId === null ? (
        <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${INVITE_PILL_TONE[pillVariant]}`}
            >
              {pillVariant === 'on_platform' ? (
                <Sparkles className="h-3 w-3" strokeWidth={1.75} />
              ) : null}
              {INVITE_PILL_COPY[pillVariant]}
            </span>
            {latestInvite?.status === 'pending' && daysLeft !== null ? (
              <span className="text-ink/55">{daysLeft}d left</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {latestInvite?.status === 'pending' ? (
              <form action={revokeVendorInvite}>
                <input type="hidden" name="invite_id" value={latestInvite.invite_id} />
                <input type="hidden" name="event_id" value={eventId} />
                <SubmitButton
                  className="text-[11px] font-medium text-ink/55 hover:text-rose-700"
                  pendingLabel="…"
                >
                  Revoke
                </SubmitButton>
              </form>
            ) : null}
            {canInvite ? (
              <InviteVendorButton
                vendorId={vendor.vendor_id}
                eventId={eventId}
                vendorName={vendor.vendor_name}
                defaultEmail={vendor.contact_email}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {vendorProfileId ? (
        <FollowGate
          vendorProfileId={vendorProfileId}
          vendorName={vendor.vendor_name}
          vendorEmail={vendor.contact_email}
          isAuthenticated={true}
          initialFollowing={isFollowing}
          eventId={eventId}
          revalidatePath={`/dashboard/${eventId}/vendors`}
          variant="card"
        />
      ) : null}

      {reviewEligible && selfReviewSignal === null ? (
        <Link
          href={`/dashboard/${eventId}/vendors/${vendor.vendor_id}/review`}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-300 transition-colors hover:bg-amber-100"
        >
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" strokeWidth={1.75} />
          Leave a review
        </Link>
      ) : null}

      {reviewEligible && selfReviewSignal !== null ? (
        // Decision 1 (2026-05-15) — § 2.2d.i disabled CTA + appeal sub-link.
        <div className="space-y-1.5">
          <span
            aria-disabled="true"
            title="You can't review your own services"
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md bg-ink/5 px-3 py-2 text-xs font-medium text-ink/45 ring-1 ring-inset ring-ink/10"
          >
            <ShieldOff className="h-3.5 w-3.5" strokeWidth={1.75} />
            You can&rsquo;t review your own services
          </span>
          {isSoftBlock ? (
            <Link
              href={`/dashboard/${eventId}/vendors/${vendor.vendor_id}/review`}
              className="block text-center text-[11px] font-medium text-terracotta hover:underline"
            >
              Appeal this block →
            </Link>
          ) : null}
        </div>
      ) : null}

      {alreadyReviewed ? (
        <p className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-600" strokeWidth={1.75} />
          Review posted
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-ink/10 pt-3">
        <form action={updateVendorStatus} className="flex items-center gap-2">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="vendor_id" value={vendor.vendor_id} />
          <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Status
          </label>
          <select
            name="status"
            defaultValue={vendor.status}
            className="input-field h-9 py-0 text-xs"
          >
            {VENDOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VENDOR_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <SubmitButton
            className="rounded-md bg-ink/[0.05] px-2 py-1 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
            pendingLabel="…"
          >
            Update
          </SubmitButton>
        </form>
        {/* Status-aware destructive affordance per CLAUDE.md 2026-05-24
         *  "Lock/delete/overlap architecture" Rule 1:
         *    considering / shortlisted → Trash2 + deleteVendor (silent)
         *    contracted (no deposit)   → CancelBookingButton (modal +
         *                                   vendor notification)
         *    deposit_paid / delivered / complete OR deposit_paid_php > 0
         *                              → DisputeLinkButton (routes to
         *                                   /dashboard/[eventId]/disputes) */}
        {(() => {
          const depositValue =
            typeof vendor.deposit_paid_php === 'string'
              ? Number(vendor.deposit_paid_php)
              : (vendor.deposit_paid_php ?? null);
          const hasDeposit =
            depositValue !== null &&
            Number.isFinite(depositValue) &&
            depositValue > 0;
          const downpaid =
            vendor.status === 'deposit_paid' ||
            vendor.status === 'delivered' ||
            vendor.status === 'complete';
          if (downpaid || hasDeposit) {
            return <DisputeLinkButton eventId={eventId} variant="pill" />;
          }
          if (vendor.status === 'contracted') {
            return (
              <CancelBookingButton
                eventId={eventId}
                vendorId={vendor.vendor_id}
                vendorName={vendor.vendor_name}
                variant="pill"
              />
            );
          }
          // `considering` / `shortlisted` — no commitment, no vendor
          // notification needed. Keep the blunt deleteVendor path.
          return (
            <form action={deleteVendor}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="vendor_id" value={vendor.vendor_id} />
              <SubmitButton
                aria-label="Delete vendor"
                pendingLabel=""
                className="rounded-md p-1.5 text-ink/40 hover:bg-ink/5 hover:text-rose-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </SubmitButton>
            </form>
          );
        })()}
      </div>
    </li>
  );
}

function Money({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'warn' | 'good';
}) {
  return (
    <div className="rounded-md bg-ink/[0.03] p-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-semibold ${
          tone === 'warn'
            ? 'text-terracotta-700'
            : tone === 'good'
              ? 'text-emerald-700'
              : tone === 'muted'
                ? 'text-ink/65'
                : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
