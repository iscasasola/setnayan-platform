import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, CalendarDays, Store, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listHostEvents } from '@/lib/vendor-couple-invite';
import {
  VENDOR_CATEGORY_LABEL,
  formatPhp,
  type VendorCategory,
} from '@/lib/vendors';
import { DUE_ANCHOR_LABELS, type DueAnchor } from '@/lib/vendor-service-payment-schedules';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { formatEventDate } from '@/lib/events';
import { SubmitButton } from '@/app/_components/submit-button';
import { claimLockedQr } from './actions';

export const metadata = {
  title: 'Lock in your vendor · Setnayan',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUS_COPY: Record<string, string> = {
  pick_event: 'Choose which event to lock this vendor into.',
  not_your_event: 'That event isn’t one you host — pick one of yours.',
  taken: 'This Locked QR has already been used.',
  void: 'This Locked QR is no longer valid.',
  invalid: 'This Locked QR link is not valid.',
  error: 'Something went wrong locking the vendor. Please try again.',
};

type ScheduleRow = {
  label?: string;
  amount_kind?: string;
  amount_value?: number;
  due_anchor?: string;
};

export default async function VendorLockPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { status } = await searchParams;

  const admin = createAdminClient();
  const { data: tok } = await admin
    .from('vendor_locked_qr_tokens')
    .select(
      'token, vendor_profile_id, event_type, category, total_php, initial_paid_php, schedule_json, status, claimed_by_user_id, claimed_event_id',
    )
    .eq('token', token)
    .maybeSingle();
  if (!tok) notFound();

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('business_name, tagline, logo_url, location_city, is_published')
    .eq('vendor_profile_id', tok.vendor_profile_id)
    .maybeSingle();
  if (!vendor) notFound();

  const categoryLabel =
    VENDOR_CATEGORY_LABEL[tok.category as VendorCategory] ?? 'Vendor';
  const total = tok.total_php != null ? Number(tok.total_php) : null;
  const paid = Number(tok.initial_paid_php ?? 0);

  const eventTypes = tok.event_type ? await getEventTypeVocab() : [];
  const eventTypeLabel = tok.event_type
    ? (eventTypes.find((t) => t.key === tok.event_type)?.label ?? null)
    : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextPath = `/vendor/lock/${token}`;
  const statusMessage = status ? STATUS_COPY[status] ?? null : null;

  // Already consumed → show the terminal state (own claim gets a link back).
  if (tok.status !== 'pending') {
    const mineAndClaimed =
      tok.status === 'claimed' && user && tok.claimed_by_user_id === user.id;
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" strokeWidth={1.5} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {tok.status === 'claimed' ? 'Already locked in' : 'This QR is no longer valid'}
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          {tok.status === 'claimed'
            ? `${vendor.business_name} has already been locked to an event with this QR.`
            : 'This Locked QR was cancelled by the vendor.'}
        </p>
        {mineAndClaimed && tok.claimed_event_id ? (
          <Link
            href={`/dashboard/${tok.claimed_event_id}/vendors`}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
          >
            Go to your vendors
          </Link>
        ) : null}
      </div>
    );
  }

  const schedule = (Array.isArray(tok.schedule_json) ? tok.schedule_json : []) as ScheduleRow[];
  const rowAmount = (r: ScheduleRow): string => {
    const v = Number(r.amount_value ?? 0);
    if (r.amount_kind === 'percent') {
      return total != null ? formatPhp(Math.round((total * v) / 100)) : `${v}%`;
    }
    return formatPhp(v);
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      {/* Vendor + deal identity */}
      <div className="rounded-3xl border border-ink/10 bg-cream p-6 text-center">
        {vendor.logo_url ? (
          <Image
            src={vendor.logo_url}
            alt={vendor.business_name}
            width={88}
            height={88}
            className="mx-auto h-20 w-20 rounded-2xl object-cover"
          />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-ink/5">
            <Store className="h-8 w-8 text-ink/40" strokeWidth={1.5} />
          </div>
        )}
        <p className="mt-4 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
          <Lock className="h-3 w-3" strokeWidth={2} /> {categoryLabel}
          {eventTypeLabel ? ` · ${eventTypeLabel}` : ''}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{vendor.business_name}</h1>
        {vendor.tagline ? <p className="mt-1 text-sm text-ink/60">{vendor.tagline}</p> : null}
      </div>

      {/* Deal summary */}
      <div className="mt-4 rounded-2xl border border-ink/10 bg-white/60 p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink/60">Total</span>
          <span className="text-lg font-semibold text-ink">
            {total != null ? formatPhp(total) : '—'}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm text-ink/60">Downpayment received</span>
          <span className="text-sm font-medium text-emerald-700">{formatPhp(paid)}</span>
        </div>
        {schedule.length > 0 && (
          <div className="mt-4 border-t border-ink/10 pt-3">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
              Payment schedule
            </p>
            <ul className="space-y-1.5">
              {schedule.map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink/80">
                    {r.label || `Payment ${i + 1}`}
                    <span className="ml-1 text-ink/40">
                      · {DUE_ANCHOR_LABELS[(r.due_anchor as DueAnchor)] ?? ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-ink">{rowAmount(r)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {statusMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {statusMessage}
        </p>
      ) : null}

      {/* Action zone */}
      <div className="mt-6">
        {!user ? (
          <div className="rounded-2xl border border-ink/10 bg-white/60 p-5 text-center">
            <p className="text-sm text-ink/70">
              Create your free Setnayan plan to lock in {vendor.business_name} and
              track this payment schedule.
            </p>
            <Link
              href={`/signup?as=couple&next=${encodeURIComponent(nextPath)}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
            >
              Sign up free & lock it in
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="mt-3 inline-block text-sm text-ink/60 underline hover:text-terracotta"
            >
              I already have an account
            </Link>
          </div>
        ) : (
          <ClaimForm token={token} userId={user.id} nextPath={nextPath} adminClient={admin} />
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-ink/40">
        Locking a vendor records your booking and payment plan. This QR works once.
      </p>
    </div>
  );
}

async function ClaimForm({
  token,
  userId,
  nextPath,
  adminClient,
}: {
  token: string;
  userId: string;
  nextPath: string;
  adminClient: ReturnType<typeof createAdminClient>;
}) {
  const hostEvents = await listHostEvents(adminClient, userId);

  if (hostEvents.length === 0) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white/60 p-5 text-center">
        <p className="text-sm text-ink/70">
          Create your event first, then we’ll lock the vendor into it.
        </p>
        <Link
          href={`/dashboard/create-event?next=${encodeURIComponent(nextPath)}`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          Create your event
        </Link>
      </div>
    );
  }

  return (
    <form action={claimLockedQr} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm font-medium text-ink/80">Lock into which event?</p>
      <fieldset className="space-y-2">
        {hostEvents.map((ev, i) => (
          <label
            key={ev.event_id}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink/15 bg-white/60 px-4 py-3 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5"
          >
            <input
              type="radio"
              name="event_id"
              value={ev.event_id}
              defaultChecked={i === 0}
              className="accent-terracotta"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {ev.display_name ?? 'Untitled event'}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-ink/50">
                <CalendarDays className="h-3 w-3" strokeWidth={1.75} />
                {ev.event_date ? formatEventDate(ev.event_date, 'en-PH') : 'Date TBD'}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <SubmitButton
        pendingLabel="Locking…"
        className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
      >
        Lock it in
      </SubmitButton>
    </form>
  );
}
