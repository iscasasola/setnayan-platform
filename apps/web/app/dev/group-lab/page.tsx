/**
 * /dev/group-lab — the group page (`/dashboard/samahan/[communityId]`) on fixture data, with no sign-in and no
 * database, inside the account layout's own wrappers (`.sn-ambient` · the `<main>` that reserves the dock · the
 * template's `.sn-page-enter` · the REAL `AccountBottomNav`). DEV-ONLY: production builds 404 this route, the same
 * kill-switch as `/dev/people-lab`.
 *
 * Why it exists: the approved prototypes are walked side by side against THIS render — the REAL `GroupHome` →
 * `GroupChatroom`, `SamahanStories` and the collage; only the rows are fixtures. Since 2026-10-28 the group page IS A
 * CHATROOM (prototypes/groups_chatroom_2026-10-28), so the fixture carries a chat: messages, a new event's card, and
 * stories across three hours — two ENDED hours post as collages (6 clips at one, 2 at the other) and the current hour
 * has not posted yet. A few clips are real (the public `realstories` vclips) so the tiles really play.
 *
 *   (default)   an organizer · 12 members · 4 events · a chat with two collages
 *   ?member=1   a member (no "Bring people in", no "Plan an event"; the pinned event is one they are invited to)
 *   ?empty=1    a new group — no events, no clips, no messages
 *   ?refused=1  the Usapan read was refused (the chat says so instead of "No one has said anything yet")
 */
import { notFound } from 'next/navigation';
import { AccountBottomNav } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { GroupHome, type EventMemberType } from '@/app/dashboard/(account)/samahan/[communityId]/_components/group-home';
import type { SamahanMessage } from '@/lib/communities';
import type { ChatEvent } from '@/lib/samahan-chatroom';
import type { SamahanStory } from '@/lib/samahan-stories';

const H = 3_600_000;

