/**
 * /dev/group-lab — the group page (`/dashboard/samahan/[communityId]`) on fixture data, with no sign-in and no
 * database, inside the account layout's own wrappers (`.sn-ambient` · the `<main>` that reserves the dock · the
 * template's `.sn-page-enter` · the REAL `AccountBottomNav`). DEV-ONLY: production builds 404 this route, the same
 * kill-switch as `/dev/people-lab`.
 *
 * Why it exists (owner 2026-10-26, "a place for chat, events and stories. that's it"): the approved prototype
 * `prototypes/group_samahan_2026-10-25/` is walked side by side against THIS render — the REAL `GroupHome`,
 * `SamahanIdentityHeader` and `SamahanStories`; only the rows are fixtures.
 *
 *   (default)   an organizer · 12 members · 3 events · 6 clips · a newest message
 *   ?member=1   a member (no "Bring people in", no "Plan an event")
 *   ?empty=1    a new group — no events, no clips, no messages
 */
import { notFound } from 'next/navigation';
import { AccountBottomNav } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { GroupHome, type EventMemberType } from '@/app/dashboard/(account)/samahan/[communityId]/_components/group-home';
import { SamahanIdentityHeader } from '@/app/dashboard/(account)/samahan/[communityId]/_components/samahan-identity-header';
import type { CommunityEventRow, CommunityRosterEntry, SamahanMessage } from '@/lib/communities';
import type { SamahanStory } from '@/lib/samahan-stories';

const NAMES = ['Ice', 'Mika Reyes', 'Paolo Dizon', 'Tita Ces', 'Jun Santos', 'Bea Lim', 'Rafa Cruz', 'Ana Villanueva'];
const ROSTER: CommunityRosterEntry[] = NAMES.map((n, i) => ({
  member_row_id: i + 1,
  display_name: n,
  role: i === 0 || i === 3 ? 'organizer' : 'member',
  joined_at: '2026-08-01T00:00:00Z',
  is_self: i === 0,
}));

const EVENTS: CommunityEventRow[] = [
  { event_id: 'lab-ev-1', display_name: 'Liga ng Barangay', event_type: 'other', event_date: '2026-11-15', archived: false, slug: 'liga' },
  { event_id: 'lab-ev-2', display_name: 'Batch ’14 Reunion', event_type: 'reunion', event_date: '2026-12-27', archived: false, slug: 'reunion' },
  { event_id: 'lab-ev-3', display_name: 'Baguio Outing', event_type: 'other', event_date: null, archived: false, slug: null },
  { event_id: 'lab-ev-4', display_name: 'Valentine’s Party', event_type: 'birthday', event_date: '2027-02-14', archived: false, slug: null },
];
const MEMBERSHIPS = new Map<string, EventMemberType>([
  ['lab-ev-1', 'couple' as EventMemberType],
  ['lab-ev-2', 'couple' as EventMemberType],
]);

/** A poster stand-in — a warm gradient, like the prototype's thumbs. */
const poster = (a: string, b: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="30" height="40" fill="url(#g)"/></svg>`)}`;
const HOURS = [21, 19, 9, 4, 1];
const STORIES: SamahanStory[] = (
  [
    ['Mika', '#d9b48f', '#7a4e2a'],
    ['Paolo', '#9fb7c9', '#3c5a73'],
    ['Tita Ces', '#e3c7a1', '#a0653a'],
    ['Jun', '#b8c79a', '#4f6331'],
    ['Bea', '#d6a3a8', '#7a3d47'],
  ] as const
).map(([name, a, b], i) => ({
  story_id: `lab-st-${i}`,
  user_id: `lab-u-${i}`,
  author_name: name,
  is_self: false,
  duration_ms: 3000,
  created_at: new Date(Date.now() - (24 - HOURS[i]!) * 3_600_000).toISOString(),
  expires_at: new Date(Date.now() + HOURS[i]! * 3_600_000).toISOString(),
  clip_url: null,
  poster_url: poster(a, b),
}));

const LATEST: SamahanMessage = {
  message_id: 'lab-msg-1',
  author_name: 'Mika Reyes',
  is_self: false,
  body: 'Sino may sasakyan sa Sabado?',
  created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
};

export default async function GroupLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const empty = sp.empty === '1';
  const organizer = sp.member !== '1';
  const roster = ROSTER.map((m, i) => (i === 0 ? { ...m, role: organizer ? m.role : ('member' as const) } : m));

  return (
    <div className="sn-ambient min-h-dvh">
      <div className="flex h-[61px] items-center justify-between border-b border-ink/10 bg-paper px-4" data-lab-topbar="">
        <span className="text-[14px] font-semibold tracking-[0.18em] text-[#a9834b]">SETNAYAN</span>
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full sn-initials text-[12px] font-bold">IC</span>
      </div>
      <main className="pb-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem)] lg:pb-0">
        <div className="sn-page-enter">
          <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
            <p className="mb-3 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-medium text-ink/70">← Back to Groups</p>
            <GroupHome
              header={
                <SamahanIdentityHeader
                  communityId="lab-community"
                  name="Barkada ni Ice"
                  photoUrl={null}
                  photoDisplayUrl={null}
                  initial="B"
                  metaLine={<p className="mt-0.5 text-sm leading-snug text-ink/65">Batch ’14 ng San Roque — reunions, outings, lakad.</p>}
                />
              }
              base="/dev/group-lab"
              communityId="lab-community"
              isOrganizer={organizer}
              memberCount={empty ? 1 : 12}
              roster={empty ? roster.slice(0, 1) : roster}
              events={empty ? [] : EVENTS}
              viewerMemberships={MEMBERSHIPS}
              stories={empty ? [] : STORIES}
              storiesUnreadable={false}
              latestMessage={empty ? null : LATEST}
            />
          </div>
        </div>
      </main>
      <AccountBottomNav tabs={['events', 'discover', 'memories', 'people']} />
    </div>
  );
}
