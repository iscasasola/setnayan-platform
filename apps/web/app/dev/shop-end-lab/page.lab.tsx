/**
 * /dev/shop-end-lab — the END of a shop's page (owner 2026-11-14, DECISION_LOG "A SHOP PAGE ENDS WITH ITS PARTNERS,
 * THEN SIMILAR SHOPS NEARBY — APPROVED AS DRAWN"; prototype `shop_page_end_2026-11-14_fable.html`) on fixture data.
 * DEV-ONLY: production builds 404 this route. It mounts the REAL pieces — `TrustedByCarousel` and `SimilarShopsRow`
 * (which draws Discover's shipped `ShopCard` through the shipped `pickSimilarShops`) — inside the page's own section
 * markup, so what it shows at 390 and 1280 is what ships. Every shop here is made up.
 *
 *   ?partners=0|1|3|8   how many partners (0 = section not drawn; 1 = one tile; 3 = fits, no arrows; 8 = endless)
 *   ?similar=0|3|6      same-kind shops the read returned (3 = two in Quezon City + one in San Juan → heading widens)
 *   ?sample=1           a demo shop: the similar row's shops are demo shops, each marked Sample
 *   ?unreadable=1       the partners read was refused — the one "couldn't load" line
 */
import { notFound } from 'next/navigation';
import { TrustedByCarousel, type TrustedByTile } from '@/app/v/[slug]/_components/trusted-by-carousel';
import { SimilarShopsRow } from '@/app/v/[slug]/_components/similar-shops-row';
import '@/app/v/[slug]/_components/shop-end.css';
import { PARTNERSHIP_PUBLIC_HINT, PARTNERSHIP_PUBLIC_LABEL, type PartnershipKind } from '@/lib/vendor-partnership-kinds';
import { shopInitials } from '@/lib/shop-initials';

export const dynamic = 'force-dynamic';

const SHOP = 'Liwanag Lights & Bar';
const PARTNERS: Array<[string, PartnershipKind]> = [
  ['Hapag Catering', 'included_in_package'],
  ['Bloom & Twine Florals', 'discounted_together'],
  ['Casa Verde Gardens', 'accredited'],
  ['Hiraya Events', 'general'],
  ['Tala Photo Co.', 'general'],
  ['Sagana Grazing Tables', 'discounted_together'],
  ['Habi Invitations', 'accredited'],
  ['Kudyapi String Quartet', 'general'],
];
const SIMILAR: Array<[string, string, number, number, boolean]> = [
  ['Sinag Stage & Sound', 'Quezon City', 14.64, 121.03, true],
  ['Kislap Lights Co.', 'Quezon City', 14.66, 121.05, false],
  ['Pailaw Events PH', 'San Juan', 14.6, 121.03, true],
  ['Ilaw ng Gabi Productions', 'Quezon City', 14.7, 121.07, false],
  ['Liwayway Sounds', 'Quezon City', 14.68, 121.04, false],
  ['Bituin AV Rentals', 'Pasig', 14.57, 121.08, false],
];

export default async function ShopEndLab({
  searchParams,
}: {
  searchParams: Promise<{ partners?: string; similar?: string; sample?: string; unreadable?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const partnerCount = Number(sp.partners ?? '8');
  const similarCount = Number(sp.similar ?? '6');
  const demo = sp.sample === '1';

  const tiles: TrustedByTile[] = PARTNERS.slice(0, partnerCount)
    .map(([name, kind], i) => ({
      id: `p${i}`,
      name,
      href: `/dev/shop-end-lab?partners=${partnerCount}`,
      kindLabel: PARTNERSHIP_PUBLIC_LABEL[kind],
      kindHint: PARTNERSHIP_PUBLIC_HINT[kind],
      logoUrl: null,
      initials: shopInitials(name, 2, 'SN'),
      kind,
    }))
    .sort((a, b) => ['included_in_package', 'discounted_together', 'accredited', 'general'].indexOf(a.kind) - ['included_in_package', 'discounted_together', 'accredited', 'general'].indexOf(b.kind));

  const rows = SIMILAR.slice(0, similarCount).map(([name, city, lat, lng, verified], i) => ({
    vendor_profile_id: `s${i}`,
    business_name: name,
    business_slug: `lab-shop-${i}`,
    location_city: city,
    services: ['lights_and_sound'],
    verification_state: verified ? 'verified' : 'unverified',
    next_renewal_due_at: null,
    logo_url: null,
    is_demo: demo,
    portfolio_r2_keys: [],
    microsite_hero_photo_key: null,
    in_business_since_year: null,
    hq_latitude: lat,
    hq_longitude: lng,
  }));

  return (
    <main className="min-h-screen bg-cream px-4 py-6 md:px-8">
      <article className="mx-auto max-w-screen-2xl md:grid md:grid-cols-[300px_minmax(0,1fr)] md:gap-x-7 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-x-11">
        <aside className="mb-6 rounded-3xl bg-white p-5 text-sm text-ink/60 md:mb-0">Calling card (unchanged)</aside>
        <div className="min-w-0">
          <p className="border-b border-dashed border-ink/20 py-3 text-xs text-ink/50">About · Services · Portfolio · Reviews · Where …</p>
          {sp.unreadable === '1' ? (
            <section className="space-y-1.5 border-b border-ink/10 py-8">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Trusted by</h2>
              <p className="text-sm text-ink/65">We couldn&rsquo;t load {SHOP}&rsquo;s supplier endorsements right now.</p>
            </section>
          ) : tiles.length > 0 ? (
            <section className="space-y-4 border-b border-ink/10 py-8" data-trusted-by="">
              <header className="space-y-1">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Trusted by</h2>
                <p className="text-sm text-ink/65">Fellow suppliers who endorsed {SHOP} — each one confirmed it.</p>
              </header>
              <TrustedByCarousel tiles={tiles} label={`Suppliers who trust ${SHOP}`} />
            </section>
          ) : null}
          <SimilarShopsRow
            rows={Promise.resolve(rows)}
            service="lights_and_sound"
            kindLabel="Lights & Sound"
            self={{ vendorProfileId: 'self', city: 'Quezon City', latitude: 14.676, longitude: 121.0437 }}
            excludeIds={[]}
            arrival={{ src: null, eventId: null }}
          />
          <div className="flex flex-wrap gap-3 py-8">
            <a href="/explore" className="button-secondary">See more suppliers</a>
          </div>
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-6 text-xs text-ink/50">
            <p>Powered by <span className="font-semibold tracking-wide text-ink/70">SETNAYAN</span></p>
            <p>Supplier ID · <span className="font-mono">S89V-SAMPLE0000</span></p>
          </footer>
        </div>
      </article>
    </main>
  );
}