/** A poster stand-in — a warm gradient, like the prototype's thumbs. */
const poster = (a: string, b: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="30" height="40" fill="url(#g)"/></svg>`)}`;

const CLIPS = ['/realstories/jack-jill-vclip.mp4', '/realstories/maria-juan-vclip.mp4', '/realstories/john-jane-vclip.mp4'];
const PEOPLE = [
  ['Mika', '#c89f7a', '#4b2f22'],
  ['Paolo', '#9fb3c8', '#2b3b4e'],
  ['Tita Ces', '#b8c79a', '#344326'],
  ['Jun', '#d4a3a8', '#4d2a30'],
  ['Lea', '#c6b48a', '#3e3420'],
  ['Ice', '#a7a0c9', '#2e2a4b'],
] as const;

/** The fixture day, laid out from the render's own clock. */
function fixtures(now: number) {
  const hourStart = Math.floor(now / H) * H;
  const h3 = hourStart - 3 * H; // an ended hour — six clips → "· 6 stories"
  const h1 = hourStart - 1 * H; // an ended hour — two clips
  const story = (i: number, at: number, self = false, clip?: string): SamahanStory => {
    const [name, a, b] = PEOPLE[i % PEOPLE.length]!;
    return {
      story_id: `lab-st-${i}-${at}`,
      user_id: `lab-u-${i}`,
      author_name: name,
      is_self: self,
      duration_ms: 3000,
      created_at: new Date(at).toISOString(),
      expires_at: new Date(at + 24 * H).toISOString(),
      clip_url: clip ?? null,
      poster_url: poster(a, b),
    };
  };
  const stories: SamahanStory[] = [
    // newest first, as the read returns them
    story(1, hourStart + 2 * 60_000, false, CLIPS[0]), // this hour — not posted yet
    story(0, h1 + 40 * 60_000),
    story(3, h1 + 12 * 60_000, false, CLIPS[1]),
    ...[0, 1, 2, 3, 4, 5].map((i) => story(i, h3 + (50 - i * 8) * 60_000, i === 5, i < 3 ? CLIPS[i] : undefined)),
  ];
  const msg = (id: number, who: string, body: string, at: number, self = false): SamahanMessage => ({
    message_id: `lab-msg-${id}`,
    author_name: who,
    is_self: self,
    body,
    created_at: new Date(at).toISOString(),
  });
  const messages: SamahanMessage[] = [
    msg(1, 'Mika Reyes', 'Sino may sasakyan sa Sabado?', h3 - 50 * 60_000),
    msg(2, 'Ice', 'Ako, 4 seats pa 🚗', h3 - 45 * 60_000, true),
    msg(3, 'Paolo Dizon', 'Haha ang ganda ng collage 😂', h3 + H + 10 * 60_000),
    msg(4, 'Jun Santos', 'See you sa Liga!', h1 + H - 20 * 60_000 + 25 * 60_000),
  ];
  const events: ChatEvent[] = [
    { event_id: 'lab-ev-1', display_name: 'Liga ng Barangay', event_type: 'other', event_date: isoDay(now + 18 * 24 * H), archived: false, slug: 'liga', created_at: new Date(now - 9 * 24 * H).toISOString() },
    { event_id: 'lab-ev-2', display_name: 'Batch ’14 Reunion', event_type: 'reunion', event_date: isoDay(now + 60 * 24 * H), archived: false, slug: 'reunion', created_at: new Date(h3 - 30 * 60_000).toISOString() },
    { event_id: 'lab-ev-3', display_name: 'Baguio Outing', event_type: 'other', event_date: null, archived: false, slug: null, created_at: null },
    { event_id: 'lab-ev-4', display_name: 'Valentine’s Party', event_type: 'birthday', event_date: isoDay(now + 109 * 24 * H), archived: false, slug: null, created_at: null },
  ];
  return { stories, messages, events };
}

function isoDay(at: number): string {
  return new Date(at).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export default async function GroupLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const empty = sp.empty === '1';
  const organizer = sp.member !== '1';
  const refused = sp.refused === '1';
  const now = Date.now();
  const fx = fixtures(now);
  const memberships = new Map<string, EventMemberType>(
    organizer
      ? [
          ['lab-ev-1', 'couple' as EventMemberType],
          ['lab-ev-2', 'couple' as EventMemberType],
        ]
      : [
          ['lab-ev-1', 'guest' as EventMemberType],
          ['lab-ev-2', 'guest' as EventMemberType],
        ],
  );

  return (
    <div className="sn-ambient min-h-dvh">
      <div className="flex h-[61px] items-center justify-between border-b border-ink/10 bg-paper px-4" data-lab-topbar="">
        <span className="text-[14px] font-semibold tracking-[0.18em] text-[#a9834b]">SETNAYAN</span>
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full sn-initials text-[12px] font-bold">IC</span>
      </div>
      <main className="pb-[max(calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem),var(--sn-thumb-room,0px))] lg:pb-[var(--sn-thumb-room,0px)]">
        <div className="sn-page-enter">
          <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6 lg:px-8">
            {sp.tab ? (
              <p className="mb-2 text-xs text-ink/55" data-lab-tab={String(sp.tab)}>
                Lab: the live page opens the {String(sp.tab)} list here.
              </p>
            ) : null}
            <GroupHome
              base="/dev/group-lab"
              communityId="lab-community"
              name="Barkada ni Ice"
              photoDisplayUrl={null}
              initial="BI"
              isOrganizer={organizer}
              memberCount={empty ? 1 : 12}
              events={empty ? [] : fx.events}
              viewerMemberships={memberships}
              stories={empty ? [] : fx.stories}
              storiesUnreadable={false}
              messages={empty || refused ? [] : fx.messages}
              messagesUnreadable={refused}
              nowMs={now}
            />
          </div>
        </div>
      </main>
      <AccountBottomNav tabs={['events', 'discover', 'memories', 'people']} />
    </div>
  );
}
