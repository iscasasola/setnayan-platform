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
 */
import { notFound } from 'next/navigation';
import { EventTypePicker } from '@/app/dashboard/(account)/create-event/_components/event-type-picker';
import type { EventTypeRow } from '@/app/dashboard/(account)/create-event/_components/event-types';
import { buildCreateRoster, buildSelfSubject } from '@/lib/create-subjects';
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

export default async function CreateForLab({
  searchParams,
}: {
  searchParams: Promise<{ birth?: string; sex?: string; shop?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const types: EventTypeRow[] = TYPES.map(([key, label, emoji, forWhom]) => ({
    key,
    label,
    emoji,
    enabled: true,
    onboardingHref: null,
    forWhom,
  }));
  const self = buildSelfSubject('Ice Casasola', { birth_date: sp.birth ?? null, sex: sp.sex ?? null });
  const subjects = buildCreateRoster(self, [], sp.shop ?? null);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <EventTypePicker types={types} budgetBands={[]} subjects={subjects} todayISO={manilaToday()} />
    </div>
  );
}
