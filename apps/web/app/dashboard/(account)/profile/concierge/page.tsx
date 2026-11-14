/**
 * Settings → Setnayan AI tab. This is a LIVE settings surface, not dead code:
 * it renders per-event Setnayan AI status + a pricing CTA, and it backs the
 * admin concierge-abuse queue's notification relatedUrls + the profile entry
 * link. (Verified in the 2026-07-15 dead-route cleanup — kept, not deleted.)
 *
 * V1 → V2 cutover (CLAUDE.md 2026-05-28 row 3 + PR #560 marketing rewrite):
 * the V1 "Setnayan Concierge" ₱2,499 SKU + 3-day card-less free trial +
 * wedding-anchored 12-mo floor / 24-mo cap expiry framework are all RETIRED.
 * The successor is the ₱499 one-time Setnayan AI planner (owner-locked
 * 2026-07-02) — one purchase per event, no trial mechanic; the purchase CTA
 * points to /pricing.
 *
 * `CONCIERGE_ENABLED` (lib/concierge.ts) is PERMANENTLY false — there is no
 * Concierge purchase flow to re-light. With it off, this page always renders
 * the flag-off "Setnayan AI · see pricing" panel below. The `true` branch (V1
 * trial/expiry StatusPanel reading the legacy concierge_* columns) is a dormant
 * tombstone that retires wholesale in the V2 schema migration.
 *
 * Route URL kept at `/dashboard/profile/concierge` so bookmarks, the routes.ts
 * helper, sku-activation.ts's activateConcierge import, and the admin
 * concierge-abuse relatedUrls keep resolving without rename churn. Engineering
 * rename to /dashboard/profile/todays-focus is V2.x scope per the lock.
 *
 * Existing V1 schema columns (events.concierge_status, etc.) remain the
 * canonical state store until the Phase A schema migration renames + drops them.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Gem, Clock, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserEvents } from '@/lib/events';
import { PageMasthead } from '@/app/_components/page-masthead';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import {
  CONCIERGE_ENABLED,
  type ConciergeStatus,
  daysRemaining,
  formatConciergeDate,
  sweepExpiredConcierge,
} from '@/lib/concierge';

export const metadata = { title: "Setnayan AI · Settings" };

type Props = {
  searchParams: Promise<{
    event?: string;
  }>;
};

export default async function TodaysFocusSettingsPage({ searchParams }: Props) {
  const search = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // CONCIERGE_ENABLED is permanently false (Concierge retired — see lib/concierge.ts),
  // so this is the live path: a Setnayan AI settings panel with a pricing CTA. The
  // V1 status panel below (the `true` branch) stays dormant until the V2 schema migration.
  if (!CONCIERGE_ENABLED) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <ActionButton tone="neutral" icon={<ArrowLeft aria-hidden />} label="Back to profile" href="/dashboard/profile" />
        <section className="mt-6 py-6 text-center">
          <Gem aria-hidden className="mx-auto h-8 w-8 text-terracotta" strokeWidth={1.5} />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Setnayan AI
          </h1>
          <InfoTip
            label="Your in-app planner that surfaces the next step every time you open the dashboard."
            labelAs="p"
            labelClassName="mt-2 text-base text-ink/75"
            className="justify-center"
          >
            All planning tools — guest list, suppliers, mood board, schedule — work for every event, regardless of whether
            Setnayan AI is activated.
          </InfoTip>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3">
            <ActionButton tone="brand" main icon={<Gem aria-hidden />} label="See pricing" href="/pricing" />
            <ActionButton tone="neutral" icon={<ArrowLeft aria-hidden />} label="Back to profile" href="/dashboard/profile" />
          </div>
        </section>
      </div>
    );
  }

  // Lazy expiry sweep at the top of any Setnayan AI-surfacing page
  // (no-cron architecture per CLAUDE.md 2026-05-14 lock / PR #47). The
  // underlying helper still reads the V1 concierge_* columns; the V2
  // schema migration retires those + this call alongside.
  const admin = createAdminClient();
  await sweepExpiredConcierge(admin);

  const [{ data: profile }, events] = await Promise.all([
    // V1 schema columns retained during cutover — read what's there
    // without surfacing the legacy brand or trial machinery to the
    // host. The V2 schema migration will rename these columns;
    // updating the SELECT list happens alongside that migration.
    supabase
      .from('users')
      .select('display_name, phone')
      .eq('user_id', user.id)
      .maybeSingle(),
    fetchUserEvents(supabase, user.id, 'couple'),
  ]);
  // Suppress unused-var warning until V2 schema rename surfaces
  // host-level state worth showing here.
  void profile;

  const activeEvents = events.filter((e) => !e.archived);
  const requestedEventId = typeof search.event === 'string' ? search.event : null;
  const selectedEvent =
    activeEvents.find((e) => e.event_id === requestedEventId) ?? activeEvents[0] ?? null;

  type TodaysFocusEventRow = {
    /* Retired 2026-05-28 V2 cutover · V1 column names retained during
       cutover; V2 schema migration renames the columns + drops the
       trial / abuse / long-engagement-advisory fields entirely. */
    concierge_status: ConciergeStatus;
    concierge_activated_at: string | null;
    concierge_expires_at: string | null;
  };
  let todaysFocusRow: TodaysFocusEventRow | null = null;
  if (selectedEvent) {
    const { data: eventDetail } = await supabase
      .from('events')
      .select('concierge_status, concierge_activated_at, concierge_expires_at')
      .eq('event_id', selectedEvent.event_id)
      .maybeSingle();
    todaysFocusRow = (eventDetail as unknown as TodaysFocusEventRow | null) ?? null;
  }

  const status: ConciergeStatus = todaysFocusRow?.concierge_status ?? 'diy';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        title="Setnayan AI"
      />

      {/* Event picker (multi-event accounts) */}
      {activeEvents.length > 1 ? (
        <EventPicker
          events={activeEvents.map((e) => ({
            event_id: e.event_id,
            display_name: e.display_name,
          }))}
          selectedId={selectedEvent?.event_id ?? ''}
        />
      ) : null}

      {selectedEvent ? (
        <StatusPanel
          eventName={selectedEvent.display_name}
          status={status}
          expiresAt={todaysFocusRow?.concierge_expires_at ?? null}
          activatedAt={todaysFocusRow?.concierge_activated_at ?? null}
        />
      ) : (
        <p className="py-3 text-sm text-ink/70">
          Create your first event from the dashboard to manage Setnayan AI.
        </p>
      )}
    </div>
  );
}

