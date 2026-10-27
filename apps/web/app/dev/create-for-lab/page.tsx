/**
 * /dev/create-for-lab — the create-event grid's "For ▾" on fixtures: no sign-in, no database.
 * DEV-ONLY: production builds 404 it, the same kill-switch as `/dev/onboarding-lab`.
 *
 * Mounts the REAL `EventTypePicker` with the twenty production types and the `for_whom` rule exactly as
 * migration 20271292363990 seeds it, so the owner's 2026-10-26 ruling can be walked before it is applied.
 * Never press a type's create button here: the inline form calls the real action.
 *
 *   ?birth=YYYY-MM-DD   the account holder's own saved birthday (default: none — unmeasured)
 *   ?sex=female|male    their consented sex (default: none)
 *   ?shop=<name>        they own a shop of this name (default: none)
 *   ?groups=1           they organize two groups (owner 2026-10-28, "Your groups" — prototype who_is_it_for_2026-10-28)
 *   ?for=<row id>       open on that "For ▾" row (`self` · `unspecified` · `business` · `memorial` · `group:g-batch`)
 *
 * "Celebration" is listed with `enabled: false` and filtered exactly as `getCreatableEventTypes` filters production
 * (migration 20271294233183 hides it from couples — owner 2026-10-28, "Celebration removed").
 */
import { notFound } from 'next/navigation';
import { EventTypePicker } from '@/app/dashboard/(account)/create-event/_components/event-type-picker';
import type { EventTypeRow } from '@/app/dashboard/(account)/create-event/_components/event-types';
import { buildCreateRoster, buildGroupSubject, buildSelfSubject } from '@/lib/create-subjects';
import { manilaToday } from '@/lib/std-views';

export const dynamic = 'force-dynamic';

const B = ['self', 'someone', 'business'];
/** Production's twenty, in roster order, with migration 20271292363990's seed. */
const TYPES: Array<[string, string, string, string[]]> = [
  ['wedding', 'Wedding', '💍', ['self', 'someone']],
  ['debut', 'Debut', '👑', ['self', 'someone']],
  ['gender_reveal', 'Gender Reveal', '🎈', ['self', 'someone']],
  ['birthday', 'Birthday', '🎂', ['self', 'someone']],
  ['celebration', 'Celebration', '🥂', B],
  ['travel', 'Travel', '✈️', B],
  ['corporate', 'Corporate', '🏢', ['someone', 'business']],
  ['tournament', 'Tournament', '🏆', B],
  ['christening', 'Christening', '🕯️', ['someone']],
  ['anniversary', 'Anniversary', '💞', ['self', 'someone', 'memorial', 'business']],
  ['graduation', 'Graduation', '🎓', ['self', 'someone']],
  ['reunion', 'Reunion', '🤝', ['self', 'someone']],
  ['gala_night', 'Gala Night', '🌟', B],
  ['simple_event', 'Get-together', '🍻', B],
  ['date', 'Date', '🌹', ['self', 'someone']],
  ['hangout', 'Hangout', '☕', ['self', 'someone']],
  ['wake', 'Wake', '🕊️', ['memorial']],
  ['concert', 'Concert', '🎤', B],
  ['open_house', 'Open house', '🏠', B],
  ['grand_opening', 'Grand opening', '🎀', ['someone', 'business']],
];

/** Hidden from couples in production since migration 20271294233183 (`enabled = FALSE`). */
const NOT_IN_THE_PICKER = new Set(['celebration']);

/** `event_type_profiles.event_class = 'community_eligible'` in production — what a group may hold. */
const GROUP_TYPES = [
  'simple_event', 'corporate', 'travel', 'celebration', 'tournament', 'reunion', 'anniversary',
  'concert', 'open_house', 'grand_opening', 'gala_night', 'date', 'hangout',
];

const GROUPS = [
  buildGroupSubject({ communityId: 'g-batch', name: 'Batch 2010 Samahan', memberCount: 42 }),
  buildGroupSubject({ communityId: 'g-family', name: 'Casasola Family', memberCount: 18 }),
];

export default async function CreateForLab({
  searchParams,
}: {
  searchParams: Promise<{ birth?: string; sex?: string; shop?: string; groups?: string; for?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const types: EventTypeRow[] = TYPES.map(([key, label, emoji, forWhom]) => ({
    key,
    label,
    emoji,
    enabled: !NOT_IN_THE_PICKER.has(key),
    onboardingHref: null,
    forWhom,
  })).filter((t) => t.enabled);
  const self = buildSelfSubject('Ice Casasola', { birth_date: sp.birth ?? null, sex: sp.sex ?? null });
  const groups = sp.groups === '1' ? GROUPS : [];
  const subjects = buildCreateRoster(self, [], sp.shop ?? null, groups);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <EventTypePicker
        types={types}
        budgetBands={[]}
        subjects={subjects}
        todayISO={manilaToday()}
        groupTypeKeys={groups.length > 0 ? types.filter((t) => GROUP_TYPES.includes(t.key)).map((t) => t.key) : undefined}
        initialSubjectId={sp.for}
      />
    </div>
  );
}
