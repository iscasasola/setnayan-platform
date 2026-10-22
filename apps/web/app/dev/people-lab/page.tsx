/**
 * /dev/people-lab — the account People page (`/dashboard/people`) on fixture data, with no sign-in and no
 * database, inside the account layout's own wrappers (`.sn-ambient` · the `<main>` that reserves the dock ·
 * the template's `.sn-page-enter` · the REAL `AccountBottomNav`). DEV-ONLY: production builds 404 this route,
 * the same kill-switch as `/dev/guests-lab`.
 *
 * Why it exists (owner 2026-10-22, "People must look similar to guests"): the approved prototype
 * `prototypes/people_and_memories_template_2026-10-22.html` is walked side by side against THESE renders — the
 * REAL `PeopleRosterView`, `FollowListView` and `PeopleThumb`; only the roster, the tree and the Loved ones
 * cards are fixtures (the last two read the database, so the lab hands in stand-ins of the same shape).
 *
 *   (default)       P1 — 3 connected · 1 waiting for them · 1 asking you
 *   ?empty=1        P3 — nobody yet
 *   ?fail=1         a refused read — "We couldn’t load your people…", never "Nobody here yet" or a 0
 *   ?view=requests  the rail's Requests row (opens on "asking you") · ?view=alaga (Loved ones open)
 *   ?view=following the Following list with its thumb row
 */
import { notFound } from 'next/navigation';
import { AccountBottomNav } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { PeopleRosterView } from '@/app/dashboard/(account)/people/_components/people-roster-view';
import { FollowListView } from '@/app/dashboard/(account)/people/_components/follow-list-view';
import type { PeopleRoster, RosterPerson } from '@/lib/people-roster';
import { peopleViewOptions, type PeopleView } from '@/lib/people-views';
import { TOURS } from '@/lib/tours';
import { LabTour } from './lab-tour';

const person = (p: Partial<RosterPerson> & Pick<RosterPerson, 'key' | 'name'>): RosterPerson => ({
  kind: 'connection',
  connectionId: `lab-${p.key}`,
  dependentId: null,
  relation: null,
  storedRelation: null,
  ask: null,
  sharesAnEvent: null,
  careLabel: null,
  state: 'connected',
  fromEvent: null,
  samahan: [],
  canLabel: true,
  ...p,
});

const PEOPLE: RosterPerson[] = [
  person({ key: 'tb', name: 'Tita Baby', state: 'waiting_you', canLabel: false, storedRelation: 'godchild', fromEvent: { name: 'Cale & Ice', type: 'wedding' } }),
  person({ key: 'ar', name: 'Ana Reyes', relation: 'parent', samahan: ['Sison family'] }),
  person({ key: 'bl', name: 'Bianca Lim', relation: 'friend', samahan: ['Barkada'] }),
  person({ key: 'mt', name: 'Marco Testing', samahan: ['Barkada'] }),
  person({ key: 'pm', name: 'Paolo Mendoza', state: 'waiting_them' }),
];

function roster(kind: 'full' | 'empty' | 'fail'): PeopleRoster {
  const people = kind === 'full' ? PEOPLE : [];
  return {
    people,
    mySamahan: kind === 'full' ? [{ id: 'lab-sam-1', name: 'Barkada' }, { id: 'lab-sam-2', name: 'Sison family' }] : [],
    samahanUnavailable: false,
    connectionsUnavailable: kind === 'fail',
    counts: {
      all: people.length,
      connected: kind === 'full' ? 3 : 0,
      waitingThem: kind === 'full' ? 1 : 0,
      waitingYou: kind === 'full' ? 1 : 0,
      labelAsksForYou: 0,
      unlabelled: kind === 'full' ? 1 : 0,
      alaga: kind === 'full' ? 1 : kind === 'fail' ? null : 0,
      samahan: kind === 'full' ? 2 : kind === 'fail' ? null : 0,
    },
  };
}

