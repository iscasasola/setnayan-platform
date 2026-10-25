import { PeopleRosterView } from '@/app/dashboard/(account)/people/_components/people-roster-view';
import type { PeopleRoster } from '@/lib/people-roster';

/**
 * The HOST's side of `/dev/me-lab?connect=1`: People → Requests, through the shipped `PeopleRosterView` in its
 * Requests mode, fed the row the guest's tick writes (pending, unlabelled, from the event). Its own file because it
 * is not a door — the door half of the lab (`connect-hosts-lab.tsx`) never names an event's kind.
 */
export function LabHostRequests() {
  const roster: PeopleRoster = {
    people: [
      {
        key: 'lab-sarah',
        kind: 'connection',
        connectionId: 'lab-connection',
        dependentId: null,
        name: 'Sarah Bernaldo',
        relation: null,
        storedRelation: null,
        ask: null,
        sharesAnEvent: null,
        careLabel: null,
        state: 'waiting_you',
        fromEvent: { name: 'Indalecio & Claire', type: 'wedding' },
        samahan: [],
        canLabel: false,
      },
    ],
    mySamahan: [],
    samahanUnavailable: false,
    connectionsUnavailable: false,
    counts: {
      all: 1,
      connected: 0,
      waitingThem: 0,
      waitingYou: 1,
      labelAsksForYou: 0,
      unlabelled: 1,
      alaga: 0,
      samahan: 0,
    },
  };
  return (
    <PeopleRosterView
      roster={roster}
      relations={[]}
      spouseNote={null}
      initialFilter="asking"
      picker={{
        view: 'connected',
        options: [{ key: 'connected', label: 'Your people 0' }],
        gates: { showConnections: true, showDependents: false },
      }}
    />
  );
}