function EventPicker({
  events,
  selectedId,
}: {
  events: Array<{ event_id: string; display_name: string }>;
  selectedId: string;
}) {
  return (
    <section className="mb-6 space-y-2">
      <p className="sn-sec">Event</p>
      <div className="flex flex-wrap gap-2">
        {events.map((e) => {
          const isActive = e.event_id === selectedId;
          return (
            <Link
              key={e.event_id}
              href={`/dashboard/profile/concierge?event=${encodeURIComponent(e.event_id)}`}
              className={`sn-chip sn-press ${isActive ? 'selected' : ''}`}
            >
              {e.display_name}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function StatusPanel({
  eventName,
  status,
  expiresAt,
  activatedAt,
}: {
  eventName: string;
  status: ConciergeStatus;
  expiresAt: string | null;
  activatedAt: string | null;
}) {
  if (status === 'active' || status === 'trial') {
    const days = daysRemaining(expiresAt);
    return (
      <section className="py-2">
        <header className="mb-3 flex items-center gap-2">
          <CheckCircle2 aria-hidden className="h-4 w-4 text-[rgb(var(--color-ok))]" strokeWidth={1.75} />
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[rgb(var(--color-ok))]">
            Setnayan AI · active
          </p>
        </header>
        <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
        <dl className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
          <FactRow label="Activated" value={formatConciergeDate(activatedAt)} />
          <FactRow label="Active until" value={formatConciergeDate(expiresAt)} />
          {days !== null ? (
            <FactRow
              label="Days remaining"
              value={`${days} day${days === 1 ? '' : 's'}`}
            />
          ) : null}
        </dl>
        <InfoTip
          label="Your daily wedding planner is unlocked across every event surface."
          labelAs="p"
          labelClassName="text-sm text-ink/75"
          className="mt-4"
        >
          Head to your event home to see today&rsquo;s recommended step.
        </InfoTip>
      </section>
    );
  }

  if (status === 'expired') {
    return (
      <section className="py-2">
        <header className="mb-3 flex items-center gap-2">
          <Clock aria-hidden className="h-4 w-4 text-ink/70" strokeWidth={1.75} />
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">Setnayan AI ended</p>
        </header>
        <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
        <InfoTip
          label={`Setnayan AI ended on ${formatConciergeDate(expiresAt)}.`}
          labelNode={
            <>
              Setnayan AI ended on <strong>{formatConciergeDate(expiresAt)}</strong>.
            </>
          }
          labelAs="p"
          labelClassName="text-sm text-ink/75"
          className="mt-1"
        >
          Your planning progress is saved — pick it back up anytime.
        </InfoTip>
        <div className="mt-4">
          <ActionButton tone="brand" main icon={<Gem aria-hidden />} label="See pricing" href="/pricing" />
        </div>
      </section>
    );
  }

  // DIY — Setnayan AI not yet activated on this event.
  return (
    <section className="py-2">
      <header className="mb-3 flex items-center gap-2">
        <Gem aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">Currently · DIY</p>
      </header>
      <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
      <InfoTip label="You’re planning on your own." labelAs="p" labelClassName="text-sm text-ink/75" className="mt-1">
        Every dashboard tool — guest list, suppliers, mood board, schedule — works the same. Setnayan AI adds a daily
        &ldquo;here&rsquo;s the next step&rdquo; suggestion every time you open the app.
      </InfoTip>
      <div className="mt-4">
        <ActionButton tone="brand" main icon={<Gem aria-hidden />} label="See pricing" href="/pricing" />
      </div>
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 py-2">
      <dt className="text-sm text-ink/70">{label}</dt>
      <dd className="text-base font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
