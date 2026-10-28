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
 *   ?person=S89U-LABANA0001  the deep link a shell search result writes (owner 2026-10-22) — Ana's card open
 *   ?found=1        the "On Setnayan" card a stranger's result opens (FoundPersonCard, a fixture hit)
 *   ?view=samahan   People › Groups (owner 2026-10-28): the pinned row Groups ▾ · counts · ＋ New · ⚙ over the chat rows
 *                   (`PeopleGroupsView`) — prototype user_dash_2026-10-28 C/D. Every view wears the pinned row.
 *   ?groupsfail=1   the group list refused · ?activityfail=1 the one activity read refused (rows keep their line)
 *   ?unreadfail=1   the unread counts refused — the Groups door says "Couldn't load", no badge anywhere
 *   ?long=1         30 extra people, so the page scrolls under the pinned row
 */
import { notFound } from 'next/navigation';
import { AccountBottomNav } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { PeopleRosterView } from '@/app/dashboard/(account)/people/_components/people-roster-view';
import { FollowListView } from '@/app/dashboard/(account)/people/_components/follow-list-view';
import { FoundPersonCard } from '@/app/dashboard/(account)/people/_components/found-person-card';
import { GroupsFoldList, type GroupsFoldRow } from '@/app/dashboard/(account)/people/_components/samahan-people-section';
import { PeopleGroupsView } from '@/app/dashboard/(account)/people/_components/people-groups-view';
import type { PeopleRoster, RosterPerson } from '@/lib/people-roster';
import { peopleViewOptions, pinnedViewOptions, type PeopleView } from '@/lib/people-views';
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

const MANY: RosterPerson[] = Array.from({ length: 30 }, (_, i) => person({ key: `x${i}`, name: `Friend ${i + 1}`, relation: 'friend' }));

const PEOPLE: RosterPerson[] = [
  person({ key: 'tb', name: 'Tita Baby', state: 'waiting_you', canLabel: false, storedRelation: 'godchild', fromEvent: { name: 'Cale & Ice', type: 'wedding' }, publicId: 'S89U-LABTIT0001' }),
  person({ key: 'ar', name: 'Ana Reyes', relation: 'parent', samahan: ['Sison family'], publicId: 'S89U-LABANA0001' }),
  person({ key: 'bl', name: 'Bianca Lim', relation: 'friend', samahan: ['Barkada'], publicId: 'S89U-LABBIA0001', slug: 'bianca-lim' }),
  // No account handle → the row stays as it was (the card opens), the one plain-text case.
  person({ key: 'mt', name: 'Marco Testing', samahan: ['Barkada'] }),
  person({ key: 'es', name: 'Elise Santos', publicId: 'S89U-LABELI0001' }),
  person({ key: 'pm', name: 'Paolo Mendoza', state: 'waiting_them', relation: 'partner', publicId: 'S89U-LABPAO0001' }),
];

/** The Groups rows — chat rows (owner 2026-10-28): a ring while stories are live · the last line · its time · the next
 *  event · an unread badge (owner 2026-10-28, GROUP UNREAD). The prototype's three groups (user_dash_2026-10-28 B–D). */
const GROUPS: GroupsFoldRow[] = [
  { communityId: 'lab-sam-1', name: 'Barkada ni Ice', role: 'organizer', memberCount: 12, stories: 3, last: { who: 'Mika', body: 'Sino may sasakyan sa Sabado?', when: '2m' }, nextEvent: { label: '15 Nov · Liga ng Barangay' }, unread: 3 },
  { communityId: 'lab-sam-2', name: 'Sison family', role: 'member', memberCount: 8, stories: 6, last: { who: 'Tita Ces', body: 'Salamat po!', when: '1h' }, nextEvent: { label: '27 Dec · Reunion' }, unread: 1 },
  { communityId: 'lab-sam-3', name: 'Batch ’14', role: 'member', memberCount: 41, stories: 0, last: { who: 'Paolo', body: 'See you sa Liga!', when: 'Mon' }, nextEvent: null, unread: 0 },
];

