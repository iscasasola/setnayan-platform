import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { HeartHandshake, Users } from 'lucide-react';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { getBudgetBands } from '@/lib/budget-bands';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveShopId } from '@/lib/active-shop';
import { resolveProfile } from '@/lib/event-type-profile';
import { fetchCommunity, fetchUserCommunities } from '@/lib/communities';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { isPersonDependent } from '@/lib/dependent-people';
import { lovedOnesInMyCare, spouseIdSet, type DependentOwnership } from '@/lib/my-loved-ones';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { hiddenMeasuredTypes, type ConcernPerson } from '@/lib/life-event-gate';
import { manilaToday } from '@/lib/std-views';
import {
  buildCreateRoster,
  buildGroupSubject,
  buildSelfSubject,
  dependentSubjects,
  type CreateSubject,
  type DependentSubjectRow,
} from '@/lib/create-subjects';
import { getInPlanningWedding } from './wedding-guard';
import { readPlanTogether } from '@/lib/plan-together.server';
import { EventTypePicker } from './_components/event-type-picker';
import { NewEventHead } from './_components/new-event-head';
/* Retired 2026-05-28 V2 cutover — CONCIERGE_ENABLED import removed.
   V2 has no Concierge choice card on create-event; every new event
   lands in DIY by default. */

export const metadata = { title: 'Create event' };

/**
 * The name of the shop this login is standing in, or null. ⚠ A refused read ANYWHERE
 * here means "A business" asks the name instead of filling it — never a wrong shop.
 */
async function readActiveShopName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  let shopId: string | null = null;
  try {
    shopId = await resolveActiveShopId(supabase, userId);
  } catch (e) {
    logQueryError('CreateEventPage.activeShop', e, {}, 'graceful_degrade');
    return null;
  }
  if (!shopId) return null;
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('business_name')
    .eq('vendor_profile_id', shopId)
    .maybeSingle();
  if (error) {
    logQueryError('CreateEventPage.shopName', error, {}, 'graceful_degrade');
    return null;
  }
  return (data?.business_name as string | null | undefined) ?? null;
}

const ERROR_COPY: Record<string, string> = {
  // The two outcomes of a failed write, kept apart on purpose. `create_failed`
  // means nothing survived — retrying is safe and is the right advice.
  // `create_incomplete` means a half-made event could NOT be rolled back, so
  // telling them to try again would mint a second one nobody owns.
  create_failed:
    'We couldn’t create that event. Nothing was charged — please try again.',
  create_incomplete:
    'We couldn’t finish creating that event, and part of it may have been saved. Please contact us before trying again so we don’t make a duplicate.',
  plan_next_year_failed:
    'We couldn’t set up next year’s event. Nothing was charged — please try again.',
  missing_name: 'Please give the event a name.',
  invalid_type:
    "That event type isn't available yet — pick one to continue.",
  missing_ceremony_type:
    'Pick a wedding type so we can match suppliers compatible with your ceremony.',
  missing_sub_type: 'Pick a tradition for the ceremony type you chose.',
  missing_secondary: 'Pick a secondary ceremony for your interfaith wedding.',
  wedding_exists:
    'You already have a wedding in planning — you can only plan one wedding at a time. Finish it first, or open it and choose “Put this away”.',
  samahan_invalid_type:
    'That event type belongs to a person, not a group — pick a community event type.',
  samahan_not_organizer:
    'Only an organizer of that group can plan its events.',
  // Copy corrected 2026-07-31: this told the user to type into “Para kanino?”,
  // a field the live create path no longer renders — the generic onboarding
  // wizard asks “Who are we celebrating?” instead, and it now surfaces this
  // same block ON that screen. Naming a field by its old label sent people
  // looking for something that is not there.
  life_event_exists:
    'That event is already in planning. Open the existing event — or start again and name a different celebrant when we ask who it’s for.',
};

