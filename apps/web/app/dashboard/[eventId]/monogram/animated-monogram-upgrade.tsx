import { Check, ExternalLink, PencilLine, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { resolveMonogram } from '@/lib/monogram';
import { eventOwnsAnimatedMonogram } from '@/lib/animated-monogram';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import {
  MONOGRAM_MOTIONS,
  resolveMonogramMotion,
  type MonogramMotionKey,
} from '@/lib/monogram-motion';
import { buildEventLandingUrl } from '@/lib/qr';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { FeatureUsCard } from '@/app/dashboard/[eventId]/_components/feature-us-card';

/**
 * <AnimatedMonogramUpgrade> — the paid ANIMATED_MONOGRAM upgrade, rendered
 * INLINE below the Vector Studio on the Monogram Maker page (/monogram).
 *
 * Owner 2026-06-25 (informed reversal of the 2026-06-21 "studio-only maker"
 * decision): the maker and the paid "Animate it" buy are MERGED onto one screen
 * — design your mark for free in the studio above, then activate the draw-on
 * animation here. This also un-breaks the purchase: the App-Store "Get" CTA
 * (addon-detail-view) already routes to /monogram, which previously had no buy
 * after 2026-06-21 removed it; the buy now lives here again. The standalone
 * /studio/animated-monogram page is retired to a redirect (this is its home).
 *
 * The owned/unowned bodies are the proven surfaces moved verbatim from that
 * retired page (before/after preview · InlineCheckoutDrawer · Feature-Us opt-in).
 *
 * SKU split (load-bearing — two monogram SKUs exist):
 *   • ANIMATED_MONOGRAM (V2 catalog · THIS upgrade) — stroke-trace reveal on the
 *     auto/studio monogram. No upload, no video background. Price LIVE from the
 *     admin catalog (owner rule 2026-06-14 — never hardcoded).
 *   • monogram_hero_upgrade (iteration 0004 "Monogram Hero") — the WIDGET upgrade
 *     (custom video/photo background + upload) reached from the Website tab. Not
 *     this SKU. See lib/animated-monogram.ts.
 *
 * The free static/studio monogram is NEVER gated — only the draw-on animation is.
 */

const SKU_CODE = 'ANIMATED_MONOGRAM';

/**
 * The ink AnimatedMonogramHero should paint. For the four type-only lockups
 * (bar/duo/script/infinity) that's the resolved lockup ink (mulberry · the ∞
 * paints its own gold gradient inside the component); for framed / single-name
 * / legacy events it's the couple's accent color (the text-circle render).
 */
function lockupColor(m: ReturnType<typeof resolveMonogram>): string {
  const isLockup =
    m.style === 'bar' || m.style === 'duo' || m.style === 'script' || m.style === 'infinity';
  return isLockup ? m.inkColor ?? m.color : m.color;
}

export async function AnimatedMonogramUpgrade({ eventId }: { eventId: string }) {
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, slug, monogram_text, monogram_color, monogram_motion_key, monogram_style, monogram_font_key, monogram_frame_key',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  // No event row (drifted/clean DB) → render nothing rather than crash the maker.
  if (!event) return null;

  const owns = await eventOwnsAnimatedMonogram(supabase, eventId);
  const monogram = resolveMonogram(event);

  // Live (un-revoked) Social-Sharing consent row for this event's singular
  // monogram, so the Feature-Us card flips to its "already allowed" state.
  // artifact_ref='' keys on the event's singular monogram. Degrade to null on a
  // drifted DB (the table may post-date this deploy).
  const { data: shareConsent } = owns
    ? await supabase
        .from('marketing_share_consents')
        .select('consent_id, credit_mode')
        .eq('event_id', eventId)
        .eq('artifact_type', 'monogram')
        .eq('artifact_ref', '')
        .is('revoked_at', null)
        .order('consented_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => (r.error ? { data: null } : r))
    : { data: null };

  const motion = resolveMonogramMotion(event.monogram_motion_key);
  const motionLabel =
    MONOGRAM_MOTIONS.find((m) => m.key === motion)?.label ?? 'Drawn';

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const publicLandingUrl = event.slug
    ? buildEventLandingUrl({ appUrl, slug: event.slug })
    : null;

  // Price comes ONLY from the admin V2 catalog (owner rule 2026-06-14 — no
  // hardcoded price). null when the row is unreadable → the buy block degrades.
  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? null;

  return (
    <section className="space-y-5 border-t border-ink/10 pt-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Animated monogram
        </p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Make your mark move
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Your monogram already opens your wedding website. This upgrade makes it
          draw itself in — pick from six motion signatures (Drawn, Foil, Bloom,
          Editorial, Halo, Stardust) and it plays the moment a guest lands.
        </p>
      </header>

      {owns ? (
        <OwnedView
          monogram={monogram}
          publicLandingUrl={publicLandingUrl}
          eventId={eventId}
          motion={motion}
          motionLabel={motionLabel}
          shareConsent={shareConsent ?? null}
        />
      ) : (
        <UnownedView
          monogram={monogram}
          pricePhp={pricePhp}
          eventId={eventId}
          displayName={event.display_name}
          motion={motion}
          motionLabel={motionLabel}
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
  motion,
  motionLabel,
  shareConsent,
}: {
  monogram: ReturnType<typeof resolveMonogram>;
  publicLandingUrl: string | null;
  eventId: string;
  motion: MonogramMotionKey;
  motionLabel: string;
  /** The live (revoked_at IS NULL) monogram consent row, or null. */
  shareConsent: { consent_id: string; credit_mode: string } | null;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-300/60 bg-success-50 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-success-800">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          Your monogram plays the {motionLabel} motion on your wedding website.
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
          {/* key forces a remount so the chosen motion replays each page visit. */}
          <AnimatedMonogramHero
            key={`owned-${monogram.text}-${monogram.style ?? ''}-${motion}`}
            text={monogram.text}
            color={lockupColor(monogram)}
            fontFamily={monogram.fontFamily}
            fontStyle={monogram.fontStyle}
            lockupStyle={monogram.style}
            letterSpacing={monogram.letterSpacing}
            size="lg"
            motion={motion}
          />
        </div>
        <p className="mt-5 text-sm text-ink/60">
          This is exactly how it animates on your wedding website&rsquo;s hero.
          Change your mark or motion in the studio above and the animation
          follows.
        </p>
      </section>

      {/* ── Feature-us opt-in (Social Sharing Program) — the finished, paid
          monogram is a shareable creation. Opt-in, default off; only postable
          after the wedding (gate is app-side). revalidates THIS page (the
          merged maker), the upgrade's new home. ── */}
      <FeatureUsCard
        eventId={eventId}
        artifactType="monogram"
        artifactRef=""
        alreadyConsented={shareConsent}
        revalidatePath={`/dashboard/${eventId}/monogram`}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Unowned — the buy surface. Live before/after preview + InlineCheckoutDrawer.
// ─────────────────────────────────────────────────────────────────────────

async function UnownedView({
  monogram,
  pricePhp,
  eventId,
  displayName,
  motion,
  motionLabel,
}: {
  monogram: ReturnType<typeof resolveMonogram>;
  pricePhp: number | null;
  eventId: string;
  displayName: string | null;
  motion: MonogramMotionKey;
  motionLabel: string;
}) {
  const supabase = await createClient();
  const settings = await fetchPlatformSettings(supabase);

  return (
    <>
      {/* Before / after preview */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Your monogram, two ways
          </p>
          <h3 className="text-lg font-semibold tracking-tight">See the difference</h3>
          <p className="max-w-prose text-sm text-ink/60">
            Same initials, same colours — straight from the studio above. The
            upgrade makes it move instead of just appearing, in the motion you
            pick from the six-signature library.
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
            {/* key remounts the component so the motion replays on each render. */}
            <AnimatedMonogramHero
              key={`preview-${monogram.text}-${monogram.style ?? ''}-${motion}`}
              text={monogram.text}
              color={lockupColor(monogram)}
              fontFamily={monogram.fontFamily}
              fontStyle={monogram.fontStyle}
              lockupStyle={monogram.style}
              letterSpacing={monogram.letterSpacing}
              size="md"
              motion={motion}
            />
            <p className="text-sm font-medium text-ink">
              Animated — your {motionLabel} motion
            </p>
            <p className="text-xs text-ink/55">
              One of six signatures — pick yours in the studio above.
            </p>
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
          <h3 className="text-lg font-semibold tracking-tight">
            A monogram that draws itself in
          </h3>
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

        {pricePhp != null ? (
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
        ) : (
          <p className="mt-5 text-sm text-ink/65">
            Pricing loads from your catalog &mdash; please refresh in a moment.
          </p>
        )}
      </section>
    </>
  );
}
