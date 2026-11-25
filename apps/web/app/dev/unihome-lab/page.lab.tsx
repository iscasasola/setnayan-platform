/**
 * /dev/unihome-lab — Unihome v5 (owner-approved 23 Nov 2026; drawing `prototypes/one_profile_page_2026-11-23/
 * unihome-v5.html`) drawn with sample data inside the real signed-in shell, so it can be walked and photographed beside
 * the drawing's frames without a sign-in. Dev only (`.lab.tsx`, never compiled for production).
 *
 *   ?who=couple    — "No shop yet": Ana Reyes, one wedding she organises, one invitation, People asking 2.
 *   ?who=supplier  — "Runs a shop": Liza Santos, the shop quick view, Shop 3 new, People asking 1.
 *   ?who=new       — "New account": Paolo Cruz, nothing yet — the Example under Events.
 *   &fail=1        — every read refused: each part says it couldn't read, and no number mark is drawn.
 *
 * The bottom bar is mounted here exactly as the layout mounts it, so the lab proves Home hides it.
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { AccountBottomNav } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { Unihome, type UnihomeViewProps } from '@/app/dashboard/(launcher)/_components/unihome';
import { PlanningExample } from '@/app/dashboard/(launcher)/_components/board-examples';
import type { DiscoverEventCard } from '@/lib/discover-events-core';
import type { UnihomeEventCard } from '@/lib/unihome';

const LAB = '/dev/unihome-lab';
const photo = (key: string) => `/event-types/${key}.webp`;

function switcherFor(name: string, shop: boolean): SwitcherData {
  return {
    userId: '00000000-0000-4000-8000-0000000000ab',
    displayName: name,
    email: `${name.split(' ')[0]!.toLowerCase()}@example.com`,
    isAnonymous: false,
    photoUrl: null,
    events: [],
    eventsMeasured: true,
    context: {
      hasVendor: shop,
      vendorName: shop ? 'Liwayway Flowers & Styling' : null,
      isAdmin: false,
      canOpenShop: !shop,
      shops: shop ? [{ id: 'lab-shop', name: 'Liwayway Flowers & Styling', logoUrl: null, publicHref: '/liwayway', owned: true }] : [],
    },
    otherAccounts: [],
    canAddAccount: true,
  };
}

function card(over: Partial<UnihomeEventCard> & Pick<UnihomeEventCard, 'eventId' | 'stance' | 'title'>): UnihomeEventCard {
  return {
    key: over.eventId,
    kind: 'WEDDING',
    when: 'Sat 13 Mar 2027 · Tagaytay',
    countdown: null,
    progress: null,
    dashboardHref: over.stance === 'invited' ? null : '#dashboard',
    hubUrl: '#hub',
    scene: { eventType: 'wedding', photoSrc: photo('wedding'), ownPhotoSrc: null, cover: null },
    archived: false,
    // 📋 The card's tap menu (brief Add 40) — the organiser's full set; a helper's has no Story and no Delete.
    menu:
      over.stance === 'invited'
        ? null
        : {
            hubHref: '#hub',
            chatHref: '#chat',
            memoriesHref: '#memories',
            story: over.stance === 'organiser' ? { href: '#story-publish', open: false } : null,
            canDelete: over.stance === 'organiser',
          },
    ...over,
  };
}

function upcoming(key: string, title: string, when: string, type: string): DiscoverEventCard {
  return {
    key,
    href: '#event',
    title,
    typeLabel: null,
    datePlate: when,
    cover: title.slice(0, 2).toUpperCase(),
    scene: { kind: 'photo', src: photo(type), ground: 'main', legibility: null },
    paper: null,
    host: null,
    regionLabel: null,
    relation: 'follow',
    askHref: null,
  } as DiscoverEventCard;
}

const SUPPLIERS = [
  { key: 's1', name: 'Kusinang Bayan', sub: 'Catering · Laguna', coverUrl: photo('corporate'), sample: false, href: '#s1' },
  { key: 's2', name: 'Tala Films', sub: 'Photo & video · Manila', coverUrl: photo('wedding'), sample: false, href: '#s2' },
  { key: 's3', name: 'Mayumi Artistry', sub: 'Hair & makeup · Cavite', coverUrl: photo('debut'), sample: false, href: '#s3' },
  { key: 's4', name: 'Galaw Studio', sub: 'Video · Quezon City', coverUrl: photo('gala_night'), sample: false, href: '#s4' },
];

const UPCOMING = [
  upcoming('u1', 'Tita Lorna’s 60th', 'Sun 21 Feb · Pasig', 'birthday'),
  upcoming('u2', 'Kai’s 1st Birthday', 'Sat 6 Mar · Makati', 'celebration'),
  upcoming('u3', 'Rafa’s Christening', 'Sun 14 Mar · Taguig', 'christening'),
  upcoming('u4', 'Tito Ben & Tita Luz, 40 years', 'Sat 20 Mar · Lipa', 'anniversary'),
];

function propsFor(who: string, fail: boolean): Omit<UnihomeViewProps, 'incoming'> {
  const discover = fail
    ? { upcoming: { status: 'unavailable' as const }, suppliers: null }
    : { upcoming: { status: 'ok' as const, items: UPCOMING }, suppliers: SUPPLIERS };
  if (who === 'supplier') {
    return {
      me: { name: 'Liza Santos', photoUrl: null, photoFrame: null },
      handle: { slug: 'lizasantos', publicOn: true },
      host: 'setnayan.com',
      switcher: switcherFor('Liza Santos', true),
      events: { cards: [], invited: [], more: 0, counts: fail ? null : { planning: 0, celebrated: 0 }, worth: fail ? 'unread' : null },
      shop: {
        kind: 'owner',
        id: 'lab-shop',
        name: 'Liwayway Flowers & Styling',
        initials: 'LF',
        logoUrl: null,
        publicHref: '/liwayway',
        verified: fail ? null : true,
        coverUrl: photo('wedding'),
        newCount: fail ? null : 3,
        cards: fail ? null : { cards: 8, online: 6 },
      },
      people: {
        asking: fail ? null : 1,
        faces: fail
          ? null
          : [
              { key: 'rm', name: 'Rosa', initials: 'RM', photoUrl: null, href: '#p' },
              { key: 'dt', name: 'Dante', initials: 'DT', photoUrl: null, href: '#p' },
              { key: 'ec', name: 'Ella', initials: 'EC', photoUrl: null, href: '#p' },
              { key: 'nb', name: 'Noel', initials: 'NB', photoUrl: null, href: '#p' },
            ],
      },
      memories: fail
        ? null
        : [
            { key: 'm1', title: 'Rosa & Dante’s Wedding', sub: 'Oct 2026', photoUrl: photo('reunion'), href: '#m' },
            { key: 'm2', title: 'Ella’s Graduation', sub: 'Jul 2026', photoUrl: photo('graduation'), href: '#m' },
          ],
      discover,
    };
  }
  if (who === 'new') {
    return {
      me: { name: 'Paolo Cruz', photoUrl: null, photoFrame: null },
      handle: { slug: null, publicOn: null },
      host: 'setnayan.com',
      switcher: switcherFor('Paolo Cruz', false),
      events: { cards: [], invited: [], more: 0, counts: { planning: 0, celebrated: 0 }, worth: null },
      shop: { kind: 'create' },
      people: { asking: null, faces: [] },
      memories: [],
      discover,
      eventsExample: <PlanningExample />,
    };
  }
  return {
    me: { name: 'Ana Reyes', photoUrl: null, photoFrame: null },
    handle: { slug: 'anareyes', publicOn: true },
    host: 'setnayan.com',
    switcher: switcherFor('Ana Reyes', false),
    events: {
      cards: fail
        ? []
        : [card({ eventId: 'e1', stance: 'organiser', title: 'Ana & Miguel', countdown: '110 days to go', progress: '12 of 40 done' })],
      invited: fail
        ? []
        : [card({ eventId: 'e2', stance: 'invited', title: 'Jun & Bea’s Wedding', when: 'Sat 6 Feb 2027 · Batangas', scene: { eventType: 'wedding', photoSrc: photo('date'), ownPhotoSrc: null, cover: null } })],
      more: 0,
      counts: fail ? null : { planning: 2, celebrated: 2 },
      worth: fail ? 'unread' : { label: 'Mama’s 60th', day: '4 Jun' },
    },
    shop: fail ? { kind: 'none' } : { kind: 'create' },
    people: {
      asking: fail ? null : 2,
      faces: fail
        ? null
        : [
            { key: 'ms', name: 'Miguel', initials: 'MS', photoUrl: null, href: '#p' },
            { key: 'ln', name: 'Lola Nena', initials: 'LN', photoUrl: null, href: '#p' },
            { key: 'cr', name: 'Carla', initials: 'CR', photoUrl: null, href: '#p' },
            { key: 'jb', name: 'Jun', initials: 'JB', photoUrl: null, href: '#p' },
          ],
    },
    memories: fail
      ? null
      : [
          { key: 'm1', title: 'Mateo’s Christening', sub: 'Aug 2026', photoUrl: photo('christening'), href: '#m' },
          { key: 'm2', title: 'Carla’s Debut', sub: 'Dec 2025', photoUrl: photo('debut'), href: '#m' },
          { key: 'm3', title: 'Lola Nena’s 79th', sub: 'Jan 2026', photoUrl: photo('birthday'), href: '#m' },
          { key: 'm4', title: 'Bea’s Graduation', sub: 'Jul 2025', photoUrl: photo('graduation'), href: '#m' },
        ],
    discover,
  };
}

export default async function UnihomeLab({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const who = q.who ?? 'couple';
  const props = propsFor(who, q.fail === '1');
  return (
    <div className="sn-ambient min-h-dvh">
      <FrontDoorShell
        variant="app"
        boundary="tab"
        homePath={LAB}
        account={{ signedIn: true, initials: 'AR', shopName: who === 'supplier' ? 'Liwayway Flowers & Styling' : null, isAdmin: false, canOpenShop: who !== 'supplier', eventCount: 2 }}
        navLabels={{}}
        topBarSlot={props.switcher ? <AccountSwitcher data={props.switcher} /> : null}
      >
        <main className="sn-vt-page">
          <Unihome {...props} />
        </main>
        <AccountBottomNav tabs={['home', 'discover']} boundary="tab" />
      </FrontDoorShell>
    </div>
  );
}
