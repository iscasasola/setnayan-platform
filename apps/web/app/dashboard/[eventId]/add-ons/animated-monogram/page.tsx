import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, PencilLine, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveMonogram } from '@/lib/monogram';
import { eventOwnsAnimatedMonogram } from '@/lib/animated-monogram';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import { buildEventLandingUrl } from '@/lib/qr';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

export const metadata = { title: 'Animated Monogram · Setnayan' };

/**
 * /dashboard/[eventId]/add-ons/animated-monogram — closes the partial
 * ANIMATED_MONOGRAM SKU (₱2,499 · "Your initials, drawn live").
 *
 * Every event ships with a FREE auto-generated text monogram — the "M & J"
 * initials circle that already shows on the dashboard chrome, the QR center,
 * and the wedding-website hero (lib/monogram.ts + EventMonogram). The PAID
 * "Animated Monogram" SKU makes that same monogram DRAW ITSELF IN with an SVG
 * stroke-trace reveal on the couple's wedding website — the pen stroke
 * animating over the initials, then settling into the static monogram.
 *
 * SKU DISAMBIGUATION (load-bearing — two monogram SKUs exist):
 *   • ANIMATED_MONOGRAM (₱2,499 · V2 catalog · THIS page) — "Your initials,
 *     drawn live." Standalone stroke-trace reveal on the auto-text monogram. No
 *     upload, no video/photo background.
 *   • monogram_hero_upgrade (₱1,999 · iteration 0004 "Monogram Hero") — the
 *     WIDGET upgrade that adds a custom video/photo background + SVG/PNG-upload
 *     via Potrace on the hero_monogram invitation widget, gated through the
 *     invitation_widgets.tier flip. That richer "studio" path is NOT this SKU
 *     and is reached from the Website-tab widget editor — see lib/animated-
 *     monogram.ts for the full split.
 *
 * Gating (reuses the website ProUpgradePanel pattern · CLAUDE.md 2026-05-22 +
 * the custom-qr-guest sibling page):
 *   • Owned (a paid ANIMATED_MONOGRAM order exists, not cancelled/refunded/
 *     lapsed) → confirm the animation is live + preview it + link to the
 *     public site.
 *   • Unowned → marketing surface with a live before/after preview (static vs
 *     animated) + the InlineCheckoutDrawer buy CTA. The static monogram keeps
 *     showing on the landing page regardless.
 *
 * The free static monogram is NEVER gated — only the draw-on animation is.
 * The orchestrator flips lib/v2-catalog.ts ANIMATED_MONOGRAM → 'live' after
 * verifying; until then the SKU shows "Coming soon" on /pricing and this page
 * still works (the buy CTA is the InlineCheckoutDrawer, independent of the
 * /pricing build-status badge).
 */

const SKU_CODE = 'ANIMATED_MONOGRAM';
const FALLBACK_PRICE_PHP = 2499; // v2.1 brief § 5 · ₱2,499

type Props = { params: Promise<{ eventId: string }> };

