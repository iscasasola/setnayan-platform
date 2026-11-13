/**
 * /dev/story-suppliers-lab — the story's suppliers (owner rulings 2026-11-13) on fixture data. No sign-in, no
 * database. DEV-ONLY: production builds 404 this route first thing. It mounts the REAL components the pages render —
 * `SupplierStoriesScene` (shipped, unchanged), `PeopleWhoMadeIt`, `UltraSupplierScene` and, on the supplier side,
 * `PortfolioAlbumSection` on a stub client (its reads answered from fixtures; the switch posts to the real action,
 * which refuses here — press nothing).
 *
 * Names are the approved prototype's (prototypes/approved_2026-11-13/story-suppliers-fable.html v6 — "Maria & Jose").
 *
 *   ?f=story-now        the story's supplier scene as it ships today
 *   ?f=story            Proposed — the same scene, then "The people who made it" and one Supplier Ultra scene
 *   ?f=story-100        Proposed — a story with 100 suppliers (top 8 + "+92 more · See all 100")
 *   ?f=album-now        Supplier › Your private portfolio as it ships today (no switch)
 *   ?f=album-ultra      Proposed — Supplier Ultra, off, asked once after the event
 *   ?f=album-ultra-on   Proposed — Supplier Ultra, shared
 *   ?f=album-pro        Proposed — Supplier Pro, the locked row (Problem → Solution)
 */
import { notFound } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SupplierStoriesScene } from '@/app/[slug]/_components/editorial/post-event-scene-views-2';
import { PeopleWhoMadeIt, UltraSupplierScene } from '@/app/[slug]/_components/story/story-suppliers';
import { PortfolioAlbumSection } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/portfolio-album-section';
import type { UltraAlbum, VendorCredit } from '@/app/[slug]/_components/editorial/data';
import { toStorySupplierViews } from '@/lib/story-suppliers-views';
import type { VendorTier } from '@/lib/vendor-tier-caps';

const NAMES = 'Maria & Jose';
const DATE_LINE = '12 December 2026 · Tagaytay';
const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const SHOP_ID = '00000000-0000-4000-8000-000000000002';

/** A soft square in one of the prototype's tones — the lab has no photographs. */
function tone(i: number): string {
  const c = ['#A2457E', '#3B4E67', '#6f8f7b', '#C24E25', '#b9794f', '#2F6DB5', '#8a6f4e'][i % 7]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#f3ece2"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const card = (rating: number, reviews: number, i: number) => ({ coverUrl: tone(i), bestWork: [tone(i + 1), tone(i + 2), tone(i + 3)], rating, reviews });

const credit = (name: string, category: string, tier: VendorTier | null, extra: Partial<VendorCredit> = {}): VendorCredit => ({
  name,
  category,
  isFirstPick: false,
  tier,
  logoUrl: null,
  slug: tier ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : null,
  vendorProfileId: tier ? `vp-${name}` : null,
  card: null,
  ...extra,
});

const EIGHT: VendorCredit[] = [
  credit('The Ridge, Tagaytay', 'Venue', 'solo'),
  credit('Liwanag Studio', 'Photo & film', 'pro', { card: card(4.9, 41, 2) }),
  credit('Kusina ni Rosa', 'Catering', 'solo'),
  credit('Talulot Florals', 'Florals', 'enterprise', { card: card(5.0, 63, 4) }),
  credit('Ganda by Bea', 'Hair & makeup', 'verified'),
  credit('Emcee Migs', 'Host', 'verified'),
  credit('Himig Strings', 'Music', 'free'),
  credit('Tita Baby’s Cakes', 'Cake', null),
];

const WORDS = ['Alon', 'Sinag', 'Ilaw', 'Tadhana', 'Hiraya', 'Banaag', 'Likha', 'Himaya', 'Mayumi', 'Hardin', 'Silay', 'Dalisay', 'Amihan', 'Lambing', 'Yakap', 'Ligaya', 'Gunita', 'Pangarap', 'Bituin', 'Tala'];
const KINDS = ['Florals', 'Music', 'Gowns', 'Photo & film', 'Lights & sound', 'Rentals', 'Catering', 'Cake', 'Photo booth', 'Venue'];
const HUNDRED: VendorCredit[] = (() => {
  const plan: Array<[VendorTier, number]> = [
    ['enterprise', 3],
    ['pro', 12],
    ['solo', 20],
    ['verified', 30],
    ['free', 35],
  ];
  const out: VendorCredit[] = [];
  let n = 0;
  for (const [tier, count] of plan) {
    for (let i = 0; i < count; i++, n++) {
      const kind = KINDS[n % KINDS.length]!;
      out.push(credit(`${WORDS[n % WORDS.length]} ${kind.split(' ')[0]} ${n + 1}`, kind, tier, tier === 'pro' || tier === 'enterprise' ? { card: card(4.8, 20 + n, n) } : {}));
    }
  }
  return out;
})();

const ULTRA_ALBUM: UltraAlbum = {
  vendorProfileId: 'vp-Talulot Florals',
  name: 'Talulot Florals',
  category: 'Florals',
  slug: 'talulot-florals',
  logoUrl: null,
  items: Array.from({ length: 12 }, (_, i) => ({ stillUrl: tone(i), videoUrl: null })),
  photos: 42,
  videos: 0,
};

/* ── a stub client: the album section's three reads, answered from fixtures ── */

type Answers = Record<string, unknown>;
function stubClient(answers: Answers): SupabaseClient {
  const builder = (table: string) => {
    let single = false;
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'is']) q[m] = () => q;
    q.maybeSingle = () => {
      single = true;
      return q;
    };
    q.then = (resolve: (v: unknown) => unknown) => {
      const data = answers[table] ?? (single ? null : []);
      return Promise.resolve({ data: single && Array.isArray(data) ? (data[0] ?? null) : data, error: null }).then(resolve);
    };
    return q;
  };
  return { from: builder } as unknown as SupabaseClient;
}

