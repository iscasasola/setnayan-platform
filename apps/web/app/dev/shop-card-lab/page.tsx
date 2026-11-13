/**
 * /dev/shop-card-lab — Discover's shop card and the event card's host circle (owner 10 Nov, DECISION_LOG "DISCOVER'S
 * SHOP CARD — APPROVED", prototype `shop-card` v3). DEV-ONLY; production 404s it.
 *
 *   ?state=proposed (default) — the SHIPPED `ShopCard` and `DiscoverEventCard` over fixture shops/events.
 *   ?state=now                — the card as it drew before this change, frozen here for the side-by-side ONLY
 *                               (logo stretched into the tile, initials in the circle, " · verified" text).
 *
 * Fixtures mirror the four live shops in the prototype (Rondo Musical · FlowerStore.ph · Saysay Host and Band (DEMO)
 * · SetnaProd), plus one with a cover + logo + two badges and one with nothing at all. The badges are composed by the
 * shipped `cardBadges` from fixture FACTS — never a hand-drawn pill. Pictures are files already in /public; the two
 * logos are drawn here as SVG (a square mark that touches its edges, so a crop would show).
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { ShopCard } from '@/app/_components/frontdoor/front-door-feed';
import { DiscoverEventCard } from '@/app/_components/frontdoor/discover-event-card';
import type { FrontDoorShop } from '@/app/_components/frontdoor/data';
import { SampleMarker } from '@/app/_components/sample-marker';
import { cardBadges, type ShopBadgeFacts } from '@/lib/shop-badges';
import { shopInitials } from '@/lib/shop-initials';
import { SHOP_ARRIVAL_SRC, withShopArrival } from '@/lib/shop-back';
import type { DiscoverEventCard as Card } from '@/lib/discover-events-core';
import { sceneCoverFor, type EventPosterFacts } from '@/lib/event-poster';

export const dynamic = 'force-dynamic';

const NOW_YEAR = 2026;
const facts = (f: Partial<ShopBadgeFacts>): ShopBadgeFacts => ({
  verified: false,
  completedEvents: 0,
  trusted: { trusted_avg_rating: 0, trusted_review_count: 0 },
  inBusinessSinceYear: null,
  awards: [],
  nowYear: NOW_YEAR,
  ...f,
});

/** A square logo drawn to its edges — a cover crop would cut its top and bottom bands off. */
const svgLogo = (bg: string, fg: string, word: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${bg}"/><rect x="0" y="0" width="120" height="14" fill="${fg}"/><rect x="0" y="106" width="120" height="14" fill="${fg}"/><text x="60" y="70" font-family="Georgia,serif" font-size="22" font-weight="700" text-anchor="middle" fill="${fg}">${word}</text></svg>`,
  )}`;
const FLOWER_LOGO = svgLogo('rgb(255,255,255)', 'rgb(194,24,91)', 'FLOWER');
const SETNA_LOGO = svgLogo('rgb(31,58,44)', 'rgb(232,199,122)', 'SETNA');

type LabShop = FrontDoorShop & { nowFolderLabel: string };
const shop = (s: Omit<LabShop, 'badges'> & { facts: ShopBadgeFacts }): LabShop => {
  const { facts: f, ...rest } = s;
  return { ...rest, badges: cardBadges(f) };
};

const SHOPS: LabShop[] = [
  shop({
    href: '/rondo-musical',
    name: 'Rondo Musical',
    folderLabel: 'Hosts, music & program',
    nowFolderLabel: 'Setnayan supplier',
    city: 'Quezon City',
    verified: false,
    logoUrl: null,
    isDemo: false,
    cover: { url: '/taxonomy/tiles/orchestra.webp', sample: true },
    facts: facts({ inBusinessSinceYear: 2020 }),
  }),
  shop({
    href: '/flowerstore-ph',
    name: 'FlowerStore.ph',
    folderLabel: 'Styling, flowers & lights',
    nowFolderLabel: 'Setnayan supplier',
    city: 'Makati',
    verified: false,
    logoUrl: FLOWER_LOGO,
    isDemo: false,
    cover: { url: '/demo/maria-jose/vendor-florist.webp', sample: true },
    facts: facts({}),
  }),
  shop({
    href: '/saysay-host-and-band',
    name: 'Saysay Host and Band',
    folderLabel: 'Hosts, music & program',
    nowFolderLabel: 'Hosts, music & program',
    city: null,
    verified: true,
    logoUrl: null,
    isDemo: true,
    cover: { url: '/taxonomy/tiles/host_mc.webp', sample: true },
    facts: facts({ verified: true }),
  }),
  shop({
    href: '/setnaprod',
    name: 'SetnaProd',
    folderLabel: 'Booths, carts & bars',
    nowFolderLabel: 'Booths, carts & bars',
    city: null,
    verified: true,
    logoUrl: SETNA_LOGO,
    isDemo: false,
    cover: { url: '/taxonomy/tiles/dance_floor.webp', sample: true },
    facts: facts({ verified: true }),
  }),
  shop({
    href: '/lab-cover-logo-badges',
    name: 'Casa Lumière Events',
    folderLabel: 'Styling, flowers & lights',
    nowFolderLabel: 'Styling, flowers & lights',
    city: 'Taguig',
    verified: true,
    logoUrl: FLOWER_LOGO,
    isDemo: false,
    // A real cover photo — no "Sample photo" chip.
    cover: { url: '/demo/maria-jose/reception.webp', sample: false },
    facts: facts({ verified: true, completedEvents: 57, trusted: { trusted_avg_rating: 4.9, trusted_review_count: 32 }, inBusinessSinceYear: 2019 }),
  }),
  shop({
    href: '/lab-nothing',
    name: 'Bagong Tindahan',
    folderLabel: null,
    nowFolderLabel: 'Setnayan supplier',
    city: 'Cebu City',
    verified: false,
    logoUrl: null,
    isDemo: false,
    cover: { url: '/placeholders/vendor.webp', sample: true },
    // Stats unread: no pill at all — never a zero.
    facts: facts({ completedEvents: null, trusted: null }),
  }),
];

/** The card exactly as it drew before 10 Nov — frozen for the side-by-side, never shipped. */
function NowShopCard({ s }: { s: LabShop }) {
  return (
    <a href={s.href} className="fd-item">
      <div className="fd-thumb fd-thumb-shop">
        {s.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.logoUrl} alt="" className="fd-shoplogo" loading="lazy" />
        ) : (
          <span className="fd-shopmark">{shopInitials(s.name, 2, 'SN')}</span>
        )}
      </div>
      <div className="fd-imeta">
        <span className="fd-ava" aria-hidden="true">
          {shopInitials(s.name, 2, 'SN')}
        </span>
        <div className="fd-itxt">
          <p className="fd-ttl">{s.name}</p>
          {s.isDemo ? <SampleMarker /> : null}
          <p className="fd-by">
            {s.nowFolderLabel}
            {s.verified ? ' · verified' : ''}
          </p>
          {s.city ? <p className="fd-by">{s.city}</p> : null}
        </div>
      </div>
    </a>
  );
}

const labEvent = (key: string, title: string, host: string | null, relation: Card['relation'], hostPhotoUrl: string | null): Card => ({
  key,
  href: `/${key}`,
  title,
  typeLabel: 'Wedding',
  datePlate: 'Sat 12 Dec',
  cover: title.slice(0, 1),
  scene: null,
  paper: null,
  host: host ? { name: host, slug: key } : null,
  regionLabel: 'Metro Manila',
  relation,
  askHref: null,
  hostPhotoUrl,
});

// Fixture facts in the poster's own shape (only `posterFor` composes a poster — lib/event-poster.test.ts).
const labFacts = (over: Partial<EventPosterFacts>): EventPosterFacts => ({
  kind: 'invitation', accent: null, capiz: false, dark: false, names: { first: '', second: null },
  weekday: 'Saturday', date: '12 December 2026', eyebrow: null, line: null, venue: null, photoSrc: null, ground: null, legibility: null,
  ...over,
});
const LAB_PAPER = labFacts({ names: { first: 'Cale', second: 'Ice' } });
const LAB_PHOTO = labFacts({
  kind: 'photo', dark: true, names: { first: 'Indalecio', second: 'Claire' }, weekday: 'Friday', date: '18 December 2026',
  photoSrc: '/event-types/wedding.webp', ground: 'hero',
  legibility: { '--hub-ink': '#FBFAF7', '--hub-heading': '#FBFAF7', '--hub-accent-text': '#E6D3A8', '--hub-scrim': 'rgba(20,14,10,.62)' },
});

const EVENTS: Card[] = [
  // Your own event: your photo, even with your profile off.
  labEvent('maria-and-jose', 'Maria & Jose', 'Ice Casasola', 'you', '/portraits/isabel-santos.avif'),
  // A host with a public profile: their photo.
  labEvent('ana-and-paolo', 'Ana & Paolo', 'Ana Reyes', 'connected', '/portraits/isabella-reyes.avif'),
  // Nobody named (no public profile): initials.
  labEvent('santos-reunion', 'Santos Family Reunion', null, null, null),
  // 🖼 The two covers #7540 matched with Home (name only, no date — owner 2026-11-13): their paper card, and
  // their invitation on their photo. Fixture facts through the real poster rule.
  { ...labEvent('cale-and-ice', 'Cale & Ice', 'Ice Casasola', 'you', null), paper: { poster: LAB_PAPER, ground: null, markText: 'C', markSvg: null, markPlays: false } },
  { ...labEvent('indalecio-claire', 'Indalecio & Claire', 'Ice Casasola', 'you', null), scene: sceneCoverFor(LAB_PHOTO), scenePoster: { poster: LAB_PHOTO, ground: null, markText: 'I & C', markSvg: null, markPlays: false } },
];

const Avatar = () => (
  <span className="grid h-11 w-11 place-items-center rounded-full sn-initials text-xs font-semibold">IC</span>
);

export default async function ShopCardLabPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const now = sp.state === 'now';
  const account = { signedIn: true, initials: 'IC', shopName: null, isAdmin: false } as const;
  return (
    <FrontDoorShell account={account} navLabels={{}} topBarSlot={<Avatar />} search={false}>
      <div data-fd-page="" data-shop-card-lab={now ? 'now' : 'proposed'}>
        <h2 className="fd-sechead">
          <span>The first shops</span>
        </h2>
        <div className="fd-grid">
          {SHOPS.map((s) => (now ? <NowShopCard key={s.href} s={s} /> : <ShopCard key={s.href} s={s} href={withShopArrival(s.href, { src: SHOP_ARRIVAL_SRC.discover })} />))}
        </div>
        <h2 className="fd-sechead">
          <span>Upcoming from people you follow</span>
        </h2>
        <div className="fd-grid fd-up">
          {EVENTS.map((c) => (
            <DiscoverEventCard key={c.key} card={now ? { ...c, hostPhotoUrl: null } : c} />
          ))}
        </div>
      </div>
    </FrontDoorShell>
  );
}
