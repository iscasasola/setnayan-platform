/**
 * /dev/details-lab?access=claim — Event Details › EVENT ACCESS with suppliers
 * who joined from the couple's link waiting for Approve (owner 2026-10-20), on
 * fixture rows, no database. The REAL `PeopleWithAccess` draws it; the asks go
 * through the REAL `claimAskLine`. A press calls the real action, which has no
 * database here and answers with its refusal sentence — nothing is written.
 *
 *   &claims=0     nobody waiting (the fold as it was)
 *   &claims=fail  the read was refused (the fold says so)
 */
import { PeopleWithAccess } from '@/app/dashboard/[eventId]/details/_components/people-with-access';
import type { ClaimAccessAsk } from '@/lib/claim-access-asks';
import type { PersonRow } from '@/lib/people-with-access';

const LAB_EVENT = '00000000-0000-4000-8000-00000000ac01';

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
  person({ key: 'me', kind: 'co_host', name: 'Claire Santos', roleWord: 'Co-host', isViewer: true }),
  person({ key: 'ice', kind: 'co_host', name: 'Ice Casasola', roleWord: 'Co-host' }),
  person({ key: 'kusina', kind: 'supplier', name: 'Kusina ni Lola', roleWord: 'Catering', vendorId: 'v-kusina' }),
];

const ASKS: ClaimAccessAsk[] = [
  { requestId: 'lab-ask-planner', name: 'The Wedding Planner', categoryLabel: 'Coordinator', coordinator: true, createdAt: '2026-10-20T01:00:00Z' },
  { requestId: 'lab-ask-lente', name: 'Lente Studio', categoryLabel: 'Photographer', coordinator: false, createdAt: '2026-10-20T02:00:00Z' },
];

export function AccessClaimLab({ claims }: { claims: 'some' | 'none' | 'fail' }) {
  return (
    <div className="min-h-dvh bg-cream px-4 py-6 text-ink">
      <div className="mx-auto w-full max-w-xl">
        <h2 className="font-display text-lg">Event access</h2>
        <div className="sn-tile mt-3 p-4">
          <PeopleWithAccess
            eventId={LAB_EVENT}
            rows={ROWS}
            addable={[]}
            readOnly={false}
            failed={false}
            flash={null}
            claims={claims === 'fail' ? { measured: false, asks: [] } : { measured: true, asks: claims === 'none' ? [] : ASKS }}
          />
        </div>
      </div>
    </div>
  );
}
