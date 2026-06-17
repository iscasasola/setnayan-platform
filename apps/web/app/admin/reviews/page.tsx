import Link from 'next/link';
import { Flag, Gavel, ShieldOff } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  SELF_REVIEW_SIGNAL_LABEL,
  SELF_REVIEW_SIGNAL_TONE,
  type SelfReviewSignal,
} from '@/lib/self-review-gate';
import {
  escalateAppeal,
  overridePublishReview,
  rejectAppeal,
  dismissReviewFlag,
} from './actions';

export const metadata = { title: 'Reviews · Admin' };

type AppealRow = {
  appeal_id: string;
  vendor_profile_id: string;
  reviewer_user_id: string;
  event_id: string;
  event_vendor_id: string | null;
  matched_signal: SelfReviewSignal;
  review_payload: Record<string, unknown> | null;
  appeal_reason: string;
  submitted_at: string;
  decided_at: string | null;
  decided_by_admin: string | null;
  decision: 'override_published' | 'rejected' | 'escalated' | null;
  decision_reason: string | null;
};

type FlaggedReviewRow = {
  review_id: string;
  public_id: string;
  vendor_profile_id: string;
  couple_user_id: string | null;
  rating_overall: number;
  body: string | null;
  created_at: string;
  override_admin_id: string | null;
  override_reason: string | null;
};

type VendorFakeFlagRow = {
  flag_id: string;
  review_id: string;
  reported_by_vendor_profile_id: string;
  reason: string;
  status: 'pending' | 'dismissed' | 'escalated';
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  // joined from vendor_reviews
  review_rating_overall: number | null;
  review_body: string | null;
  review_public_id: string | null;
  // joined from vendor_profiles (reporter)
  vendor_business_name: string | null;
};

const SIGNAL_BADGE_TONE: Record<SelfReviewSignal, string> = {
  owner_self: 'bg-rose-200 text-rose-900',
  team_member: 'bg-rose-200 text-rose-900',
  payment_match: 'bg-amber-200 text-amber-900',
  device_match: 'bg-amber-200 text-amber-900',
  household_match: 'bg-amber-200 text-amber-900',
};

const SIGNAL_LABEL_SHORT: Record<SelfReviewSignal, string> = {
  owner_self: 'Owner self',
  team_member: 'Team member',
  payment_match: 'Payment match',
  device_match: 'Device match',
  household_match: 'Household match',
};

const DECISION_LABEL: Record<NonNullable<AppealRow['decision']>, string> = {
  override_published: 'Override-published',
  rejected: 'Rejected',
  escalated: 'Escalated',
};

const DECISION_TONE: Record<NonNullable<AppealRow['decision']>, string> = {
  override_published: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-ink/10 text-ink/60',
  escalated: 'bg-violet-100 text-violet-800',
};

type Props = {
  searchParams: Promise<{
    filter?: string;
    override?: string;
    rejected?: string;
    escalated?: string;
    flag_dismissed?: string;
  }>;
};

