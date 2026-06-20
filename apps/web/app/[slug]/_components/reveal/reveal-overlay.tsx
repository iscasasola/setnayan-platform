'use client';

/**
 * RevealOverlay — the opening "reveal" layer for the couple website.
 *
 * Mounts a full-screen reveal (one of the envelope / door / veil templates) over
 * the Save-the-Date (and later RSVP) phase. The guest opens it to uncover the
 * invitation beneath: rigid templates are gated by swiping the couple's monogram
 * wax seal off, then SCROLL scrubs the flaps open (§1a); veils lift on drag/scroll.
 *
 * Progressive enhancement: renders nothing on the server and until mounted, so a
 * guest with JS disabled (or before hydration) sees the content directly — the
 * reveal is a delight layer, never a gate. Once opened it removes itself so the
 * page underneath is fully interactive. Honors prefers-reduced-motion (those
 * guests skip the reveal and see the content directly).
 *
 * Activation (the caller passes `enabled` = "we're in the Save-the-Date phase"):
 *   - admin toggle `config.enabled` (DB `reveal_studio_config`, set in the
 *     /admin/reveal-studio Reveal Studio) → on for everyone, `config.defaultTemplate`
 *   - global flag  `NEXT_PUBLIC_STD_REVEAL=1`  → legacy env fallback (kept for previews)
 *   - per-visit URL `?reveal=<id>` → activates AND overrides the template for that
 *     one visit, even when the toggle is off (how we demo on Vercel previews).
 *     Accepted ids in ./reveal-templates REVEAL_ALIASES, e.g. ?reveal=church-doors.
 *
 * The admin also customizes the veil look + per-feature toggles via `config`
 * (resolved from lib/reveal-config); those flow into the veil as `look`/`features`.
 *
 * Template registry is a switch (./reveal-templates). The rigid families are pure
 * CSS-3D (in the main chunk, Lighthouse-safe); the two WebGL veils are lazy-loaded
 * via next/dynamic (ssr:false) so three.js lands in a code-split chunk fetched
 * only when a veil actually mounts — the main couple-site bundle stays clean.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FourFlapEnvelope } from './four-flap';
import { RigidReveal } from './rigid-reveal';
import { isVeilTemplate, NO_REVEAL, REVEAL_ALIASES, type RevealTemplate } from './reveal-templates';
import type { WaxSealConfig } from '@/lib/wax-seal/types';
import type { RevealStudioConfig, RevealTemplateId } from '@/lib/reveal-config';
import { rigidEffectFor, type RevealEffects } from '@/lib/std-reveal-effects';

const VeilReveal = dynamic(() => import('./veil-reveal'), { ssr: false });

export type { RevealTemplate } from './reveal-templates';
export type { WaxSealConfig } from '@/lib/wax-seal/types';

type Props = {
  /** True when the page is in the Save-the-Date phase (the only place it shows). */
  enabled: boolean;
  /** Short couple monogram for the seal fallback, e.g. "A & J". */
  monogram: string;
  /** The couple's monogram SVG markup (uploaded/custom) — pressed into the seal. */
  markSvg?: string | null;
  /** Wax seal colour (hex) — the Mood Board deep accent. */
  waxColor?: string;
  /** The minted wax-seal recipe (candle-stamp maker). Null → default levers. */
  sealConfig?: WaxSealConfig | null;
  /** Stable seed for an un-minted seal (public_id-derived). */
  sealFallbackSeed?: number;
  /** Veil tulle colour (hex) from the Mood Board palette. */
  veilColor?: string;
  /** Rose-petal colour (hex) from the Mood Board palette. Blush-rose default. */
  petalsColor?: string;
  /** Resolved admin Reveal Studio config (master toggle · default template · veil look · features). */
  config?: RevealStudioConfig;
  /** The couple's chosen opening (events.std_reveal_template) — overrides the
   *  admin house default, beneath a per-visit ?reveal= override. (PR4 P4)
   *  'none' = the couple chose No Reveal (free → no opening; film plays directly). */
  eventTemplate?: RevealTemplateId | typeof NO_REVEAL | null;
  /** The couple's reveal effect toggles (events.std_reveal_effects, resolved):
   *  butterflies → envelopes · petals → church doors + veil. (2026-06-18) */
  eventEffects?: RevealEffects;
  /** The couple owns the premium openings unlock (PR4 P5) — an additive
   *  activation path alongside the admin global toggle + the ?reveal= override.
   *  Dormant until the STD_PREMIUM_OPENINGS SKU is sellable. */
  premiumUnlocked?: boolean;
};

const FLAG_ON = process.env.NEXT_PUBLIC_STD_REVEAL === '1';

