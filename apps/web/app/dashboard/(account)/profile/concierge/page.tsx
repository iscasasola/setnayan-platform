/**
 * Settings → Setnayan AI tab.
 *
 * V2 cutover (CLAUDE.md 2026-05-28 row 3 + PR #560 marketing rewrite):
 * the V1 Concierge ₱2,499 SKU + 3-day card-less free trial + wedding-
 * anchored 12-mo floor / 24-mo cap expiry framework all retired. V2
 * replaces them with a single TODAYS_FOCUS line item in
 * platform_retail_catalog_v2 — one purchase per event, full wedding
 * access, no trial mechanic. This page is now a thin V2-aligned settings
 * tab: status read, copy reframed to "Setnayan AI", purchase CTA
 * redirects to /pricing.
 *
 * Route URL kept at `/dashboard/profile/concierge` so existing bookmarks,
 * navigation chrome, and the cross-iteration `CONCIERGE_ENABLED` kill-
 * switch wiring keep resolving without rename churn. Engineering rename
 * to /dashboard/profile/todays-focus is V2.x scope per the lock.
 *
 * Existing V1 schema columns (events.concierge_status, etc.) are still
 * the canonical state store during the cutover — they get renamed +
 * dropped during the Phase A schema migration. Until then this page
 * reads the existing columns and surfaces them under V2 brand voice.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Gem, Clock, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserEvents } from '@/lib/events';
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

  // V2 cutover (CLAUDE.md 2026-05-28 row 3): when the V1 kill-switch is
  // off, surface a polite "manage from pricing" panel. Once the V2
  // schema migration lands, this branch retires entirely.
  if (!CONCIERGE_ENABLED) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to profile
        </Link>
        <section className="mt-6 rounded-2xl border border-ink/10 bg-cream p-8 text-center">
          <Gem aria-hidden className="mx-auto h-8 w-8 text-terracotta" strokeWidth={1.5} />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Setnayan AI
          </h1>
          <p className="mt-2 text-base text-ink/65">
            Your in-app planner that surfaces the next step every time you open the dashboard.
          </p>
          <p className="mt-1 text-sm text-ink/55">
            All planning tools — guest list, vendors, mood board, schedule — work for every event,
            regardless of whether Setnayan AI is activated.
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3">
            <Link href="/pricing" className="button-primary">
              See pricing
            </Link>
            <Link
              href="/dashboard/profile"
              className="rounded-md bg-ink/5 px-3 py-2 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
            >
              Back to profile
            </Link>
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
      <header className="mb-8 space-y-2">
        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to profile
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Setnayan AI
        </h1>
        <p className="text-base text-ink/60">
          Your in-app planner that surfaces the next step every time you open the dashboard.
        </p>
      </header>

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
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/60">
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
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Event</p>
      <div className="flex flex-wrap gap-2">
        {events.map((e) => {
          const isActive = e.event_id === selectedId;
          return (
            <Link
              key={e.event_id}
              href={`/dashboard/profile/concierge?event=${encodeURIComponent(e.event_id)}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-terracotta text-cream'
                  : 'bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink'
              }`}
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
      <section className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-6">
        <header className="mb-3 flex items-center gap-2">
          <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-700" strokeWidth={1.75} />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-900/75">
            Setnayan AI · active
          </p>
        </header>
        <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FactRow label="Activated" value={formatConciergeDate(activatedAt)} />
          <FactRow label="Active until" value={formatConciergeDate(expiresAt)} />
          {days !== null ? (
            <FactRow
              label="Days remaining"
              value={`${days} day${days === 1 ? '' : 's'}`}
            />
          ) : null}
        </dl>
        <p className="mt-4 text-sm text-emerald-900/80">
          Your daily wedding planner is unlocked across every event surface. Head to your event
          home to see today&rsquo;s recommended step.
        </p>
      </section>
    );
  }

  if (status === 'expired') {
    return (
      <section className="rounded-2xl border border-ink/15 bg-cream p-6">
        <header className="mb-3 flex items-center gap-2">
          <Clock aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={1.75} />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Setnayan AI ended
          </p>
        </header>
        <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
        <p className="mt-1 text-sm text-ink/65">
          Setnayan AI ended on <strong>{formatConciergeDate(expiresAt)}</strong>. Your
          planning progress is saved — pick it back up anytime.
        </p>
        <div className="mt-4">
          <Link href="/pricing" className="button-primary">
            See pricing
          </Link>
        </div>
      </section>
    );
  }

  // DIY — Setnayan AI not yet activated on this event.
  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-6">
      <header className="mb-3 flex items-center gap-2">
        <Gem aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Currently · DIY
        </p>
      </header>
      <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
      <p className="mt-1 text-sm text-ink/65">
        You&rsquo;re planning on your own. Every dashboard tool — guest list, vendors, mood board,
        schedule — works the same. Setnayan AI adds a daily &ldquo;here&rsquo;s the next
        step&rdquo; suggestion every time you open the app.
      </p>
      <div className="mt-4">
        <Link href="/pricing" className="button-primary inline-flex items-center gap-2">
          <Gem aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          See pricing
        </Link>
      </div>
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 rounded-md border border-ink/10 bg-cream/50 p-3">
      <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</dt>
      <dd className="text-base text-ink">{value}</dd>
    </div>
  );
}
