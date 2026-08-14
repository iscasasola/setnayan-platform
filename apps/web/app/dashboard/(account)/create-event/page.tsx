import Link from 'next/link';
import { ArrowLeft, Sparkles, Users } from 'lucide-react';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { getBudgetBands } from '@/lib/budget-bands';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resolveProfile } from '@/lib/event-type-profile';
import { fetchCommunity } from '@/lib/communities';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { isPersonDependent } from '@/lib/dependent-people';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { hiddenMeasuredTypes, type ConcernPerson } from '@/lib/life-event-gate';
import { manilaToday } from '@/lib/std-views';
import {
  buildSelfSubject,
  buildUnspecifiedSubject,
  dependentSubjects,
  type CreateSubject,
  type DependentSubjectRow,
} from '@/lib/create-subjects';
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
  // Copy corrected 2026-07-31: this told the user to type into “Para kanino?”,
  // a field the live create path no longer renders — the generic onboarding
  // wizard asks “Who are we celebrating?” instead, and it now surfaces this
  // same block ON that screen. Naming a field by its old label sent people
  // looking for something that is not there.
  life_event_exists:
    'That celebration is already in planning. Open the existing event — or start again and name a different celebrant when we ask who it’s for.',
};

type SearchParams = Promise<{
  error?: string;
  next?: string;
  event_type?: string;
  samahan?: string;
  existing?: string;
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

  // Measured-life-type visibility (owner 2026-07-17: "hide events that do not
  // concern them for their life events — Wedding available anytime, it's not a
  // measured date"). Debut/christening are derivable from stored birthdates, so
  // when the counsel-gated People layer is ON we hide them unless someone in
  // the account's people actually approaches that moment. The picker keeps a
  // "show all" doorway (wayfinding lock) — hiding is a default, never a wall.
  // Flag OFF / samahan context → nothing hides (we can't measure).
  //
  // WHO-FIRST (prototype User_Home_REDESIGN_2026-07-30): the same read also
  // builds the subject roster for the "para kanino ito?" step, so the alaga are
  // fetched ONCE. The read is now ANDed with the `dependent_minor_profiles`
  // data-privacy control on top of the env flag — the strictest shipped posture
  // (dashboard/(account)/year/page.tsx), because it now returns NAMES. Tighter
  // gate = the grid hides LESS when the control is off, which is the module's
  // documented fail-open direction, never a new denial.
  const today = manilaToday();
  let hiddenTypeKeys: string[] = [];
  let alagaSubjects: CreateSubject[] = [];
  if (
    user &&
    !samahan &&
    dependentPeopleEnabled() &&
    (await isDataPrivacyControlActive('dependent_minor_profiles'))
  ) {
    // RLS scopes this to the viewer's own (+ married-household shared)
    // dependents; a household concern counts. Handed-over records aged out.
    const { data: deps } = await supabase
      .from('dependents')
      .select('dependent_id, name, dependent_kind, birth_date, sex, claimed_user_id')
      .is('handed_over_at', null);
    const rows = (deps ?? []) as DependentSubjectRow[];
    hiddenTypeKeys = hiddenMeasuredTypes(
      rows.filter((r) => isPersonDependent(r.dependent_kind)) as ConcernPerson[],
      today,
    );
    alagaSubjects = dependentSubjects(rows, user.id);
  }

  // "You" + every alaga + the always-present escape hatch. Never shown for a
  // samahan (a community event has no personal celebrant) and never for the QR
  // fast-lane (the type — and with it the flow — is already settled).
  //
  // "You" is measured from the account holder's OWN saved birthday
  // (owner-directed 2026-07-30: "their birthdays shows based from their account…
  // only for their own account and their dependents"). This is a READ of the
  // viewer's own row, under their own session, to sort their own picker — it is
  // disclosed to nobody and no date is ever written onto the event (that stays
  // barred by lib/onboarding/event-insert.ts). An account with no saved birthday
  // measures nothing and keeps the whole grid, exactly as it shipped.
  //
  // `sex` is deliberately NOT read. It would only sharpen 18F/21M on the debut
  // ladder, it carries its own RA 10173 consent stamp, and the owner directed
  // birthdays — not a second sensitive field. Omitting it checks BOTH debut ages,
  // which folds LESS, the documented fail-open direction.
  let subjects: CreateSubject[] = [];
  if (user && !samahan) {
    const { data: profile } = await supabase
      .from('users')
      .select('display_name, birth_date')
      .eq('user_id', user.id)
      .maybeSingle();
    subjects = [
      buildSelfSubject((profile?.display_name as string | null) ?? null, {
        birth_date: (profile?.birth_date as string | null) ?? null,
      }),
      ...alagaSubjects,
      buildUnspecifiedSubject(),
    ];
  }

  // Life-event cardinality blocked state (council § 5 card 1): the server
  // action bounced a duplicate in-planning life event here with its id. Fetch
  // the display name so the card can say WHICH celebration is already open —
  // RLS (member-only read) naturally scopes this to the user's own events.
  let blockedLifeEvent: { eventId: string; displayName: string } | null = null;
  if (rawError === 'life_event_exists' && params.existing && user) {
    const { data: ev } = await supabase
      .from('events')
      .select('event_id, display_name')
      .eq('event_id', params.existing)
      .maybeSingle();
    if (ev) blockedLifeEvent = { eventId: ev.event_id, displayName: ev.display_name };
  }

  // The heading + these notices moved INTO the picker (as `notice`) so the
  // question on screen is the question the step is actually asking — "para
  // kanino ito?" first, "what kind of event?" second — while the notices keep
  // their shipped position directly beneath it.
  const notice = (
    <>
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

      {blockedLifeEvent ? (
        /* Life-event cardinality — the LIVE-duplicate card (council § 5 card 1).
           Every door is live: open the existing event (primary), start a
           different celebrant (the form's "Para kanino?" field), or archive the
           old event (the inline archive door — an undated in-planning event
           otherwise blocks forever). Invitation, not wall. */
        <div className="mb-6 rounded-2xl border border-ink/10 bg-ink/[0.02] p-5 sm:p-6" role="alert">
          <p className="font-sans text-xl text-ink">Tuloy pa rin ang planning na ito</p>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            <span className="font-medium text-ink">{blockedLifeEvent.displayName}</span> is already in
            planning — one celebration of this kind per celebrant at a time.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-mulberry px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-mulberry/90"
              href={`/dashboard/${blockedLifeEvent.eventId}`}
            >
              Buksan ang {blockedLifeEvent.displayName}
            </Link>
            <span className="text-xs leading-relaxed text-ink/60">
              Iba ang celebrant? Start again and name a different person when we ask who it’s
              for. Tapos na ang lumang event? Archive it from its dashboard to free the slot.
            </span>
          </div>
        </div>
      ) : errorMessage ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-2 space-y-2">
{/*
          🔴 `?hub=1`, NOT A BARE `/dashboard`. The board AUTO-JUMPS a couple who
          holds exactly one upcoming event straight back into that event
          (`(launcher)/page.tsx:348`) — an owner ruling that stays. So the
          routine way OUT of this page would have dumped them INSIDE their
          wedding instead of on their events board, and `?hub=1` is the only
          escape hatch that exists. This matters now because the rail's
          "+ New event" points here (2026-08-15); before that, almost nobody
          arrived from the board.
        */}
        <Link
          href={samahan ? `/dashboard/samahan/${samahan.communityId}?tab=events` : '/dashboard?hub=1'}
          className="sn-chip sn-press w-fit"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {samahan ? `Back to ${samahan.name}` : 'Back to events'}
        </Link>
        <p className="sn-eye">
          <Sparkles aria-hidden strokeWidth={1.75} />
          New event
        </p>
      </div>

      <EventTypePicker
        types={typesForContext}
        budgetBands={budgetBands}
        next={next !== '/' ? next : undefined}
        notice={notice}
        preselect={preselect}
        inPlanningWedding={inPlanningWedding}
        samahanCommunityId={samahan?.communityId}
        hiddenTypeKeys={hiddenTypeKeys}
        subjects={subjects}
        todayISO={today}
      />
    </div>
  );
}
