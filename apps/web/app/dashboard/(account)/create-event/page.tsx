import Link from 'next/link';
import { ArrowLeft, Sparkles, Users } from 'lucide-react';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { getBudgetBands } from '@/lib/budget-bands';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resolveProfile } from '@/lib/event-type-profile';
import { fetchCommunity } from '@/lib/communities';
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
  samahan_invalid_type:
    'That event type belongs to a person, not a samahan — pick a community event type.',
  samahan_not_organizer:
    'Only an organizer of that samahan can plan its events.',
};

type SearchParams = Promise<{
  error?: string;
  next?: string;
  event_type?: string;
  samahan?: string;
}>;

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

  // Samahan context (plan §7): `?samahan=<communityId>` turns this into
  // COMMUNITY event creation — organizer-gated. A non-organizer, a plain
  // member, a bad id, or an archived samahan all silently DROP the param and
  // get the normal personal page (the server action re-verifies regardless).
  let samahan: { communityId: string; name: string } | null = null;
  if (params.samahan && user) {
    const community = await fetchCommunity(supabase, params.samahan, user.id);
    if (community && !community.archived && community.role === 'organizer') {
      samahan = { communityId: community.community_id, name: community.name };
    }
  }

  // Community events are class-gated (owner lock 2026-07-15): the picker only
  // shows event types whose profile is community_eligible — a Samahan can
  // never own a personal milestone. resolveProfile is request-cached per type.
  const typesForContext = samahan
    ? (
        await Promise.all(
          eventTypes.map(async (t) =>
            (await resolveProfile(t.key)).eventClass === 'community_eligible'
              ? t
              : null,
          ),
        )
      ).filter((t): t is (typeof eventTypes)[number] => t !== null)
    : eventTypes;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <Link
          href={samahan ? `/dashboard/samahan/${samahan.communityId}?tab=events` : '/dashboard'}
          className="sn-chip sn-press w-fit"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {samahan ? `Back to ${samahan.name}` : 'Back to events'}
        </Link>
        <p className="sn-eye">
          <Sparkles aria-hidden strokeWidth={1.75} />
          New event
        </p>
        <h1 className="sn-h1">
          What kind of event are you planning?
        </h1>
        <p className="text-base text-ink/65">
          Tap a type to begin.
        </p>
      </header>

      {samahan ? (
        <p className="sn-tile mb-6 flex items-center gap-2 py-3 text-sm text-ink/75">
          <Users aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={1.75} />
          <span>
            Planning for <span className="font-medium text-ink">{samahan.name}</span>
          </span>
          <span className="ml-auto shrink-0 rounded-full border border-ink/10 bg-white/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Samahan
          </span>
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <EventTypePicker
        types={typesForContext}
        budgetBands={budgetBands}
        next={next !== '/' ? next : undefined}
        preselect={preselect}
        inPlanningWedding={inPlanningWedding}
        samahanCommunityId={samahan?.communityId}
      />
    </div>
  );
}