type SearchParams = Promise<{
  error?: string;
  next?: string;
  event_type?: string;
  samahan?: string;
  existing?: string;
  /** "Plan an event together" — a confirmed PARTNER connection id (People). */
  with?: string;
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
  /*
    🔴 AN UNRECOGNISED CODE NEVER RENDERS ITSELF. The fallback used to be
    `?? rawError` — the raw string — and the raw string was the DATABASE's own
    message, so a couple met Postgres prose about check constraints in a red
    box on a wedding-planning site. It told them nothing they could act on and
    read as a broken product rather than a rule they could satisfy.

    🔑 THE FALLBACK IS THE WHOLE DEFECT. Every code we recognise already has
    human copy above; the only thing `?? rawError` ever printed was something
    nobody wrote for a customer to read. Anything unknown now gets one plain
    sentence, and the real message is in the server log where we can read it.
  */
  const errorMessage = rawError
    ? (ERROR_COPY[rawError] ??
      'We couldn’t create that event. Nothing was charged — please try again.')
    : null;

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
  // 🚪 A brand-new account's FIRST screen after the You card (owner 2026-10-21, prototype
  // first_run_you_and_next_steps P2): there is no board behind it yet, so no "Back to events". A count, not the
  // rows; an unread count (error) keeps the way back — the unknown never reads as "nothing behind you".
  let nothingBehind = false;
  if (user && !params.samahan) {
    const { count, error } = await supabase
      .from('event_members')
      .select('event_id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (error) logQueryError('CreateEventPage.eventCount', error, { user_id: user.id }, 'graceful_degrade');
    nothingBehind = !error && (count ?? 0) === 0;
  }

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
  //
  // 👥 "YOUR GROUPS" (owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST BE SPECIFIC"): the SAME class rule narrows the
  // grid when "For ▾" is one of the account's groups, so it is computed once here for both. Only groups this person
  // ORGANIZES are offered — the create action refuses anyone else (`samahan_not_organizer`), and a row that can only
  // fail is not offered. A refused read (logged inside `fetchUserCommunities`) offers no groups, never a wrong one.
  const myGroups =
    user && !samahan && !preselect
      ? (await fetchUserCommunities(supabase, user.id)).filter((c) => c.role === 'organizer')
      : [];
  const groupTypes =
    samahan || myGroups.length > 0
      ? (
          await Promise.all(
            eventTypes.map(async (t) =>
              (await resolveProfile(t.key)).eventClass === 'community_eligible'
                ? t
                : null,
            ),
          )
        ).filter((t): t is (typeof eventTypes)[number] => t !== null)
      : [];
  const typesForContext = samahan ? groupTypes : eventTypes;
  const groupSubjects = myGroups.map((g) =>
    buildGroupSubject({ communityId: g.community_id, name: g.name, memberCount: g.member_count }),
  );

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
    // ⚠ RLS IS NOT THE SCOPE: it admits an ADMIN to every dependent on the platform (owner 2026-10-27, on this
    // picker: "Why do i have flowerstoreph and indigocaterers" — three were other users' businesses). The rows are
    // the viewer's own loved ones still in their care (+ a real spouse's shared ones), by the ONE rule in
    // `lib/my-loved-ones.ts` — the same one the People page uses.
    const [{ data: deps, error: depsError }, { data: spouseIds, error: spouseError }] = await Promise.all([
      supabase
        .from('dependents')
        .select(
          'dependent_id, name, dependent_kind, birth_date, sex, claimed_user_id, owner_user_id, handed_over_by_user_id, shared_with_spouse, handed_over_at',
        )
        .is('handed_over_at', null),
      supabase.rpc('current_spouse_user_ids'),
    ]);
    // ⚠ the dependents this person can create an event for. Refused, the picker offers
    // ⚠ none and they cannot start an event for a child they already added.
    if (depsError) {
      logQueryError('CreateEventPage.deps', depsError, {}, 'graceful_degrade');
    }
    // Refused, a spouse's shared rows are left out — never someone else's.
    if (spouseError) logQueryError('CreateEventPage.depsSpouse', spouseError, {}, 'graceful_degrade');
    const rows: DependentSubjectRow[] = lovedOnesInMyCare(
      (deps ?? []) as Array<DependentSubjectRow & DependentOwnership>,
      user.id,
      spouseIdSet(spouseIds),
    );
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
  // `sex` IS read now — but only when it carries its RA 10173 consent stamp
  // (`sex_consent_at`). Owner 2026-10-26: "debut 17-18 woman, 20-21 men. so if no
  // gender for 17-21." Unconsented (or blank) → null → the wide 17–21 band, which
  // folds LESS: the documented fail-open direction. It sorts this picker only; it
  // is disclosed to nobody and written nowhere.
  //
  // The shop this login is standing in fills "For · A business" (owner 2026-10-26:
  // "If it is for a business …") — asked of THE resolver (`resolveActiveShopId`,
  // the one answer to "which shop am I in"), then that one shop's name. None, or a
  // refused read → the business name is asked instead.
  let subjects: CreateSubject[] = [];
  if (user && !samahan) {
    const [{ data: profile, error: profileError }, shopName] = await Promise.all([
      supabase
        .from('users')
        .select('display_name, birth_date, sex, sex_consent_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      readActiveShopName(supabase, user.id),
    ]);
    // ⚠ the account record. Absence DENIES rather than renders.
    if (profileError) {
      logQueryError('CreateEventPage.profile', profileError, {}, 'graceful_degrade');
    }
    const consentedSex = profile?.sex_consent_at ? ((profile?.sex as string | null) ?? null) : null;
    subjects = buildCreateRoster(
      buildSelfSubject((profile?.display_name as string | null) ?? null, {
        birth_date: (profile?.birth_date as string | null) ?? null,
        sex: consentedSex,
      }),
      alagaSubjects,
      shopName,
      groupSubjects,
    );
  }

  // "PLAN AN EVENT TOGETHER" (owner 2026-09-29: "add partner (to become a
  // couple)"). `?with=` names a connection; it counts only when it is a
  // CONFIRMED partner connection this account is on — anything else is
  // dropped silently and the page is the ordinary create step. Nothing is
  // created here: the two first names are only carried to the name screen.
  const together =
    user && !samahan && params.with ? await readPlanTogether(supabase, user.id, params.with) : null;

  // Life-event cardinality blocked state (council § 5 card 1): the server
  // action bounced a duplicate in-planning life event here with its id. Fetch
  // the display name so the card can say WHICH celebration is already open —
  // RLS (member-only read) naturally scopes this to the user's own events.
  let blockedLifeEvent: { eventId: string; displayName: string } | null = null;
  if (rawError === 'life_event_exists' && params.existing && user) {
    const { data: ev, error: evError } = await supabase
      .from('events')
      .select('event_id, display_name')
      .eq('event_id', params.existing)
      .maybeSingle();
    // ⚠ their existing events. Refused, the page reads as though they have made none.
    if (evError) {
      logQueryError('CreateEventPage.ev', evError, {}, 'graceful_degrade');
    }
    if (ev) blockedLifeEvent = { eventId: ev.event_id, displayName: ev.display_name };
  }

  // The heading + these notices moved INTO the picker (as `notice`) so the
  // question on screen is the question the step is actually asking — "para
  // kanino ito?" first, "what kind of event?" second — while the notices keep
  // their shipped position directly beneath it.
  const notice = (
    <>
      {together ? (
        <p className="sn-tile mb-6 flex items-center gap-2 py-3 text-sm text-ink/75" data-plan-together>
          <HeartHandshake aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={1.75} />
          <span>
            Planning together with <span className="font-medium text-ink">{together.partner}</span>
          </span>
        </p>
      ) : null}
      {samahan ? (
        <p className="sn-tile mb-6 flex items-center gap-2 py-3 text-sm text-ink/75">
          <Users aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={1.75} />
          <span>
            Planning for <span className="font-medium text-ink">{samahan.name}</span>
          </span>
          <span className="ml-auto shrink-0 rounded-full border border-ink/10 bg-white/60 dark:bg-raised px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Group
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
            planning — one event of this kind per celebrant at a time.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-mulberry px-4 py-2 text-xs font-medium text-white dark:text-cream transition-colors hover:bg-mulberry/90"
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
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 [[data-create-event-in-panel]_&]:pt-4">
      <NewEventHead nothingBehind={nothingBehind} samahan={samahan} />

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
        couple={together}
        groupTypeKeys={groupSubjects.length > 0 ? groupTypes.map((t) => t.key) : undefined}
      />
    </div>
  );
}