export default async function AnimatedMonogramPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, slug, monogram_text, monogram_color',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const owns = await eventOwnsAnimatedMonogram(supabase, eventId);
  const monogram = resolveMonogram(event);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const publicLandingUrl = event.slug
    ? buildEventLandingUrl({ appUrl, slug: event.slug })
    : null;

  // Pricing from the live V2 catalog (single source of truth) with a fallback
  // so the page never crashes if the catalog row is missing pre-seed (no
  // service-role key in CI → formatV2Sku throws → fall back).
  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? FALLBACK_PRICE_PHP;

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Animated monogram
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your initials, drawn live
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Your monogram already opens your wedding website. This upgrade makes
          it draw itself in — your initials traced on, line by line, the moment
          a guest lands on your page.
        </p>
      </header>

      {owns ? (
        <OwnedView
          monogram={monogram}
          publicLandingUrl={publicLandingUrl}
          eventId={eventId}
        />
      ) : (
        <UnownedView
          monogram={monogram}
          pricePhp={pricePhp}
          eventId={eventId}
          displayName={event.display_name}
          supabase={supabase}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Owned — the couple has paid. Confirm the animation is live + preview it.
// ─────────────────────────────────────────────────────────────────────────

function OwnedView({
  monogram,
  publicLandingUrl,
  eventId,
}: {
  monogram: ReturnType<typeof resolveMonogram>;
  publicLandingUrl: string | null;
  eventId: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          Your monogram draws itself in on your wedding website.
        </p>
        {publicLandingUrl ? (
          <a
            href={publicLandingUrl}
            target="_blank"
            rel="noreferrer"
            className="button-secondary inline-flex items-center gap-1.5"
          >
            View live site
            <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        ) : null}
      </div>

      <section className="rounded-2xl border border-ink/10 bg-cream p-6 text-center sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
          Live preview
        </p>
        <div className="mt-6 flex justify-center">
          {/* key forces a remount so the draw-on replays each page visit */}
          <AnimatedMonogramHero
            key={`owned-${monogram.text}`}
            text={monogram.text}
            color={monogram.color}
            size="lg"
          />
        </div>
        <p className="mt-5 text-sm text-ink/60">
          This is exactly how it animates on your wedding website&rsquo;s hero.
        </p>
      </section>

      <p className="text-xs text-ink/50">
        Want to change the initials or colour? Set them in your{' '}
        <Link
          href={`/dashboard/${eventId}/website`}
          className="font-medium text-terracotta underline-offset-4 hover:underline"
        >
          Website tab
        </Link>{' '}
        — the animation follows whatever your monogram says.
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Unowned — the marketing surface. Live before/after preview + buy CTA.
// ─────────────────────────────────────────────────────────────────────────

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function UnownedView({
  monogram,
  pricePhp,
  eventId,
  displayName,
  supabase,
}: {
  monogram: ReturnType<typeof resolveMonogram>;
  pricePhp: number;
  eventId: string;
  displayName: string | null;
  supabase: SupabaseLike;
}) {
  const settings = await fetchPlatformSettings(supabase);

  return (
    <>
      {/* Before / after preview */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Your monogram, two ways
          </p>
          <h2 className="text-xl font-semibold tracking-tight">See the difference</h2>
          <p className="max-w-prose text-sm text-ink/60">
            Same initials, same colours — straight from your monogram. The
            upgrade makes it draw itself in instead of just appearing.
          </p>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-ink/10 bg-white/60 p-5 text-center">
            {/* Static monogram — the exact h-20 circle the landing-page hero
                renders for events that don't own the upgrade. */}
            <span
              aria-hidden
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 bg-cream font-serif text-2xl italic"
              style={{ borderColor: monogram.color, color: monogram.color }}
            >
              {monogram.text}
            </span>
            <p className="text-sm font-medium text-ink">Default — included free</p>
            <p className="text-xs text-ink/55">Appears the moment the page loads.</p>
          </div>

          <div className="relative flex flex-col items-center gap-3 rounded-xl border border-terracotta/30 bg-white/60 p-5 text-center">
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta">
              <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
              Upgrade
            </span>
            {/* key remounts the component so the trace replays on each render */}
            <AnimatedMonogramHero
              key={`preview-${monogram.text}`}
              text={monogram.text}
              color={monogram.color}
              size="md"
            />
            <p className="text-sm font-medium text-ink">Animated — drawn live</p>
            <p className="text-xs text-ink/55">Traces on, line by line, then settles.</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink/50">
          The animated preview above is exactly what your guests would see.
        </p>
      </section>

      {/* What you get + buy */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            What you get
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            A monogram that draws itself in
          </h2>
        </header>

        <ul className="mt-4 space-y-2 text-sm text-ink/70">
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            Your initials traced on with a hand-drawn pen-stroke reveal.
          </li>
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            Plays on your wedding website&rsquo;s hero every time a guest lands.
          </li>
          <li className="flex items-start gap-2">
            <PencilLine aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            Uses your monogram + colours — change them anytime, the animation follows.
          </li>
        </ul>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/65">
            One price for your wedding ·{' '}
            <span className="font-mono text-base text-ink">{formatPhp(pricePhp)}</span>
          </p>
          <div className="sm:w-auto">
            <InlineCheckoutDrawer
              eventId={eventId}
              serviceKey={SKU_CODE}
              displayName={`Animated Monogram${displayName ? ` · ${displayName}` : ''}`}
              originalPriceCentavos={String(Math.round(pricePhp * 100))}
              settings={settings}
              triggerLabel="Draw my monogram live"
              triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink/50">
          Want to fine-tune your monogram + colours first? Set them on your{' '}
          <Link
            href={`/dashboard/${eventId}/website`}
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            Website tab
          </Link>
          .
        </p>
      </section>
    </>
  );
}
