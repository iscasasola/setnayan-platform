import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Newspaper,
  PenLine,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { resolveServiceSellability } from '@/lib/v2-catalog';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import {
  eventOwnsEditorialPro,
  isEditorialProActive,
  eventOwnsCoupleWebsitePro,
} from '@/lib/couple-website-pro';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

export const metadata = { title: 'Editorial PRO · Setnayan' };

const SKU_CODE = 'EDITORIAL_PRO';

/**
 * /dashboard/[eventId]/studio/editorial-pro — the couple-facing buy surface for
 * the à-la-carte Editorial PRO unlock (₱3,499 · owner 2026-07-04). Wires the
 * EXISTING apply-then-pay flow: it fetches the live catalog price + platform
 * BDO/GCash settings, then mounts the shared InlineCheckoutDrawer (voucher +
 * QR + screenshot upload → submitOrderAction). No new payment mechanics.
 *
 * UMBRELLA-AWARE (the money-correctness part):
 *   • Owns Editorial PRO directly (or has a pending order) → no buy drawer;
 *     show "Unlocked" / "Payment under review" + a link into the editor.
 *   • Owns the COUPLE_WEBSITE_PRO umbrella → Editorial PRO is ALREADY theirs
 *     (SKU_OWNERSHIP_ALIASES) → "Included in your Website PRO" + editor link,
 *     never a second charge.
 *   • Owns nothing → the working buy drawer + a Website-PRO cross-sell line.
 */

type Props = { params: Promise<{ eventId: string }> };

const EDITOR_HREF = (eventId: string) => `/dashboard/${eventId}/website/editorial`;
const WEBSITE_PRO_HREF = (eventId: string) => `/dashboard/${eventId}/studio/website-pro`;

const BENEFITS = [
  'Name every moment of your day — in your own words.',
  'Write the story behind each one, exactly how you remember it.',
  'Arrange your front page: reorder the sections, hide what you skip.',
  'Edit the guest wishes into the keepsake you want to keep.',
  'Prints clean — no Setnayan watermark on your editorial.',
];

export default async function EditorialProBuyPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Ownership is purchaser-scoped under orders RLS; use the admin client so a
  // co-host who didn't place the order still sees the owned state (same reason
  // the Studio hub batch reader uses admin).
  const admin = createAdminClient();

  // Three ownership signals:
  //   • ownsUmbrella — the couple owns COUPLE_WEBSITE_PRO → Editorial PRO is
  //     already included (never a second buy).
  //   • active       — Editorial PRO is admin-approved (feature unlocked).
  //   • owned        — Editorial PRO is owned INCLUDING a pending 'submitted'
  //     order (double-buy prevention); owned && !active ⇒ payment under review.
  const [ownsUmbrella, active, owned, sellability] = await Promise.all([
    eventOwnsCoupleWebsitePro(admin, eventId).catch(() => false),
    isEditorialProActive(admin, eventId).catch(() => false),
    eventOwnsEditorialPro(admin, eventId).catch(() => false),
    // Editorial PRO is bundle-only (2026-07-22): once its catalog row is
    // is_active=false, a standalone drawer would dead-end at checkout, so gate on
    // real sellability and upsell Website PRO instead. Reads DB is_active →
    // self-heals through the migration-push window.
    resolveServiceSellability(SKU_CODE),
  ]);
  const editorialProSellable = sellability === 'sellable';

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
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink/10 text-ink">
          <Newspaper aria-hidden className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div>
          <p className="sn-eye">Editorial</p>
          <h1 className="sn-h1 mt-1.5">Editorial PRO</h1>
          <p className="mt-1 text-sm text-ink/65">
            Your wedding, told as a front-page story — authored by you.
          </p>
        </div>
      </header>

      {/* What it does — benefit language, no implementation names. */}
      <ul className="sn-tile space-y-2 p-5">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-ink/75">
            <PenLine aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#8A6A2F]" strokeWidth={1.75} />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {ownsUmbrella ? (
        /* ── Already included via the Website PRO umbrella. No second buy. ── */
        <div className="rounded-xl border border-success-200 bg-success-50 p-5">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-success-800">
            <CheckCircle2 aria-hidden className="h-5 w-5" strokeWidth={2} /> Included in your Website
            PRO
          </p>
          <p className="text-sm text-ink/70">
            Editorial PRO is part of your Website PRO — you already have every authorship perk. No
            need to buy it again.
          </p>
          <Link
            href={EDITOR_HREF(eventId)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            Open your editorial editor
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      ) : active ? (
        /* ── Owned Editorial PRO directly, admin-approved. ── */
        <div className="rounded-xl border border-success-200 bg-success-50 p-5">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-success-800">
            <CheckCircle2 aria-hidden className="h-5 w-5" strokeWidth={2} /> Unlocked
          </p>
          <p className="text-sm text-ink/70">
            Editorial PRO is active. Head to your editor to author your front-page story.
          </p>
          <Link
            href={EDITOR_HREF(eventId)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            Open your editorial editor
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
            We&rsquo;ve received your Editorial PRO order. Our team reconciles within one business
            day — you&rsquo;ll get an email when it moves to approved, and your authorship perks
            unlock automatically.
          </p>
          <Link
            href={`/dashboard/${eventId}/orders`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-mulberry underline underline-offset-2 hover:text-mulberry-600"
          >
            Track your order
          </Link>
        </div>
      ) : editorialProSellable && priceCentavos != null && pricePhp != null ? (
        /* ── NOT OWNED — the working buy drawer (only while standalone-sellable). ── */
        <div className="space-y-4">
          <InlineCheckoutDrawer
            serviceKey={SKU_CODE}
            displayName="Editorial PRO"
            originalPriceCentavos={String(priceCentavos)}
            eventId={eventId}
            settings={settings}
            triggerLabel="Unlock Editorial PRO"
          />
          {/* Sibling cross-sell — Website PRO covers this and more. */}
          <p className="text-sm text-ink/60">
            Want it all? Website PRO covers this plus your Save the Date, RSVP and on-the-day page —{' '}
            <Link
              href={WEBSITE_PRO_HREF(eventId)}
              className="font-medium text-terracotta underline underline-offset-2 hover:no-underline"
            >
              see Website PRO
            </Link>
            .
          </p>
        </div>
      ) : (
        /* ── Bundle-only: Editorial PRO comes with Website PRO. Upsell it (a real
             buy surface) rather than a standalone drawer that would be rejected. ── */
        <div className="rounded-xl border border-mulberry/20 bg-mulberry/5 p-5">
          <p className="mb-1 text-sm font-semibold text-ink">Editorial PRO is part of Website PRO</p>
          <p className="text-sm text-ink/70">
            Author your front-page story — plus the Save-the-Date Cinematic Reveal, RSVP, and your
            on-the-day page — all in one unlock with Website PRO.
          </p>
          <Link
            href={WEBSITE_PRO_HREF(eventId)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            Unlock Website PRO
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      )}
    </section>
  );
}