export function RevealOverlay({
  enabled,
  monogram,
  markSvg = null,
  waxColor = '#5c2542',
  sealConfig = null,
  sealFallbackSeed,
  veilColor = '#f3ece1',
  petalsColor = '#e87a93',
  config,
  eventTemplate = null,
  eventEffects,
  premiumUnlocked = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [reveal, setReveal] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setReveal(new URLSearchParams(window.location.search).get('reveal') ?? '');
      setReducedMotion(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    } catch {
      /* noop */
    }
  }, []);

  const override = reveal ? REVEAL_ALIASES[reveal] ?? null : null;
  // The couple choosing No Reveal ('none') means no opening at all — even with
  // the premium unlock (folded into `active` below). The ?reveal= override
  // still wins (admin/demo). Here we just narrow 'none' out of the template chain.
  const eventChoice = eventTemplate === NO_REVEAL ? null : eventTemplate;
  let template: RevealTemplate =
    override ?? eventChoice ?? config?.defaultTemplate ?? 'four-flap';
  // Honor the admin "allowed openings" map: an opening the admin deactivated
  // (config.templates[id] === false) falls back to the house default — or the
  // first still-enabled opening. The ?reveal= preview override bypasses this.
  const allowedMap = config?.templates as Record<string, boolean> | undefined;
  if (!override && allowedMap && allowedMap[template] === false) {
    const def = config?.defaultTemplate;
    template =
      def && allowedMap[def] !== false
        ? def
        : ((Object.keys(allowedMap) as RevealTemplate[]).find(
            (t) => allowedMap[t] !== false,
          ) ?? template);
  }
  const veil = isVeilTemplate(template);

  const configEnabled = config?.enabled ?? false;
  // Openings activate on ANY of: the admin global toggle (free-for-all) · the
  // ?reveal= preview override · OR the couple owning the premium unlock (PR4 P5,
  // dormant until the SKU sells). The free film beneath always plays regardless.
  const active =
    enabled &&
    !reducedMotion &&
    !(eventTemplate === NO_REVEAL && !override) &&
    (configEnabled || FLAG_ON || override !== null || premiumUnlocked);

  // Tell the film (z-50) whether a reveal will actually show, so it knows to WAIT
  // for the lift instead of auto-starting under the veil (owner 2026-06-19
  // "content will play [only once] the veil is up"). The film reads this flag
  // after a short grace; if it's set, the content holds until 'std-reveal-done'.
  useEffect(() => {
    const showing = active && mounted && !gone;
    (window as Window & { __stdRevealActive?: boolean }).__stdRevealActive = showing;
    return () => {
      (window as Window & { __stdRevealActive?: boolean }).__stdRevealActive = false;
    };
  }, [active, mounted, gone]);

  if (!active || !mounted || gone) return null;

  if (veil) {
    // The veil is a PERSISTENT top layer, not a one-shot gate: the first lift
    // STARTS the film underneath (dispatch 'std-reveal-done') and the veil
    // stays mounted on top (z-60), drooped to its valance — we never fade it
    // out / unmount it (unlike the rigid openings, which truly part and clear).
    // (owner 2026-06-18 "reveal stays on top, not under")
    //
    // The veil AND the film must BOTH be reachable (owner 2026-06-19: "I still
    // want the veil accessible but also want to navigate the messages"). The
    // wrapper is pointer-events-none so the film (z-50) is reachable by default;
    // VeilReveal re-enables input only inside its own grab-zone (full-screen
    // while covering, top valance band once lifted). So: swipe the top band →
    // grab/re-cover the veil; swipe the body → scrub the film messages.
    return (
      <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
        <VeilReveal
          veilColor={eventEffects?.veilColor ?? veilColor}
          petalsColor={eventEffects?.petalColor ?? petalsColor}
          look={config?.veil}
          features={{
            petals: eventEffects?.petals ?? config?.features?.petals ?? true,
            logo: config?.features?.logo ?? true,
            music: eventEffects?.music ?? config?.features?.music ?? false,
          }}
          onRevealed={() => {
            // Start the film once, on the first lift; keep the veil on top.
            if (!open) window.dispatchEvent(new CustomEvent('std-reveal-done'));
            setOpen(true);
          }}
        />
        {/* Legible instruction (owner 2026-06-20 "the text at the bottom should
            be visible so old people can understand the app"): larger type, full
            contrast, and a soft dark scrim so cream text never washes out on a
            light/ivory veil. Still fades once the veil is lifted. */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-16 flex justify-center transition-opacity duration-500 ${
            open ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="rounded-full bg-black/35 px-6 py-3 text-center backdrop-blur-[2px]">
            <p className="font-mono text-base uppercase tracking-[0.22em] text-cream [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
              Lift the veil ↑
            </p>
            <p className="mt-1.5 font-mono text-sm uppercase tracking-[0.16em] text-cream/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
              or double-tap to lift it for you
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Rigid family — RigidStage owns the seal-swipe gate + scroll-scrub open and
  // fires onOpened once the flaps are fully clear; we then remove the overlay.
  const onOpened = () => {
    window.dispatchEvent(new CustomEvent('std-reveal-done'));
    setGone(true);
  };
  // Couple-chosen decorative effect that plays as the opening parts:
  // butterflies on envelopes, petals on church doors (null → none).
  const rigidEffect = eventEffects ? rigidEffectFor(template, eventEffects) : null;
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      {template === 'two-flap-vertical' ||
      template === 'two-flap-horizontal' ||
      template === 'church-doors' ? (
        <RigidReveal
          variant={template}
          markSvg={markSvg}
          monogram={monogram}
          waxColor={waxColor}
          config={sealConfig}
          fallbackSeed={sealFallbackSeed}
          onOpened={onOpened}
          effect={rigidEffect}
          effectLook={config?.effects}
        />
      ) : (
        <FourFlapEnvelope
          markSvg={markSvg}
          monogram={monogram}
          waxColor={waxColor}
          config={sealConfig}
          fallbackSeed={sealFallbackSeed}
          onOpened={onOpened}
          effect={rigidEffect}
          effectLook={config?.effects}
        />
      )}
    </div>
  );
}