/** Stand-ins for the two server sections that read the database — the same words, no read. */
function TreeStandIn({ empty }: { empty: boolean }) {
  return empty ? (
    <p className="text-sm text-ink/65">
      Once you and your closest people confirm each other, the rest works itself out — lolo and lola, tito and tita,
      pinsan and apo appear here on their own. You never add them.
    </p>
  ) : (
    <div className="pb-3">
      <p className="mb-2 text-[13px] text-ink/60">Worked out from the people you’ve both confirmed — never from a request still waiting on an answer.</p>
      {[
        ['Lolo', 'Ben Reyes', 'Ana Reyes'],
        ['Tita', 'Mila Santos', 'Ana Reyes'],
      ].map(([kin, name, via]) => (
        <div key={name} className="flex min-h-[56px] flex-wrap items-center gap-x-2.5 border-t border-ink/10 py-2.5">
          <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-medium text-ink">{kin}</span>
          <span className="text-sm font-medium text-ink">{name}</span>
          <span className="ml-auto text-[13px] text-ink/60">through {via}</span>
        </div>
      ))}
    </div>
  );
}

export default async function PeopleLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const kind = sp.fail === '1' ? 'fail' : sp.empty === '1' ? 'empty' : 'full';
  const r = roster(kind);
  const view = (typeof sp.view === 'string' ? sp.view : 'connected') as PeopleView;
  const gates = { showConnections: true, showDependents: true };
  const options = peopleViewOptions(gates, {
    requests: r.counts.waitingYou,
    connected: kind === 'fail' ? null : r.counts.connected,
    following: kind === 'full' ? 4 : 0,
    followers: kind === 'full' ? 6 : 0,
    alaga: r.counts.alaga,
    samahan: r.counts.samahan,
  });
  const picker = {
    view: (['following', 'followers'].includes(view) ? view : 'connected') as PeopleView,
    options: options.filter((o) => o.key !== 'requests' && o.key !== 'alaga').map((o) => (o.key === 'connected' ? { ...o, label: o.label.replace(/^Connected/, 'Your people') } : o)),
    gates,
  };
  const lovedOnes = (
    <div className="pb-3" data-people-view="alaga">
      <p className="py-2 text-sm text-ink/65">{kind === 'full' ? 'Lola Nena · In your care' : 'No loved ones yet.'}</p>
    </div>
  );

  return (
    <div className="sn-ambient min-h-dvh">
      <div className="flex h-[61px] items-center justify-between border-b border-ink/10 bg-paper px-4" data-lab-topbar="">
        <span className="text-[14px] font-semibold tracking-[0.18em] text-[#a9834b]">SETNAYAN</span>
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#a9834b] text-[12px] font-bold text-white">IC</span>
      </div>
      <main className="pb-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem)] lg:pb-0">
        <div className="sn-page-enter">
          <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
            {view === 'following' || view === 'followers' ? (
              <FollowListView which={view} list={{ rows: [], unavailable: kind === 'fail' }} total={0} picker={picker} />
            ) : (
              <PeopleRosterView
                roster={r}
                relations={['partner', 'parent', 'child', 'sibling', 'godparent', 'godchild', 'friend']}
                spouseNote={null}
                picker={picker}
                initialFilter={view === 'requests' ? 'asking' : 'all'}
                focus={view === 'alaga' ? 'alaga' : null}
                extra={[
                  // ?noalaga=1 — an account without Loved ones (the gate off): the People tour's middle stop is skipped.
                  ...(sp.noalaga === '1' ? [] : [{ key: 'alaga' as const, label: 'Loved ones', count: r.counts.alaga, node: lovedOnes }]),
                  { key: 'tree', label: 'Your connection tree', count: null, folded: true, node: <TreeStandIn empty={kind !== 'full'} /> },
                ]}
              />
            )}
          </div>
        </div>
      </main>
      <AccountBottomNav tabs={['events', 'discover', 'memories', 'people']} />
      {/* 🔦 ?tour=bar | people — the account screens' spotlights on this fixture (help-sync, 2026-10-22). */}
      {sp.tour === 'bar' || sp.tour === 'people' ? (
        <LabTour
          tourKey={sp.tour === 'bar' ? 'customer_account_bar_v1' : 'customer_people_v2'}
          script={TOURS[sp.tour === 'bar' ? 'customer_account_bar_v1' : 'customer_people_v2'].spotlight!}
        />
      ) : null}
    </div>
  );
}
