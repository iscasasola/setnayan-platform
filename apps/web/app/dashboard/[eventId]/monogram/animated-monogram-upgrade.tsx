import { Check, ExternalLink, PencilLine, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMonogram } from '@/lib/monogram';
import { eventOwnsAnimatedMonogram } from '@/lib/animated-monogram';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import {
  MONOGRAM_MOTIONS,
  resolveMonogramMotion,
  type MonogramMotionKey,
} from '@/lib/monogram-motion';
import { buildEventLandingUrl } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { FeatureUsCard } from '@/app/dashboard/[eventId]/_components/feature-us-card';
import { BespokeMonogramMark } from '@/app/_components/bespoke-monogram-mark';
import { StudioRevealPlayer, type StudioAnim } from '@/app/_components/studio-reveal-player';
import { sanitizeStudioConfig, type StudioAnimKind } from '@/lib/monogram-studio-shared';
import { DEFAULT_STUDIO_ANIM } from '@/lib/hero-monogram-data';

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
 *
 * ONE TAXONOMY PER PAGE (council verdict 2026-07-17 §5.1–5.2 · D12): when the
 * event has a studio/uploaded mark, the live hero plays the STUDIO reveal
 * (monogram_studio_config.anim via StudioRevealPlayer) and MONOGRAM_MOTIONS
 * never runs — so this page's copy + previews speak the five studio reveals on
 * the couple's REAL mark. The six-signature pitch + AnimatedMonogramHero
 * preview survive only for the fallback-lockup path (no custom mark).
 */

const SKU_CODE = 'ANIMATED_MONOGRAM';

/** Display labels for the studio's five reveal kinds — the EXACT vocabulary the
 *  "Animate the reveal" panel above uses (one taxonomy per page — council
 *  verdict 2026-07-17 §5.1 / D12). */
