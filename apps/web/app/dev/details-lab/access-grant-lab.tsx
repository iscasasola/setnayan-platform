/**
 * /dev/details-lab?access=grant — Event Details › EVENT ACCESS where the hosts give one person Mood Board access
 * (owner 2026-10-30: *"Only the host and whoever supplier they give access to and not all"*), on fixture rows, no
 * database. The REAL `PeopleWithAccess` draws it and every cell is the REAL `areaCells` over a seat's own grant, so
 * the toggle shows exactly what `setDelegateArea` would offer. A press calls the real action, which has no database
 * here and answers with its refusal sentence — nothing is written.
 *
 *   · a coordinator on Limited, given Mood Board Edit;
 *   · a helper left at View.
 */
import { PeopleWithAccess } from '@/app/dashboard/[eventId]/details/_components/people-with-access';
import { areaCells, type PersonRow } from '@/lib/people-with-access';
import { LIMITED_AREAS } from '@/lib/coordinator-access-level';

const LAB_EVENT = '00000000-0000-4000-8000-00000000ac02';
const NARROW = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false };

const person = (p: Partial<PersonRow> & Pick<PersonRow, 'key' | 'kind' | 'name' | 'roleWord'>): PersonRow => ({
  moderatorId: null,
  guestId: null,
  access: null,
  live: true,
  areas: null,
  lastDay: null,
  ended: false,
  isViewer: false,
  canInviteAsCoordinator: false,
  vendorId: null,
  ...p,
});

const ROWS: PersonRow[] = [
  person({ key: 'me', kind: 'co_host', name: 'Claire Santos', roleWord: 'Host', isViewer: true }),
  person({
    key: 'bea',
    kind: 'coordinator',
    name: 'Styled by Bea',
    roleWord: 'Coordinator',
    moderatorId: '00000000-0000-4000-8000-0000000b0001',
    coordinatorLevel: 'limited',
    lastDay: '2026-12-19',
    areas: areaCells({ ...NARROW, areas: { ...LIMITED_AREAS, mood_board: 'edit' } }),
  }),
  person({
    key: 'tita',
    kind: 'helper',
    name: 'Tita Lory',
    roleWord: 'Limited helper',
    moderatorId: '00000000-0000-4000-8000-0000000b0002',
    lastDay: '2026-12-19',
    areas: areaCells({ ...NARROW, areas: { ...LIMITED_AREAS } }),
  }),
  person({ key: 'kusina', kind: 'supplier', name: 'Kusina ni Lola', roleWord: 'Catering', vendorId: 'v-kusina' }),
];

export function AccessGrantLab() {
  return (
    <div className="min-h-dvh bg-cream px-4 py-6 text-ink">
      <div className="mx-auto w-full max-w-xl">
        <h2 className="font-display text-lg">Event access</h2>
        <div className="sn-tile mt-3 p-4">
          <PeopleWithAccess eventId={LAB_EVENT} rows={ROWS} addable={[]} readOnly={false} failed={false} flash={null} claims={null} />
        </div>
      </div>
    </div>
  );
}