export default async function AdminReviewsPage({ searchParams }: Props) {
  const search = await searchParams;
  const filter = (search.filter ?? 'pending') as 'pending' | 'decided' | 'all';

  const admin = createAdminClient();

  // ── Self-review appeals queue ─────────────────────────────────────────
  let appealsQuery = admin
    .from('vendor_review_appeals')
    .select(
      'appeal_id,vendor_profile_id,reviewer_user_id,event_id,event_vendor_id,matched_signal,review_payload,appeal_reason,submitted_at,decided_at,decided_by_admin,decision,decision_reason',
    )
    .order('submitted_at', { ascending: false })
    .limit(100);
  if (filter === 'pending') appealsQuery = appealsQuery.is('decided_at', null);
  else if (filter === 'decided') appealsQuery = appealsQuery.not('decided_at', 'is', null);
  const { data: appealData, error: appealError } = await appealsQuery;
  if (appealError) {
    logQueryError('AdminReviewsPage (vendor_review_appeals)', appealError);
  }
  const appeals = (appealData ?? []) as AppealRow[];

  // ── Resolution lookups ───────────────────────────────────────────────
  const vendorIds = Array.from(
    new Set(appeals.map((a) => a.vendor_profile_id).filter(Boolean)),
  );
  const reviewerIds = Array.from(
    new Set(appeals.map((a) => a.reviewer_user_id).filter(Boolean)),
  );
  const eventIds = Array.from(new Set(appeals.map((a) => a.event_id).filter(Boolean)));

  const vendorMap = new Map<string, { business_name: string; user_id: string }>();
  if (vendorIds.length > 0) {
    const { data } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, user_id')
      .in('vendor_profile_id', vendorIds);
    for (const v of data ?? []) {
      vendorMap.set(v.vendor_profile_id as string, {
        business_name: (v.business_name as string) || 'Unnamed vendor',
        user_id: v.user_id as string,
      });
    }
  }
  const userMap = new Map<string, { display_name: string | null; email: string; account_type: string }>();
  const allUserIds = Array.from(
    new Set([
      ...reviewerIds,
      ...Array.from(vendorMap.values()).map((v) => v.user_id),
    ]),
  );
  if (allUserIds.length > 0) {
    const { data } = await admin
      .from('users')
      .select('user_id, display_name, email, account_type')
      .in('user_id', allUserIds);
    for (const u of data ?? []) {
      userMap.set(u.user_id as string, {
        display_name: (u.display_name as string | null) ?? null,
        email: u.email as string,
        account_type: u.account_type as string,
      });
    }
  }
  const eventMap = new Map<string, { display_name: string; event_date: string | null }>();
  if (eventIds.length > 0) {
    const { data } = await admin
      .from('events')
      .select('event_id, display_name, event_date')
      .in('event_id', eventIds);
    for (const e of data ?? []) {
      eventMap.set(e.event_id as string, {
        display_name: (e.display_name as string) || 'Untitled event',
        event_date: (e.event_date as string | null) ?? null,
      });
    }
  }

  // ── Override flash ────────────────────────────────────────────────────
  const flash =
    search.override === '1'
      ? 'Override-publish posted. The review is now live on the vendor profile.'
      : search.rejected === '1'
        ? 'Appeal rejected. Reviewer is notified via email.'
        : search.escalated === '1'
          ? 'Appeal escalated to the two-admin queue.'
          : search.flag_dismissed === '1'
            ? 'Vendor fake-review flag dismissed.'
            : null;

  // ── Flagged review-mods queue (admin override-publish audit trail) ────
  const { data: flaggedData } = await admin
    .from('vendor_reviews')
    .select(
      'review_id,public_id,vendor_profile_id,couple_user_id,rating_overall,body,created_at,override_admin_id,override_reason',
    )
    .not('override_admin_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(25);
  const flaggedReviews = (flaggedData ?? []) as FlaggedReviewRow[];

  // ── Vendor fake-flag queue ────────────────────────────────────────────
  const { data: fakeFlagData } = await admin
    .from('vendor_review_flags')
    .select(
      'flag_id,review_id,reported_by_vendor_profile_id,reason,status,admin_note,reviewed_at,created_at',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);
  const rawFakeFlags = (fakeFlagData ?? []) as Array<{
    flag_id: string;
    review_id: string;
    reported_by_vendor_profile_id: string;
    reason: string;
    status: 'pending' | 'dismissed' | 'escalated';
    admin_note: string | null;
    reviewed_at: string | null;
    created_at: string;
  }>;

  // Resolve review + vendor details for the flag queue.
  const flagReviewIds = Array.from(new Set(rawFakeFlags.map((f) => f.review_id)));
  const flagVendorIds = Array.from(new Set(rawFakeFlags.map((f) => f.reported_by_vendor_profile_id)));

  const [flagReviewData, flagVendorData] = await Promise.all([
    flagReviewIds.length > 0
      ? admin
          .from('vendor_reviews')
          .select('review_id,public_id,rating_overall,body')
          .in('review_id', flagReviewIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    flagVendorIds.length > 0
      ? admin
          .from('vendor_profiles')
          .select('vendor_profile_id,business_name')
          .in('vendor_profile_id', flagVendorIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const flagReviewMap = new Map(
    (flagReviewData as Array<{ review_id: string; public_id: string; rating_overall: number; body: string | null }>).map(
      (r) => [r.review_id, r],
    ),
  );
  const flagVendorMap = new Map(
    (flagVendorData as Array<{ vendor_profile_id: string; business_name: string | null }>).map(
      (v) => [v.vendor_profile_id, v],
    ),
  );

  const fakeFlags: VendorFakeFlagRow[] = rawFakeFlags.map((f) => {
    const rev = flagReviewMap.get(f.review_id);
    const vend = flagVendorMap.get(f.reported_by_vendor_profile_id);
    return {
      ...f,
      review_rating_overall: rev?.rating_overall ?? null,
      review_body: rev?.body ?? null,
      review_public_id: rev?.public_id ?? null,
      vendor_business_name: vend?.business_name ?? null,
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Review moderation</h1>
        <p className="text-sm text-ink/60">
          Three queues — <span className="font-medium">Vendor fake-review flags</span>{' '}
          (vendor-reported disputed reviews), <span className="font-medium">Self-review
          appeals</span> (blocked reviewers contesting the related-account gate), and{' '}
          <span className="font-medium">Admin override-published reviews</span> (audit
          trail of every override-publish you&rsquo;ve issued).
        </p>
      </header>

      {flash ? (
        <p
          role="status"
          className="mb-6 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {flash}
        </p>
      ) : null}

      {/* ── Vendor fake-review flags ──────────────────────────────────── */}
      <section className="mb-10 space-y-4" aria-labelledby="vendor-fake-flags-heading">
        <header className="space-y-0.5">
          <h2
            id="vendor-fake-flags-heading"
            className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <Flag aria-hidden className="h-4 w-4 text-rose-700" strokeWidth={1.75} />
            Vendor fake-review flags
            {fakeFlags.length > 0 ? (
              <span className="ml-1 inline-flex h-5 items-center rounded-full bg-rose-600 px-2 font-mono text-[10px] text-white">
                {fakeFlags.length}
              </span>
            ) : null}
          </h2>
          <p className="text-xs text-ink/55">
            Vendors flag reviews they believe are fake or fraudulent. Dismiss to close, or
            escalate to the two-admin override queue. SLA: 48 hours.
          </p>
        </header>

        {fakeFlags.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
            <Flag aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
            No pending fake-review flags.
          </div>
        ) : (
          <ul className="space-y-3">
            {fakeFlags.map((f) => (
              <VendorFakeFlagCard key={f.flag_id} flag={f} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="self-review-appeals-heading">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h2
              id="self-review-appeals-heading"
              className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <ShieldOff aria-hidden className="h-4 w-4 text-rose-700" strokeWidth={1.75} />
              Self-review appeals
            </h2>
            <p className="text-xs text-ink/55">
              Single-admin authority. SLA: 48 hours.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <FilterChip active={filter} target="pending" label="Pending" />
            <FilterChip active={filter} target="decided" label="Decided" />
            <FilterChip active={filter} target="all" label="All" />
          </nav>
        </header>

        {appealError ? (
          <p className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Review appeals couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment or check Sentry for the full detail.
          </p>
        ) : null}

        {appeals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
            <Gavel
              aria-hidden
              className="mx-auto mb-2 h-6 w-6 text-ink/30"
              strokeWidth={1.5}
            />
            Nothing pending. Blocked reviewers can file an appeal from the disabled
            &ldquo;Leave a review&rdquo; CTA on their vendor card.
          </div>
        ) : (
          <ul className="space-y-3">
            {appeals.map((a) => (
              <AppealCard
                key={a.appeal_id}
                appeal={a}
                vendor={vendorMap.get(a.vendor_profile_id) ?? null}
                vendorOwner={
                  vendorMap.get(a.vendor_profile_id)?.user_id
                    ? (userMap.get(vendorMap.get(a.vendor_profile_id)!.user_id) ?? null)
                    : null
                }
                reviewer={userMap.get(a.reviewer_user_id) ?? null}
                event={eventMap.get(a.event_id) ?? null}
              />
            ))}
          </ul>
        )}
      </section>

      <section
        className="mt-12 space-y-4"
        aria-labelledby="override-history-heading"
      >
        <header className="space-y-0.5">
          <h2
            id="override-history-heading"
            className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <Flag aria-hidden className="h-4 w-4 text-emerald-700" strokeWidth={1.75} />
            Admin override-published reviews
          </h2>
          <p className="text-xs text-ink/55">
            Last 25 reviews where an admin override-published past the related-account gate.
          </p>
        </header>
        {flaggedReviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-6 text-center text-sm text-ink/55">
            No override-publishes yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {flaggedReviews.map((r) => (
              <li
                key={r.review_id}
                className="space-y-1 rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3 text-xs text-ink/70"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-emerald-900">
                  {r.public_id} · {r.rating_overall}★ · {r.created_at.slice(0, 10)}
                </p>
                {r.body ? <p className="text-sm text-ink">&ldquo;{r.body}&rdquo;</p> : null}
                <p className="text-xs italic text-ink/55">
                  Reason: {r.override_reason ?? '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  active,
  target,
  label,
}: {
  active: 'pending' | 'decided' | 'all';
  target: 'pending' | 'decided' | 'all';
  label: string;
}) {
  return (
    <Link
      href={`/admin/reviews?filter=${target}`}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active === target
          ? 'bg-terracotta text-cream'
          : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
      }`}
    >
      {label}
    </Link>
  );
}

type AppealCardProps = {
  appeal: AppealRow;
  vendor: { business_name: string; user_id: string } | null;
  vendorOwner: {
    display_name: string | null;
    email: string;
    account_type: string;
  } | null;
  reviewer: {
    display_name: string | null;
    email: string;
    account_type: string;
  } | null;
  event: { display_name: string; event_date: string | null } | null;
};

function AppealCard({
  appeal,
  vendor,
  vendorOwner,
  reviewer,
  event,
}: AppealCardProps) {
  const tone = SELF_REVIEW_SIGNAL_TONE[appeal.matched_signal];
  const isHardSignal = tone === 'hard';
  const decided = appeal.decided_at !== null;
  const payload = (appeal.review_payload as Record<string, unknown>) ?? {};
  const payloadRating =
    typeof payload['rating_overall'] === 'number'
      ? (payload['rating_overall'] as number)
      : null;
  const payloadBody =
    typeof payload['body'] === 'string' ? (payload['body'] as string) : null;

  return (
    <li className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {appeal.appeal_id.slice(0, 8)} · filed {appeal.submitted_at.slice(0, 10)}
          </p>
          <p className="text-sm">
            <span
              className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                SIGNAL_BADGE_TONE[appeal.matched_signal]
              }`}
            >
              {SIGNAL_LABEL_SHORT[appeal.matched_signal]}
            </span>{' '}
            {SELF_REVIEW_SIGNAL_LABEL[appeal.matched_signal]}
          </p>
        </div>
        {decided && appeal.decision ? (
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
              DECISION_TONE[appeal.decision]
            }`}
          >
            {DECISION_LABEL[appeal.decision]}
          </span>
        ) : null}
      </header>

      <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <Cell label="Vendor">
          <p className="text-sm font-medium text-ink">
            {vendor?.business_name ?? 'Unknown vendor'}
          </p>
          {vendorOwner ? (
            <p className="text-xs text-ink/55">
              owner: {vendorOwner.display_name ?? vendorOwner.email}
            </p>
          ) : null}
        </Cell>
        <Cell label="Reviewer">
          <p className="text-sm font-medium text-ink">
            {reviewer?.display_name ?? reviewer?.email ?? 'Unknown user'}
          </p>
          <p className="text-xs text-ink/55">{reviewer?.account_type ?? '—'}</p>
        </Cell>
        <Cell label="Event">
          <p className="text-sm text-ink">
            {event?.display_name ?? '—'}
          </p>
          <p className="text-xs text-ink/55">{event?.event_date ?? '—'}</p>
        </Cell>
      </dl>

      <div className="rounded-lg bg-ink/[0.04] p-3 text-xs">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Appeal reason
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">
          {appeal.appeal_reason}
        </p>
      </div>

      {payloadRating !== null || payloadBody ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-amber-900">
            Would-be review payload
          </p>
          {payloadRating !== null ? (
            <p className="mt-1 text-sm text-amber-950">
              {payloadRating}★ overall
            </p>
          ) : null}
          {payloadBody ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">
              &ldquo;{payloadBody}&rdquo;
            </p>
          ) : null}
        </div>
      ) : null}

      {!decided ? (
        <div className="flex flex-col gap-3 border-t border-ink/10 pt-3 sm:flex-row sm:items-start">
          {isHardSignal ? (
            <div className="flex-1 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              <strong>Override-publish is disabled for {SIGNAL_LABEL_SHORT[appeal.matched_signal]}.</strong>{' '}
              Owners and team members can never review the vendor they run — the trigger
              refuses even with bypass. Reject or escalate this appeal.
            </div>
          ) : (
            <form action={overridePublishReview} className="flex-1 space-y-2">
              <input type="hidden" name="appeal_id" value={appeal.appeal_id} />
              <textarea
                name="reason"
                required
                maxLength={4000}
                rows={2}
                placeholder="Reason for override (logged on the review row + admin_audit_log)…"
                className="input-field min-h-[60px] w-full py-2 text-xs"
              />
              <SubmitButton
                className="button-primary inline-flex items-center gap-1.5 text-xs"
                pendingLabel="Publishing…"
              >
                Override-publish
              </SubmitButton>
            </form>
          )}

          <form action={rejectAppeal} className="flex-1 space-y-2">
            <input type="hidden" name="appeal_id" value={appeal.appeal_id} />
            <textarea
              name="reason"
              required
              maxLength={4000}
              rows={2}
              placeholder="Reason the block stays in place…"
              className="input-field min-h-[60px] w-full py-2 text-xs"
            />
            <SubmitButton
              className="button-secondary inline-flex items-center gap-1.5 text-xs"
              pendingLabel="Rejecting…"
            >
              Reject appeal
            </SubmitButton>
          </form>

          <form action={escalateAppeal} className="flex-1 space-y-2">
            <input type="hidden" name="appeal_id" value={appeal.appeal_id} />
            <textarea
              name="reason"
              required
              maxLength={4000}
              rows={2}
              placeholder="Why escalate? (Routes to two-admin queue)"
              className="input-field min-h-[60px] w-full py-2 text-xs"
            />
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-200 px-3 py-2 text-xs font-medium text-violet-900 hover:bg-violet-300"
              pendingLabel="Escalating…"
            >
              Escalate
            </SubmitButton>
          </form>
        </div>
      ) : (
        <div className="border-t border-ink/10 pt-3 text-xs text-ink/55">
          Decided {appeal.decided_at?.slice(0, 10)}. Reason: {appeal.decision_reason ?? '—'}
        </div>
      )}
    </li>
  );
}

function VendorFakeFlagCard({ flag }: { flag: VendorFakeFlagRow }) {
  return (
    <li className="space-y-3 rounded-xl border border-rose-200/60 bg-rose-50/30 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Flag {flag.flag_id.slice(0, 8)} · {flag.created_at.slice(0, 10)}
          </p>
          <p className="text-sm font-medium text-ink">
            {flag.vendor_business_name ?? 'Unknown vendor'} flagged review{' '}
            {flag.review_public_id ? (
              <span className="font-mono text-[11px] text-ink/70">{flag.review_public_id}</span>
            ) : null}
          </p>
        </div>
        <span className="rounded-full bg-rose-200 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-rose-900">
          Pending
        </span>
      </header>

      {flag.review_rating_overall !== null || flag.review_body ? (
        <div className="rounded-lg bg-ink/[0.04] p-3 text-xs">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Flagged review
          </p>
          {flag.review_rating_overall !== null ? (
            <p className="mt-1 text-sm text-ink">
              {flag.review_rating_overall}★ overall
            </p>
          ) : null}
          {flag.review_body ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-ink/80">
              &ldquo;{flag.review_body}&rdquo;
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-rose-200 bg-white/60 p-3 text-xs">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-rose-900">
          Vendor reason
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">{flag.reason}</p>
      </div>

      <div className="flex flex-col gap-3 border-t border-ink/10 pt-3 sm:flex-row sm:items-end">
        <form action={dismissReviewFlag} className="flex-1 space-y-2">
          <input type="hidden" name="flag_id" value={flag.flag_id} />
          <textarea
            name="admin_note"
            rows={2}
            maxLength={1000}
            placeholder="Dismiss note (optional — explain why the flag is unfounded)…"
            className="input-field min-h-[52px] w-full py-2 text-xs"
          />
          <SubmitButton
            className="button-secondary inline-flex items-center gap-1.5 text-xs"
            pendingLabel="Dismissing…"
          >
            Dismiss flag
          </SubmitButton>
        </form>
        <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
          <p className="font-medium">To escalate:</p>
          <p className="mt-0.5 text-amber-800">
            Use the self-review override-publish queue — reject or override-publish
            the underlying review from there. Create an appeal row manually if needed.
          </p>
        </div>
      </div>
    </li>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
