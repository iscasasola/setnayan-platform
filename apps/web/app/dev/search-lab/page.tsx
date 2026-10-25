/**
 * /dev/search-lab — the signed-in search, before and after "search stays in
 * the shell" (owner 2026-10-22: *"I tried to search for seda and brought me
 * here away from our shell"*). DEV-ONLY; production 404s it.
 *
 * Every piece is the SHIPPED component; only the account and its index are
 * fixtures (no sign-in, no database — the shop and reading searches fail soft
 * to none, which is what an unpublished supplier meets anyway):
 *   ?state=before  — the old first hop: the front door (`/?q=`) as a member saw
 *                    it — the public top bar (its "+ Create event" left on 2026-10-22), no account
 *                    bar, the old index (no suppliers), and the row that hands
 *                    the words to `/explore`.
 *   ?state=after   — `/dashboard/search?q=` as the `(account)` layout draws it:
 *                    the app top bar, the account bar, the supplier on your
 *                    event tagged "On your event".
 *   ?state=empty   — the shell's empty state for a word nothing matches.
 *   ?state=discover — DISCOVER ANSWERS IN PLACE (owner 2026-10-24): Discover as a member sees it — its sections,
 *                    its own search row and the account bar; Enter puts the words in THIS address's `?q=` and the
 *                    results take the sections' place under the same row; ✕ / Clear bring the sections back. Nothing
 *                    found → "＋ Add “…” as your own supplier", the shipped add walk with this lab's stand-ins.
 *   &q=…           — the words (default "seda"; try "ana" for people).
 *   &people=fail   — the People read refused: "We couldn't search people…", never "nobody".
 *   &events=fail   — the events read refused: "We couldn't search events…", never "nothing" (owner 2026-10-25:
 *                    Discover's results are EVENTS · PEOPLE · SUPPLIERS — try "cale", "ana", "santos").
 *   The People rows (owner 2026-10-22) are the shipped builder `shellPeopleResults` over a fixture roster
 *   and fixture hits — each opens `/dashboard/people?person=…`.
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { FrontDoorResults } from '@/app/_components/frontdoor/front-door-results';
import { loadFrontDoorArticles, loadFrontDoorData } from '@/app/_components/frontdoor/data';
import { FrontDoorFeed } from '@/app/_components/frontdoor/front-door-feed';
import { DiscoverThumbRow } from '@/app/_components/frontdoor/shell-thumb-rows';
import { renderUrlQrSvg } from '@/lib/qr';
import { LAB_CLAIM_URL } from '@/app/dev/suppliers-lab/fixtures';
import { LabAddOwn } from './lab-add-own';
import { AccountBarSlot } from '@/app/dashboard/(launcher)/_components/account-bar-slot';
import type { HomeCommandItem } from '@/app/_components/frontdoor/command-item';
import { ownSupplierItems } from '@/lib/own-supplier-items';
import { shellPeopleResults } from '@/lib/shell-people-results';
import type { RosterPerson } from '@/lib/people-roster';
import { matchesCommandQuery } from '@/lib/command-match';
import { discoverCardMatchable, type DiscoverEventCard } from '@/lib/discover-events-core';

export const dynamic = 'force-dynamic';

const EVENT_ID = 'S89E-LABCALEICE';
const EVENTS = [{ event_id: EVENT_ID, display_name: 'Cale & Ice' }];

const EVENT_ITEMS: HomeCommandItem[] = [
  {
    id: `event-${EVENT_ID}`,
    label: 'Cale & Ice',
    sublabel: 'KASAL · Dec 12 · Seda Vertis North',
    href: `/dashboard/${EVENT_ID}`,
    kind: 'event',
    icon: 'calendar',
  },
];

/** The owner's case: a supplier added by hand and booked — no Setnayan account, never published. */
const SUPPLIER_ITEMS = ownSupplierItems(EVENTS, [
  { vendor_id: 'lab-seda', event_id: EVENT_ID, vendor_name: 'Seda Vertis North', archived_at: null, marketplace_vendor_id: null },
  { vendor_id: 'lab-saysay', event_id: EVENT_ID, vendor_name: 'Saysay Studio', archived_at: null },
]);

/** "What they do" for the lab's event — a few of a wedding's rows, as `readAddOwnCategories` shapes them. */
const LAB_ADD_OWN_CATEGORIES = [
  { category: 'catering', tile: 'catering', label: 'Catering', group: 'Food & drinks' },
  { category: 'cake_maker', tile: 'cake', label: 'Cake', group: 'Food & drinks' },
  { category: 'photographer', tile: 'photo_video', label: 'Photo & video', group: 'Capture' },
  { category: 'live_band', tile: 'live_band', label: 'Live band', group: 'Music' },
];

const labPerson = (key: string, name: string, extra: Partial<RosterPerson> = {}): RosterPerson => ({
  key,
  name,
  kind: 'connection',
  connectionId: `lab-${key}`,
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
  ...extra,
});
const LAB_ROSTER = {
  connectionsUnavailable: false,
  people: [
    labPerson('ar', 'Ana Reyes', { relation: 'parent', publicId: 'S89U-LABANA0001' }),
    labPerson('ac', 'Anabel Cruz', { state: 'waiting_them', publicId: 'S89P-LABANB0001' }),
    labPerson('bl', 'Bianca Lim', { relation: 'friend', publicId: 'S89U-LABBIA0001' }),
  ],
};
const LAB_HITS = [
  { publicId: 'S89U-LABMAR0001', name: 'Ana Santos', photoUrl: null, fullName: null, handle: '@anasantos', hint: 'Both at Cale & Ice', followable: true, following: false },
];

