import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock, Globe2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import {
  eventOwnsCoupleWebsitePro,
  eventCoupleWebsiteProActive,
} from '@/lib/couple-website-pro';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

export const metadata = { title: 'Website PRO · Setnayan' };

const SKU_CODE = 'COUPLE_WEBSITE_PRO';

/**
 * /dashboard/[eventId]/studio/website-pro — the couple-facing buy surface for
 * Couple Website PRO (₱4,999 · the UMBRELLA · owner 2026-07-04). One purchase
 * confers every premium website touch across the lifecycle — Save the Date
 * openings, RSVP, on-the-day, AND Editorial PRO — plus drops the watermark
 * everywhere. Wires the EXISTING apply-then-pay flow (live catalog price +
 * platform BDO/GCash settings → InlineCheckoutDrawer → submitOrderAction). No
 * new payment mechanics.
 *
 * Ownership-aware:
 *   • Active (admin-approved) → "Unlocked" + a link into the website hub.
 *   • Owned but pending → "Payment under review", no second drawer.
 *   • Owned nothing → the working buy drawer.
 * Website PRO is the top tier, so there's no cross-sell line up from it.
 */

type Props = { params: Promise<{ eventId: string }> };

const WEBSITE_HUB_HREF = (eventId: string) => `/dashboard/${eventId}/website`;

const BENEFITS = [
  'A cinematic reveal on your Save the Date.',
  'The premium RSVP page your guests answer on.',
  'Your live, on-the-day page for the celebration.',
  'Editorial PRO — author your wedding as a front-page story.',
  'The Setnayan watermark removed across your whole website.',
];

export default async function WebsiteProBuyPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Purchaser-scoped under orders RLS → admin client so a co-host sees the
  // owned state too.
  const admin = createAdminClient();

  // active — admin-approved (feature unlocked). owned — owned INCLUDING a
  // pending 'submitted' order (double-buy prevention). owned && !active ⇒
  // payment under review.
  const [active, owned] = await Promise.all([
    eventCoupleWebsiteProActive(admin, eventId).catch(() => false),
    eventOwnsCoupleWebsitePro(admin, eventId).catch(() => false),
  ]);

  const supabase = await createClient();
  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? null;
  const priceCentavos = skuRecord?.price_centavos ?? null;
  const settings = await fetchPlatformSettings(supabase);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to services
      </Link>

      <header className="sn-reveal flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700">
          <Globe2 aria-hidden className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div>
          <p className="sn-eye">Website</p>
          <h1 className="sn-h1">Website PRO</h1>
          <p className="mt-1 text-sm text-ink/65">
            Every premium touch across your whole website — one unlock.
          </p>
        </div>
      </header>

      {/* What it covers — benefit language, no implementation names. */}
      <ul className="sn-tile space-y-2 p-5">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-ink/75">
            <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" strokeWidth={1.75} />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {active ? (
        /* ── Owned + admin-approved. ── */
        <div className="rounded-xl border border-success-200 bg-success-50 p-5">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-success-800">
            <CheckCircle2 aria-hidden className="h-5 w-5" strokeWidth={2} /> Unlocked
          </p>
          <p className="text-sm text-ink/70">
            Website PRO is active. Every premium touch is on across your website, watermark-free.
          </p>
          <Link
            href={WEBSITE_HUB_HREF(eventId)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            Open your website
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      ) : owned ? (
        /* ── Pending order (submitted, not yet approved). No second drawer. ── */
        <div className="rounded-xl border border-mulberry/20 bg-mulberry/5 p-5">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-mulberry">
            <Clock aria-hidden className="h-5 w-5" strokeWidth={1.75} /> Payment under review
          </p>
          <p className="text-sm text-ink/70">
            We&rsquo;ve received your Website PRO order. Our team reconciles within one business day —
            you&rsquo;ll get an email when it moves to approved, and every premium touch unlocks
            automatically.
          </p>
          <Link
            href={`/dashboard/${eventId}/orders`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-mulberry underline underline-offset-2 hover:text-mulberry-600"
          >
            Track your order
          </Link>
        </div>
      ) : priceCentavos != null && pricePhp != null ? (
        /* ── NOT OWNED — the working buy drawer. ── */
        <InlineCheckoutDrawer
          serviceKey={SKU_CODE}
          displayName="Website PRO"
          originalPriceCentavos={String(priceCentavos)}
          eventId={eventId}
          settings={settings}
          triggerLabel="Unlock Website PRO"
        />
      ) : (
        <p className="text-sm text-ink/65">
          Pricing loads from your catalog &mdash; please refresh in a moment.
        </p>
      )}
    </section>
  );
}