const ALBUM_ROWS = Array.from({ length: 4 }, (_, i) => ({
  photo_id: `00000000-0000-4000-8000-00000000010${i}`,
  event_id: EVENT_ID,
  r2_object_key: `r2://setnayan-media/papic/vendor-${SHOP_ID}/portfolio/${EVENT_ID}/${i}.jpg`,
  credits_spent: 1,
  created_at: '2026-12-13T10:00:00Z',
  hidden_at: null,
  nsfw_checked: true,
}));

export default async function StorySuppliersLabPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { f = 'story' } = await searchParams;

  if (f.startsWith('album')) {
    const tier = f === 'album-pro' ? 'pro' : 'enterprise';
    const supabase = stubClient({
      vendor_papic_portfolio_photos: ALBUM_ROWS,
      supplier_page_photo_notices: [],
      vendor_profiles: [{ tier_state: tier }],
      vendor_event_album_shares: f === 'album-ultra-on' ? [{ shared: true, asked_at: '2026-12-13T10:00:00Z' }] : [],
    });
    return (
      <main className="mx-auto w-full max-w-md px-4 py-5" style={{ background: 'var(--m-bg, #fff)' }}>
        <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          On the day · {NAMES} · 12 Dec 2026
        </p>
        <PortfolioAlbumSection
          supabase={supabase}
          eventId={EVENT_ID}
          creditsLeft={20}
          canPutOnPage
          {...(f === 'album-now' ? {} : { vendorProfileId: SHOP_ID, eventEnded: true, coupleName: NAMES })}
        />
      </main>
    );
  }

  const team = f === 'story-100' ? HUNDRED : EIGHT;
  const views = toStorySupplierViews(team, 'maria-and-jose');
  return (
    <main className="mx-auto w-full max-w-md bg-cream px-5 text-ink">
      <SupplierStoriesScene style="credits-roll" team={team} media={[]} loved={[]} words={{}} />
      {f === 'story-now' ? null : (
        <>
          <PeopleWhoMadeIt suppliers={views} names={NAMES} dateLine={DATE_LINE} />
          <UltraSupplierScene album={ULTRA_ALBUM} supplier={views.find((v) => v.name === 'Talulot Florals') ?? null} index={1} of={1} names={NAMES} />
        </>
      )}
    </main>
  );
}