/** Discover's event matches (owner 2026-10-25) — one from a person you are connected to, two public ones. */
const labEvent = (key: string, title: string, slug: string, host: string | null, relation: DiscoverEventCard['relation'], datePlate: string): DiscoverEventCard => ({
  key,
  href: `/${slug}`,
  title,
  typeLabel: 'Wedding',
  datePlate,
  cover: title.slice(0, 1),
  scene: null,
  paper: null,
  host: host ? { name: host, slug: slug.split('-')[0]! } : null,
  regionLabel: 'Metro Manila',
  relation,
  askHref: null,
});
const LAB_EVENTS: DiscoverEventCard[] = [
  labEvent('lab-e1', 'Ana & Paolo', 'ana-and-paolo', 'Ana Reyes', 'connected', 'Sat 14 Nov'),
  labEvent('lab-e2', 'Cale’s 30th', 'cales-30th', null, null, 'Fri 4 Dec'),
  labEvent('lab-e3', 'Santos Family Reunion', 'santos-reunion', 'Ana Santos', null, 'Sun 20 Dec'),
];

const Avatar = () => (
  <span className="grid h-11 w-11 place-items-center rounded-full sn-initials text-xs font-semibold">IC</span>
);

export default async function SearchLabPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string; people?: string; events?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const state = sp.state === 'before' || sp.state === 'empty' || sp.state === 'discover' ? sp.state : 'after';
  const query = (sp.q ?? (state === 'empty' ? 'xyzzy' : state === 'discover' ? '' : 'seda')).trim();
  const account = { signedIn: true, initials: 'IC', shopName: null, isAdmin: false } as const;

  if (state === 'before') {
    // The old index: events and jump rows, no suppliers.
    return (
      <FrontDoorShell
        account={account}
        navLabels={{}}
        topBarSlot={<Avatar />}
        search={false /* the top bar has no search since 2026-10-22 ("One thumb row") */}
      >
        <div data-search-lab="before">
          <FrontDoorResults query={query} data={{ articles: loadFrontDoorArticles() }} commandItems={EVENT_ITEMS} />
        </div>
      </FrontDoorShell>
    );
  }

  const items = [...EVENT_ITEMS, ...SUPPLIER_ITEMS];
  const people = shellPeopleResults({
    query,
    roster: sp.people === 'fail' ? null : LAB_ROSTER,
    found: sp.people === 'fail' ? { hits: [], failed: true } : { hits: LAB_HITS.filter((h) => h.name.toLowerCase().includes(query.toLowerCase())), failed: false },
  });

  if (state === 'discover') {
    // As `FrontDoor` draws it signed in: no top-bar search, the thumb row, the sections OR the results, the bar.
    const data = await loadFrontDoorData();
    return (
      <LabAddOwn claimQrSvg={await renderUrlQrSvg(LAB_CLAIM_URL)}>
        <FrontDoorShell account={account} navLabels={{}} topBarSlot={<Avatar />} search={false}>
          <DiscoverThumbRow key={query} q={query} />
          <div data-fd-page="" data-search-lab="discover" className="pb-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+5.5rem)] lg:pb-0">
            {query ? (
              <div data-discover-results="">
                <FrontDoorResults
                  query={query}
                  data={data}
                  commandItems={items}
                  place="discover"
                  people={people}
                  findSuppliers={{ href: `/dashboard/${EVENT_ID}/vendors`, eventName: 'Cale & Ice' }}
                  addOwnEvent={{ eventId: EVENT_ID, eventName: 'Cale & Ice' }}
                  addOwnCategories={LAB_ADD_OWN_CATEGORIES}
                  events={
                    sp.events === 'fail'
                      ? { status: 'unavailable' }
                      : { status: 'ok', items: LAB_EVENTS.filter((c) => matchesCommandQuery(discoverCardMatchable(c), query)) }
                  }
                />
              </div>
            ) : (
              <FrontDoorFeed data={data} />
            )}
          </div>
        </FrontDoorShell>
        <AccountBarSlot tabs={['events', 'discover', 'memories', 'people']} />
      </LabAddOwn>
    );
  }
  return (
    <div className="sn-ambient min-h-dvh">
      <FrontDoorShell
        variant="app"
        account={account}
        navLabels={{}}
        topBarSlot={<Avatar />}
        search={false}
      >
        <main className="pb-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem)] lg:pb-0">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8" data-search-lab={state}>
            <FrontDoorResults
              query={query}
              data={{ articles: loadFrontDoorArticles() }}
              commandItems={items}
              place="shell"
              findSuppliers={{ href: `/dashboard/${EVENT_ID}/vendors`, eventName: 'Cale & Ice' }}
              people={people}
            />
          </div>
        </main>
        <AccountBarSlot tabs={['events', 'discover', 'memories', 'people']} />
      </FrontDoorShell>
    </div>
  );
}
