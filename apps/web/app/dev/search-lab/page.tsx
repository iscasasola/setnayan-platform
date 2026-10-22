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
 *   &q=…           — the words (default "seda"; try "ana" for people).
 *   &people=fail   — the People read refused: "We couldn't search people…", never "nobody".
 *   The People rows (owner 2026-10-22) are the shipped builder `shellPeopleResults` over a fixture roster
 *   and fixture hits — each opens `/dashboard/people?person=…`.
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { FrontDoorResults } from '@/app/_components/frontdoor/front-door-results';
import { loadFrontDoorArticles } from '@/app/_components/frontdoor/data';
import { AccountBarSlot } from '@/app/dashboard/(launcher)/_components/account-bar-slot';
import { HomeCommandBar, type HomeCommandItem } from '@/app/dashboard/(launcher)/_components/home-command-bar';
import { ownSupplierItems } from '@/lib/own-supplier-items';
import { shellPeopleResults } from '@/lib/shell-people-results';
import type { RosterPerson } from '@/lib/people-roster';

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
  { vendor_id: 'lab-seda', event_id: EVENT_ID, vendor_name: 'Seda Vertis North', archived_at: null },
  { vendor_id: 'lab-saysay', event_id: EVENT_ID, vendor_name: 'Saysay Studio', archived_at: null },
]);

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

const Avatar = () => (
  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#A9834B] text-xs font-semibold text-white">IC</span>
);

export default async function SearchLabPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string; people?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const state = sp.state === 'before' || sp.state === 'empty' ? sp.state : 'after';
  const query = (sp.q ?? (state === 'empty' ? 'xyzzy' : 'seda')).trim();
  const account = { signedIn: true, initials: 'IC', shopName: null, isAdmin: false } as const;

  if (state === 'before') {
    // The old index: events and jump rows, no suppliers.
    return (
      <FrontDoorShell
        account={account}
        tools={[]}
        navLabels={{}}
        topBarSlot={<Avatar />}
        search={<HomeCommandBar items={EVENT_ITEMS} variant="rail" />}
      >
        <div data-search-lab="before">
          <FrontDoorResults query={query} data={{ articles: loadFrontDoorArticles() }} commandItems={EVENT_ITEMS} />
        </div>
      </FrontDoorShell>
    );
  }

  const items = [...EVENT_ITEMS, ...SUPPLIER_ITEMS];
  return (
    <div className="sn-ambient min-h-dvh">
      <FrontDoorShell
        variant="app"
        account={account}
        tools={[]}
        navLabels={{}}
        topBarSlot={<Avatar />}
        search={<HomeCommandBar items={items} variant="rail" />}
      >
        <main className="pb-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem)] lg:pb-0">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8" data-search-lab={state}>
            <FrontDoorResults
              query={query}
              data={{ articles: loadFrontDoorArticles() }}
              commandItems={items}
              place="shell"
              findSuppliers={{ href: `/dashboard/${EVENT_ID}/vendors`, eventName: 'Cale & Ice' }}
              people={shellPeopleResults({
                query,
                roster: sp.people === 'fail' ? null : LAB_ROSTER,
                found: sp.people === 'fail' ? { hits: [], failed: true } : { hits: LAB_HITS.filter((h) => h.name.toLowerCase().includes(query.toLowerCase())), failed: false },
              })}
            />
          </div>
        </main>
        <AccountBarSlot tabs={['events', 'discover', 'memories', 'people']} />
      </FrontDoorShell>
    </div>
  );
}