/** The second degree under the Groups view's rows — a stand-in for the server section (it reads the database). */
function SecondDegreeStandIn() {
  return (
    <div data-lab-second-degree="">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55">Through your groups — second degree</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {['Mika Santos · Barkada ni Ice', 'Tito Ben · Sison family'].map((t) => (
          <li key={t} className="inline-flex items-center rounded-full border border-ink/10 py-1 pl-3 pr-3 text-xs text-ink/70">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The note an unmarried account's card carries (`spouseAbsenceNote`, lib/people-add.ts) — the owner's sheet had it. */
const SPOUSE_NOTE =
  'Getting married on Setnayan? Your spouse can be added once the wedding day has passed — or set “Married” on your profile to add them now.';

/** ?view=following|followers — a connected friend with a slug, one without (linked by S89U-…), a host you follow. */
const FOLLOWS = [
  { publicId: 'S89U-LABBIA0001', slug: 'bianca-lim', name: 'Bianca Lim', photoUrl: null, publicProfile: false, connected: true, mutual: true, since: '2026-09-12T00:00:00Z' },
  { publicId: 'S89U-LABANA0001', slug: null, name: 'Ana Reyes', photoUrl: null, publicProfile: false, connected: true, mutual: true, since: '2026-08-02T00:00:00Z' },
  { publicId: 'S89U-LABHOS0001', slug: null, name: 'Mika Santos', photoUrl: null, publicProfile: true, connected: false, mutual: false, since: '2026-10-01T00:00:00Z' },
];

function roster(kind: 'full' | 'empty' | 'fail', long = false): PeopleRoster {
  const people = kind === 'full' ? (long ? [...PEOPLE, ...MANY] : PEOPLE) : [];
  return {
    people,
    mySamahan: kind === 'full' ? GROUPS.map((g) => ({ id: g.communityId, name: g.name })) : [],
    samahanUnavailable: false,
    connectionsUnavailable: kind === 'fail',
    counts: {
      all: people.length,
      connected: kind === 'full' ? (long ? 34 : 4) : 0,
      waitingThem: kind === 'full' ? 1 : 0,
      waitingYou: kind === 'full' ? 1 : 0,
      labelAsksForYou: 0,
      unlabelled: kind === 'full' ? 2 : 0,
      alaga: kind === 'full' ? 1 : kind === 'fail' ? null : 0,
      samahan: kind === 'full' ? GROUPS.length : kind === 'fail' ? null : 0,
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
  const r = roster(kind, sp.long === '1');
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
    view: (['following', 'followers', 'samahan'].includes(view) ? view : 'connected') as PeopleView,
    options: options.filter((o) => o.key !== 'requests' && o.key !== 'alaga').map((o) => (o.key === 'connected' ? { ...o, label: o.label.replace(/^Connected/, 'Your people') } : o)),
    gates,
  };
  // 📌 The pinned row's picker + People settings (owner 2026-10-28). ?findfail=1 — the setting's read refused.
  const pin = { options: pinnedViewOptions(options), settings: { findable: sp.findfail === '1' ? null : true } };
  const groupsRefused = sp.groupsfail === '1' || kind === 'fail';
  const unreadRefused = sp.unreadfail === '1';
  const groupRows = groupsRefused || kind === 'empty' ? [] : unreadRefused ? GROUPS.map((g) => ({ ...g, unread: null })) : GROUPS;
  const lovedOnes = (
    <div className="pb-3" data-people-view="alaga">
      <p className="py-2 text-sm text-ink/65">{kind === 'full' ? 'Lola Nena · In your care' : 'No loved ones yet.'}</p>
    </div>
  );

  return (
    <div className="sn-ambient min-h-dvh">
      <div className="flex h-[61px] items-center justify-between border-b border-ink/10 bg-paper px-4" data-lab-topbar="">
        <span className="text-[14px] font-semibold tracking-[0.18em] text-[#a9834b]">SETNAYAN</span>
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full sn-initials text-[12px] font-bold" data-tour="account-avatar">IC</span>
      </div>
      <main className="pb-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem)] lg:pb-0">
        <div className="sn-page-enter">
          <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
            {view === 'samahan' ? (
              <div className="mx-auto w-full max-w-3xl pb-24">
                <PeopleGroupsView rows={groupRows} unreadable={groupsRefused} unreadUnreadable={unreadRefused} activityUnreadable={sp.activityfail === '1'} picker={picker} pin={pin}>
                  {kind === 'full' ? <SecondDegreeStandIn /> : null}
                </PeopleGroupsView>
              </div>
            ) : view === 'following' || view === 'followers' ? (
              <FollowListView
                which={view}
                list={{ rows: kind === 'full' ? FOLLOWS : [], unavailable: kind === 'fail' }}
                total={kind === 'full' ? FOLLOWS.length : 0}
                picker={picker}
              />
            ) : (
              <PeopleRosterView
                roster={r}
                relations={['partner', 'parent', 'child', 'sibling', 'godparent', 'godchild', 'friend']}
                spouseNote={SPOUSE_NOTE}
                picker={picker}
                pin={pin}
                initialFilter={view === 'requests' ? 'asking' : 'all'}
                focus={view === 'alaga' ? 'alaga' : null}
                openPerson={typeof sp.person === 'string' ? sp.person : null}
                extra={[
                  // ?noalaga=1 — an account without Loved ones (the gate off): the People tour's middle stop is skipped.
                  ...(sp.noalaga === '1' ? [] : [{ key: 'alaga' as const, label: 'Loved ones', count: r.counts.alaga, node: lovedOnes }]),
                  // Groups — the REAL section's list (`GroupsFoldList`) on fixture rows (the reader asks the database).
                  { key: 'groups', label: 'Groups', count: r.counts.samahan, node: <GroupsFoldList groups={groupRows} unreadable={groupsRefused} activityUnreadable={sp.activityfail === '1'} /> },
                  { key: 'tree', label: 'Your connection tree', count: null, folded: true, node: <TreeStandIn empty={kind !== 'full'} /> },
                ]}
              />
            )}
          </div>
        </div>
      </main>
      {sp.found === '1' ? (
        <FoundPersonCard
          hit={{
            publicId: 'S89U-LABMAR0001',
            name: 'Marisol Tan',
            photoUrl: null,
            fullName: 'Marisol Reyes Tan',
            handle: '@marisol',
            hint: 'Both at Ana & Miguel',
            followable: true,
            following: false,
          }}
        />
      ) : null}
      <AccountBottomNav tabs={['events', 'discover', 'memories', 'people']} />
      {/* 🔦 ?tour=bar | people — the account screens' spotlights on this fixture (help-sync, 2026-10-22). */}
      {sp.tour === 'bar' || sp.tour === 'people' ? (
        <LabTour
          tourKey={sp.tour === 'bar' ? 'customer_account_bar_v2' : 'customer_people_v3'}
          script={TOURS[sp.tour === 'bar' ? 'customer_account_bar_v2' : 'customer_people_v3'].spotlight!}
        />
      ) : null}
    </div>
  );
}
