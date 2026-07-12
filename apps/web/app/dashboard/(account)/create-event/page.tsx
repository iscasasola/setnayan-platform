import Link from 'next/link';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { getBudgetBands } from '@/lib/budget-bands';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getInPlanningWedding } from './wedding-guard';
import { EventTypePicker } from './_components/event-type-picker';
/* Retired 2026-05-28 V2 cutover — CONCIERGE_ENABLED import removed.
   V2 has no Concierge choice card on create-event; every new event
   lands in DIY by default. */

export const metadata = { title: 'Create event' };

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please give the event a name.',
  invalid_type:
    "That event type isn't available yet — pick one to continue.",
  missing_ceremony_type:
    'Pick a wedding type so we can match vendors compatible with your ceremony.',
  missing_sub_type: 'Pick a tradition for the ceremony type you chose.',
  missing_secondary: 'Pick a secondary ceremony for your interfaith wedding.',
  wedding_exists:
    'You already have a wedding in planning — you can only plan one wedding at a time. Finish or archive it first to start a new one.',
};

type SearchParams = Promise<{ error?: string; next?: string; event_type?: string }>;

export default async function CreateEventPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Optional return path threaded through to the inline create form (e.g. the
  // vendor-invite claim loop). safeNext() keeps it to internal paths only.
  const next = safeNext(params.next);
  // DB-driven roster (2026-06-13): status='active' AND enabled=TRUE vocab
  // rows, ordered. Falls back to the pre-cutover constant on DB hiccups.
  const eventTypes = await getCreatableEventTypes();
  // Budget feel-bands for the optional budget picker on the non-wedding inline
  // form (DB-backed, falls back to the seed constant). Fetched here so the
  // client picker stays server-data-driven, same source as onboarding.
  const budgetBands = await getBudgetBands();
  // QR fast-lane (owner 2026-07): a Locked/Shortlist QR already carries the
  // event type, so pre-select it and let the picker auto-advance — the couple
  // never re-picks the type they already agreed to with the vendor.
  const preselect =
    params.event_type && eventTypes.some((t) => t.key === params.event_type)
      ? params.event_type
      : undefined;
  const rawError = params.error ? decodeURIComponent(params.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;

  // Wedding cardinality (owner-locked 2026-07-12 · flow-check reconciled): if the
  // user has a wedding still IN PLANNING, the picker shows a guided router (edit
  // the same-marriage wedding / vow renewal → Anniversary / a new marriage) instead
  // of the form. A SETTLED wedding (archived, or completed) does NOT block — so
  // remarriage works. The server action re-checks authoritatively.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const inPlanningWedding = user ? await getInPlanningWedding(supabase, user.id) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <Link
          href="/dashboard"
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to events
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          What kind of event are you planning?
        </h1>
        <p className="text-base text-ink/60">
          Tap a type to begin.
        </p>
      </header>

      {errorMessage ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <EventTypePicker
        types={eventTypes}
        budgetBands={budgetBands}
        next={next !== '/' ? next : undefined}
        preselect={preselect}
        inPlanningWedding={inPlanningWedding}
      />
    </div>
  );
}