const STUDIO_REVEAL_LABELS: Record<StudioAnimKind, string> = {
  handwriting: 'Handwriting',
  trace: 'Trace',
  droplet: 'Droplet',
  gold: 'Gold Turn',
  molten: 'Molten Gold',
};

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
      'event_id, display_name, slug, monogram_text, monogram_color, monogram_motion_key, monogram_style, monogram_font_key, monogram_frame_key, monogram_custom_svg, monogram_uploaded_svg, monogram_studio_config',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  // No event row (drifted/clean DB) → render nothing rather than crash the maker.
  if (!event) return null;

  const owns = await eventOwnsAnimatedMonogram(supabase, eventId);
  const monogram = resolveMonogram(event);

  // The couple's EFFECTIVE custom mark — uploaded outranks studio, the same
  // precedence the live hero applies (app/[slug]/page.tsx → HeroMonogram). When
  // one exists, the hero plays the STUDIO reveal (monogram_studio_config.anim)
  // via StudioRevealPlayer and MONOGRAM_MOTIONS never runs — so this page must
  // pitch and preview THAT reveal on THAT mark, not the six lockup signatures
  // on a lockup the couple doesn't use (council verdict 2026-07-17 §5.1–5.2).
  const bespokeSvg =
    (typeof event.monogram_uploaded_svg === 'string' && event.monogram_uploaded_svg.trim()
      ? event.monogram_uploaded_svg
      : null) ??
    (typeof event.monogram_custom_svg === 'string' && event.monogram_custom_svg.trim()
      ? event.monogram_custom_svg
      : null);
  const studioCfg = sanitizeStudioConfig(event.monogram_studio_config);
  const studioAnim: StudioAnim = studioCfg?.anim
    ? { kind: studioCfg.anim.kind, dur: studioCfg.anim.dur, smooth: studioCfg.anim.smooth, delay: studioCfg.anim.delay }
    : DEFAULT_STUDIO_ANIM;
  const revealLabel = STUDIO_REVEAL_LABELS[studioAnim.kind];

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
  // Canonical URL form — nested /u/ under the cutover flag, bare root otherwise
  // (resolve self-noops OFF; no query pre-cutover).
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
  const publicLandingUrl = event.slug
    ? buildEventLandingUrl({ appUrl, slug: event.slug, ownerSlug })
    : null;

  // Price comes ONLY from the admin V2 catalog (owner rule 2026-06-14 — no
  // hardcoded price). null when the row is unreadable → the buy block degrades.
  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? null;

  return (
    <section id="animated-monogram" className="scroll-mt-24 space-y-5 border-t border-ink/10 pt-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Animated monogram
        </p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Make your mark move
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          {bespokeSvg ? (
            <>
              Your monogram already opens your wedding website. This upgrade makes it
              draw itself in — playing the reveal you picked in the studio above
              (Handwriting, Trace, Droplet, Gold Turn, or Molten Gold) the moment a
              guest lands.
            </>
          ) : (
            <>
              Your monogram already opens your wedding website. This upgrade makes it
              draw itself in — pick from six motion signatures (Drawn, Foil, Bloom,
              Editorial, Halo, Stardust) and it plays the moment a guest lands.
            </>
          )}
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
          bespokeSvg={bespokeSvg}
          studioAnim={studioAnim}
          revealLabel={revealLabel}
        />
      ) : (
        <UnownedView
          monogram={monogram}
          pricePhp={pricePhp}
          eventId={eventId}
          displayName={event.display_name}
          motion={motion}
          motionLabel={motionLabel}
          bespokeSvg={bespokeSvg}
          studioAnim={studioAnim}
          revealLabel={revealLabel}
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
  bespokeSvg,
  studioAnim,
  revealLabel,
}: {
  monogram: ReturnType<typeof resolveMonogram>;
  publicLandingUrl: string | null;
  eventId: string;
  motion: MonogramMotionKey;
  motionLabel: string;
  /** The live (revoked_at IS NULL) monogram consent row, or null. */
  shareConsent: { consent_id: string; credit_mode: string } | null;
  /** The couple's studio/uploaded mark — when present, the hero plays the STUDIO
   *  reveal on THIS mark, so the preview must too (never the lockup signatures). */
  bespokeSvg: string | null;
  studioAnim: StudioAnim;
  revealLabel: string;
}) {
  // Gold/molten are metallic reveals — stage them on the same dark ground the
  // studio's preview and the reveal players use, so the metal reads.
  const metalStage = studioAnim.kind === 'gold' || studioAnim.kind === 'molten';
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-300/60 bg-success-50 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-success-800">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          {bespokeSvg
            ? `Your monogram plays your ${revealLabel} reveal on your wedding website.`
            : `Your monogram plays the ${motionLabel} motion on your wedding website.`}
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
          {bespokeSvg ? (
            /* The couple's REAL saved mark playing their REAL saved reveal — the
               identical component the live hero renders (StudioRevealPlayer).
               allowWebgl stays false: the maker page can co-mount the studio's
               molten portal, and one WebGL context is the budget on the phones
               we serve — molten degrades to Gold Turn here, exactly as it does
               on the website hero. key remounts so the reveal replays per visit. */
            <span
              className={`inline-flex h-40 w-40 items-center justify-center ${
                metalStage ? 'rounded-2xl p-4' : ''
              }`}
              style={
                metalStage
                  ? { background: 'radial-gradient(120% 90% at 50% 32%, #2b2638 0%, #14111c 58%, #0a0810 100%)' }
                  : undefined
              }
            >
              <StudioRevealPlayer
                key={`owned-studio-${studioAnim.kind}-${studioAnim.dur}-${studioAnim.delay}`}
                svg={bespokeSvg}
                monogram={monogram.text}
                anim={studioAnim}
                allowWebgl={false}
              />
            </span>
          ) : (
            /* key forces a remount so the chosen motion replays each page visit. */
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
          )}
        </div>
        <p className="mt-5 text-sm text-ink/60">
          This is exactly how it animates on your wedding website&rsquo;s hero.
          {bespokeSvg
            ? ' Change your mark or reveal in the studio above and the site follows.'
            : ' Change your mark or motion in the studio above and the animation follows.'}
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
  bespokeSvg,
  studioAnim,
  revealLabel,
}: {
  monogram: ReturnType<typeof resolveMonogram>;
  pricePhp: number | null;
  eventId: string;
  displayName: string | null;
  motion: MonogramMotionKey;
  motionLabel: string;
  /** The couple's studio/uploaded mark — when present, both sides of the
   *  before/after render THIS mark (static vs the STUDIO reveal), never the
   *  lockup-signature preview of a mark the couple doesn't use. */
  bespokeSvg: string | null;
  studioAnim: StudioAnim;
  revealLabel: string;
}) {
  const supabase = await createClient();
  const settings = await fetchPlatformSettings(supabase);
  const metalStage = studioAnim.kind === 'gold' || studioAnim.kind === 'molten';

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
            {bespokeSvg ? (
              <>
                Your mark, straight from the studio above. The upgrade makes it
                draw itself in with the reveal you picked — {revealLabel} — instead
                of just appearing.
              </>
            ) : (
              <>
                Same initials, same colours — straight from the studio above. The
                upgrade makes it move instead of just appearing, in the motion you
                pick from the six-signature library.
              </>
            )}
          </p>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-ink/10 bg-white/60 p-5 text-center">
            {/* Static side — exactly what the hero renders WITHOUT the upgrade:
                the couple's own mark (BespokeMonogramMark) when one exists, else
                the h-20 initials circle. */}
            {bespokeSvg ? (
              <BespokeMonogramMark svg={bespokeSvg} color={monogram.color} size="md" />
            ) : (
              <span
                aria-hidden
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 bg-cream font-serif text-2xl italic"
                style={{ borderColor: monogram.color, color: monogram.color }}
              >
                {monogram.text}
              </span>
            )}
            <p className="text-sm font-medium text-ink">Default — included free</p>
            <p className="text-xs text-ink/55">Appears the moment the page loads.</p>
          </div>

          <div className="relative flex flex-col items-center gap-3 rounded-xl border border-terracotta/30 bg-white/60 p-5 text-center">
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta">
              <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
              Upgrade
            </span>
            {bespokeSvg ? (
              /* The couple's REAL mark playing their REAL saved reveal — the same
                 component the live hero uses. allowWebgl false (one WebGL context
                 budget; molten shows as Gold Turn here AND on the hero). key
                 remounts so the reveal replays per render. */
              <span
                className={`inline-flex h-20 w-20 items-center justify-center ${
                  metalStage ? 'rounded-xl p-2' : ''
                }`}
                style={
                  metalStage
                    ? { background: 'radial-gradient(120% 90% at 50% 32%, #2b2638 0%, #14111c 58%, #0a0810 100%)' }
                    : undefined
                }
              >
                <StudioRevealPlayer
                  key={`preview-studio-${studioAnim.kind}-${studioAnim.dur}-${studioAnim.delay}`}
                  svg={bespokeSvg}
                  monogram={monogram.text}
                  anim={studioAnim}
                  allowWebgl={false}
                />
              </span>
            ) : (
              /* key remounts the component so the motion replays on each render. */
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
            )}
            <p className="text-sm font-medium text-ink">
              {bespokeSvg ? `Animated — your ${revealLabel} reveal` : `Animated — your ${motionLabel} motion`}
            </p>
            <p className="text-xs text-ink/55">
              {bespokeSvg
                ? 'Change the reveal anytime in the studio above — the site follows.'
                : 'One of six signatures — pick yours in the studio above.'}
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
            {bespokeSvg
              ? 'Your studio mark draws itself in with the reveal you picked above.'
              : 'Your initials traced on with a hand-drawn pen-stroke reveal.'}
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
