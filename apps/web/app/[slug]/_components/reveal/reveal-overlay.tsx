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
 *   ALL REVEAL IS PAID (owner 2026-09-24) — lib/reveal-access.ts decides:
 *   - the event holds Event Hub Pro (`premiumUnlocked`) → the couple's choice,
 *     else the admin house default `config.defaultTemplate`. A free couple gets
 *     no reveal. The admin toggle `config.enabled` is NOT an entitlement any more
 *     (it used to switch the paid veil on for every free couple).
 *   - global flag  `NEXT_PUBLIC_STD_REVEAL=1`  → staff preview builds only
 *   - per-visit URL `?reveal=<id>` → overrides the template for that one visit,
 *     but ONLY on a build where NEXT_PUBLIC_STD_REVEAL=1 (how we demo on Vercel
 *     previews). In production the flag is off and the param is inert — it is a
 *     preview affordance, never an entitlement (SEC-3, 2026-07-26: it used to
 *     unlock the paid ₱999 opening for any visitor who typed it).
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
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
// Imported, never re-typed: a hand-copied event name drifts silently and the
// veil simply stops standing down, with nothing failing.
import { STD_FILM_EXIT_EVENT } from '../save-the-date-film';
import { STD_FILM_RETURN_EVENT } from '../std-film-handoff';
import { FourFlapEnvelope } from './four-flap';
import { RigidReveal } from './rigid-reveal';
import {
  isVeilTemplate,
  NO_REVEAL,
  resolveRevealOverride,
  type RevealTemplate,
} from './reveal-templates';
import type { WaxSealConfig } from '@/lib/wax-seal/types';
import type { RevealStudioConfig, RevealTemplateId } from '@/lib/reveal-config';
import { rigidEffectFor, tuneRevealLooks, type RevealEffects } from '@/lib/std-reveal-effects';
import { markRevealSeen, revealAlreadySeen } from '@/lib/reveal-once-per-visit';
import { COVER_SCENE_SELECTOR, coverOnScreen, drapeShift, drapeShows, landedOnTheFirstPage } from '@/lib/reveal-stages';
import { revealAllowedFor } from '@/lib/reveal-access';
import { revealMaterialVars, type RevealMaterials } from '@/lib/reveal-materials';
import { claimVeilHold, ensureVeilHold, releaseVeilHold, unveilInGesture, REVEAL_LAYER_ATTR } from '@/lib/hub-veil';

// NOTE: the gold-monogram + molten-monogram openings were RETIRED here (owner
// 2026-06-22 "this is monogram animation, not a reveal") — they now live ONLY as
// monogram-editor animation choices (the 'gold'/'molten' motion keys), played by
// HeroMonogram on the surfaces that show the mark (incl. the film's monogram
// beat that this opening uncovers). The five envelope/veil openings remain.
const VeilReveal = dynamic(() => import('./veil-reveal'), { ssr: false });

export type { RevealTemplate } from './reveal-templates';
export type { WaxSealConfig } from '@/lib/wax-seal/types';

type Props = {
  /** True when the page is in the Save-the-Date phase (the only place it shows). */
  enabled: boolean;
  /**
   * 🔴 THE LOOK'S WAX SEAL ON THE VEIL (`<KitSeal>`, `lib/art-kits.ts`, owner 2026-10-16) — drawn over the closed veil,
   * just above its one instruction, fading with it. Decorative and deaf to the pointer: a tap on it lands on the veil's
   * own hit-zone underneath, so the seal's tap IS the veil's tap (`unveil()` in `veil-reveal.tsx`) — one handler.
   * Absent → the veil exactly as before. The veil only (the rigid openings carry their own seal).
   */
  kitSeal?: ReactNode;
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
  /** The event holds Event Hub Pro (COUPLE_WEBSITE_PRO → STD_PREMIUM_OPENINGS).
   *  Since 2026-09-24 ("all reveal is paid") this is the ONLY path to a reveal
   *  for a public guest — see lib/reveal-access.ts. */
  premiumUnlocked?: boolean;
  /**
   * ONE REVEAL ON THE WAY IN (owner Q6 = B, 2026-09-11 · lib/reveal-once-per-
   * visit.ts). Which side of the hand-off this mount is:
   *
   *   · `'record'` — the INVITE door. When its reveal actually shows, it writes
   *     "seen" for this event into `sessionStorage`.
   *   · `'defer'`  — the EVENT HUB. On mount it reads that mark and, if the
   *     guest has just come through the invite doors, stands aside for the rest
   *     of this tab's life. A later visit is a new session and plays as usual.
   *
   * Absent on every other mount, and absent means neither — nothing changes for
   * a page that does not pass it.
   *
   * 🪤 STANDING ASIDE MUST STILL START THE FILM. It does, and it does it through
   * the mechanism that was already there rather than a new one: the film starts
   * itself after a 700 ms grace unless `window.__stdRevealActive` is set
   * (`save-the-date-film.tsx`), and a deferred overlay never sets it — `showing`
   * below is false from the first render onward, exactly as it is for a couple
   * who chose "No Reveal". Do NOT dispatch `std-reveal-done` from here to "make
   * sure": that is the FIRST-LIFT signal, and firing it on mount would also tell
   * the veil-and-film handshake a lift happened that never did.
   */
  oncePerVisit?: 'record' | 'defer';
  /**
   * The event this reveal belongs to — the key the mark above is stored under,
   * so two invitations open in one tab never silence each other. Passed down by
   * `RevealOverlayServer` from the id it already holds.
   */
  seenEventId?: string | null;
  /**
   * The THEME's materials for this opening (Maker Phase 6 · `lib/reveal-materials.ts`):
   * paper, liner and door colours as token overrides on the opening's own box,
   * and the seal. Null/absent = Classic, exactly the shipped look. The sheer
   * veil is never dressed here (owner 2026-09-24: "the veil is untouched").
   */
  materials?: RevealMaterials | null;
  /**
   * 🎭 THE HERO SCENE ONLY (owner 2026-09-25, verbatim: *"having it on the
   * invitation and on the day will onlay be during the hero scene (First page)
   * after that, it will disappear"*). Set by the Event Hub on the Invitation and
   * On the Day (`revealOnlyOnTheFirstPage`, lib/reveal-stages.ts):
   *
   *   · a guest who lands part-way down the page (a `#section` link, a restored
   *     scroll) is not met by it at all — it belongs to the first page;
   *   · scrolling past the first page BEFORE it is opened retires it;
   *   · 🎭 once opened, the LIFTED veil — the drape at the top — STAYS ON THE
   *     COVER and leaves and returns with it (owner 2026-10-17, verbatim: *"the
   *     veil disappears. it shouldn't. it should stay until cover is gone. and
   *     return when cover scene returns"* — superseding "once opened it is GONE"
   *     for the drape). It never closes again (`keepsOpen` on the veil): one
   *     unveil per visit. The rule is `drapeShows` (`lib/reveal-stages.ts`).
   *
   * Absent on the Save the Date, where the opening leads the film and keeps its
   * persistent valance (2026-06-18/19 rulings, unchanged).
   *
   * ⬅ THE LANDING HALF IS NOT THIS PROP'S (2026-09-29). A guest who lands
   * part-way down is not met by ANY opening — on the Save the Date too: there
   * the film the opening leads is already lifted for that landing
   * (`StdFilmHandoff`, the same `landedOnTheFirstPage` rule), so a veil would
   * cover the page with nothing to lead. "Back to the invitation" from Find
   * your seat (`/slug#site-details`) replayed the whole film before this.
   */
  firstPageOnly?: boolean;
  /**
   * 🎬 ▶ ON THE MAKER'S COVER SCENE (owner-approved 2026-10-16; controller 2026-10-17: "the SAME veil guests get") —
   * this very overlay, played once in the Maker's canvas: the closed veil and its one instruction, then it lifts by
   * itself after `liftAfterMs` (`VeilReveal` `autoplay`). It touches nothing of the page's: no hold on what plays
   * behind, no "seen" mark, no film signal, no page flag — `CoverPlayOpening` mounts it for one ▶ and takes it away.
   */
  preview?: { liftAfterMs: number; onLift?: () => void } | null;
};

const FLAG_ON = process.env.NEXT_PUBLIC_STD_REVEAL === '1';

/** 👆 The veil's one instruction (owner 2026-10-15, verbatim: *"Tap, swipe up to unveil"*). */
export const VEIL_HINT = 'Tap or swipe up to unveil';

/** 🎭 On the page (`<html>`) while a guest is looking at the opening — read by the Scrub island (`hub-scrub.tsx`). */
export const REVEAL_UP_ATTR = 'data-reveal-up';

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
  oncePerVisit,
  seenEventId = null,
  materials = null,
  firstPageOnly = false,
  kitSeal = null,
  preview = null,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [reveal, setReveal] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [open, setOpen] = useState(false);
  /* 👆 The guest has tapped or swiped up: the instruction is done the moment the gesture lands — not when the cloth has
     finished rising (live 2026-10-15, `/cale-ice`: the pill stayed ~10 s through the hands-free lift). */
  const [lifting, setLifting] = useState(false);
  const [gone, setGone] = useState(false);
  // 🎚 The couple's fine-tune over the house look (Maker's Reveal page) —
  // untouched when they tuned nothing. `lib/std-reveal-effects.ts`.
  const looks = tuneRevealLooks(config, eventEffects?.tune);
  // Read in the SAME effect that sets `mounted`, so it is known before this
  // component has ever rendered anything: the overlay renders null until
  // mounted, so a deferred one goes from nothing to nothing.
  const [alreadySeen, setAlreadySeen] = useState(false);
  const [offTheFirstPage, setOffTheFirstPage] = useState(false);
  /* 🎭 THE DRAPE STAYS WITH THE COVER (owner 2026-10-17). Off the Save the Date, from the unveil gesture on, the lifted
     veil is drawn exactly while the Cover Scene is on screen (`drapeShows`) and rides the cover's top edge out. */
  const unveiled = lifting || open;
  const drapeMode = firstPageOnly && unveiled && !preview;
  const [coverInView, setCoverInView] = useState(true);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      setReveal(new URLSearchParams(window.location.search).get('reveal') ?? '');
      setReducedMotion(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
      if (oncePerVisit === 'defer') {
        setAlreadySeen(revealAlreadySeen(window.sessionStorage, seenEventId));
      }
      // Every stage: a part-way-down landing is not met by the opening (see the
      // `firstPageOnly` prop). Read HERE, in the effect that sets `mounted`, so
      // a stood-down opening never draws a frame — not left to the film
      // handoff's lift event, which this overlay may mount after.
      if (!landedOnTheFirstPage({ hash: window.location.hash, scrollY: window.scrollY, viewportHeight: window.innerHeight }) && !preview) {
        setOffTheFirstPage(true);
      }
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SEC-3 (2026-07-26): `?reveal=` is a PREVIEW affordance, not an entitlement.
  // It used to be honoured for any visitor, which handed the paid ₱999 opening
  // to anyone who typed it — and also overrode the admin's allowed-openings map
  // and the couple's "No Reveal" choice, since everything below keys off
  // `override`. It is now scoped to the env-only preview flag, which no visitor
  // can set. See resolveRevealOverride() in ./reveal-templates for the full note.
  const override = resolveRevealOverride(reveal, FLAG_ON);
  // ALL REVEAL IS PAID (owner 2026-09-24). The one decision lives in
  // lib/reveal-access.ts and is shared with the server mount
  // (reveal-overlay-server.tsx), which does not even mount this overlay for a
  // couple without Event Hub Pro. The admin master toggle (`config.enabled`) is
  // NOT an input — it used to switch the paid veil on for every free couple.
  const decision = revealAllowedFor({
    ownsPro: premiumUnlocked,
    chosenTemplate: eventTemplate,
    adminDefault: config?.defaultTemplate,
    isStaffPreview: FLAG_ON,
    previewOverride: override,
    allowed: config?.templates,
  });
  const template: RevealTemplate = decision === NO_REVEAL ? 'four-flap' : decision;
  const veil = isVeilTemplate(template);

  const active =
    enabled &&
    !reducedMotion &&
    !alreadySeen &&
    !offTheFirstPage &&
    decision !== NO_REVEAL;

  /* 🎭 Off the Save the Date it is the first page's: scrolling past the first screen BEFORE it is opened retires it.
     Once opened it is never retired — the lifted drape follows the cover instead (the effect below). It used to be
     retired ~1.8 s after the lift, which is what the owner saw vanish on 2026-10-17. */
  useEffect(() => {
    if (!firstPageOnly || !active || unveiled) return;
    const onScroll = () => {
      if (window.scrollY > window.innerHeight) setGone(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [firstPageOnly, active, unveiled]);

  /* 🎭 THE DRAPE GOES WHERE THE COVER GOES (owner 2026-10-17). ONE IntersectionObserver on the Cover Scene says when
     any of it is on screen — the bars' own edge (`cover-scene-menu.tsx`), so drape and bars are never up together —
     and the drape is hidden and its cloth PAUSED while it is not (`paused` on the veil: no frames off screen). While it
     is, the layer rides the cover's top edge on the scroll (one transform per frame, no React render), so the drape
     leaves WITH the cover rather than vanishing. A page with no Cover Scene keeps the first screen as its cover; a
     cover that is not drawn (another tab) is gone. A browser with no IntersectionObserver measures on the scroll. */
  useEffect(() => {
    if (!drapeMode) return;
    const layer = layerRef.current;
    let raf = 0;
    const coverBox = (): { top: number; bottom: number } | null => {
      const h = document.querySelector<HTMLElement>(COVER_SCENE_SELECTOR);
      if (!h) return { top: -window.scrollY, bottom: window.innerHeight - window.scrollY };
      return h.offsetParent !== null || getComputedStyle(h).position === 'fixed' ? h.getBoundingClientRect() : null;
    };
    const measure = () => {
      raf = 0;
      const box = coverBox();
      const inView = coverOnScreen(box, window.innerHeight);
      setCoverInView(inView);
      if (layer) layer.style.transform = box && inView ? `translate3d(0, ${drapeShift(box.top)}px, 0)` : '';
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(measure);
    };
    const later = () => window.setTimeout(schedule, 60);
    const cover = document.querySelector<HTMLElement>(COVER_SCENE_SELECTOR);
    const io = cover && typeof IntersectionObserver === 'function' ? new IntersectionObserver(schedule, { threshold: 0 }) : null;
    if (cover && io) io.observe(cover);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    document.addEventListener('click', later, true);
    measure();
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      io?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
      document.removeEventListener('click', later, true);
      if (layer) layer.style.transform = '';
    };
  }, [drapeMode]);

  // Tell the film (z-50) whether a reveal will actually show, so it knows to WAIT
  // for the lift instead of auto-starting under the veil (owner 2026-06-19
  // "content will play [only once] the veil is up"). The film reads this flag
  // after a short grace; if it's set, the content holds until 'std-reveal-done'.
  /**
   * THE VEIL RETIRES WITH THE FILM — and comes back with it.
   *
   * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
   * The veil is a PERSISTENT top layer by owner ruling (2026-06-18 "reveal stays
   * on top, not under"; 2026-06-19 "I still want the veil accessible but also
   * want to navigate the messages"). Both were exactly right WHEN THE FILM WAS
   * THE WHOLE PAGE: a curtain permanently over a film is one experience, and the
   * top valance is how you pull it back down.
   *
   * The film handoff then put the browsable SITE underneath that same z-60
   * layer. So a decision about the Save-the-Date silently became a decision
   * about the entire website — the veil's petals kept falling across the dress
   * code, the schedule and everything else. The owner caught it on his phone
   * (2026-08-04): "the save the date reveal only stays on the save the date and
   * not the rest of the website."
   *
   * ── WHY RETIRE RATHER THAN UNMOUNT ON LIFT ─────────────────────────────────
   * Unmounting when the veil is first lifted would reverse BOTH 2026-06 rulings
   * and delete the re-cover gesture — and the veil is part of the PAID
   * cinematic opening. So it stays exactly as it was for as long as the film is
   * the experience, and stands down only when the visitor deliberately steps out
   * to the site. "Watch our film again" brings both back together.
   */
  useEffect(() => {
    const retire = () => setGone(true);
    const restore = () => setGone(false);
    window.addEventListener(STD_FILM_EXIT_EVENT, retire);
    window.addEventListener(STD_FILM_RETURN_EVENT, restore);
    return () => {
      window.removeEventListener(STD_FILM_EXIT_EVENT, retire);
      window.removeEventListener(STD_FILM_RETURN_EVENT, restore);
    };
  }, []);

  useEffect(() => {
    if (preview) return;
    const showing = active && mounted && !gone;
    (window as Window & { __stdRevealActive?: boolean }).__stdRevealActive = showing;
    /* 🎭 …and it is said ON THE PAGE (`REVEAL_UP_ATTR`), for what must wait for the opening to go: a cover that
       hands over by Scrub holds from the very top of the page, under this overlay, and the page scrolls beneath it —
       so the hand-overs wait for this mark to come off (`hub-scrub.tsx`). Nothing is drawn or styled by it.
       The drape that stays with the cover (2026-10-17) is an OPENED veil — the mark comes off at the unveil. */
    document.documentElement.toggleAttribute(REVEAL_UP_ATTR, showing && !drapeMode);
    /*
      THE MARK IS WRITTEN WHERE THE REVEAL IS MEASURED, NOT WHERE IT IS DRAWN.
      `showing` is the one expression in this file that means "a guest is
      actually looking at the opening" — it already gates the film handshake
      above, and every reason the overlay stands down (reduced motion, No
      Reveal, the admin map, a lapsed unlock, the wrong phase) is folded into
      it. Writing the mark from a render branch instead would have recorded
      "seen" for guests who were shown nothing.
    */
    if (showing && oncePerVisit === 'record') markRevealSeen(window.sessionStorage, seenEventId);
    return () => {
      (window as Window & { __stdRevealActive?: boolean }).__stdRevealActive = false;
      document.documentElement.removeAttribute(REVEAL_UP_ATTR);
    };
  }, [active, mounted, gone, oncePerVisit, seenEventId, drapeMode]);

  /*
    🙈 NOTHING BEHIND IT PLAYS UNTIL IT IS OPENED (owner 2026-10-15 · `lib/hub-veil.ts`). The server wrote the
    hold before the body parsed; THIS is where it is decided whether it stays. The same `showing` the film
    handshake reads: an opening a guest is really looking at keeps the page held (the veil claims it once its
    hit-zone is armed; a rigid opening is drawn at once, so it claims here) — and every reason it stands down
    lets the page play. Waits for `mounted`: the very first render knows none of the reasons yet.
  */
  useEffect(() => {
    if (!mounted || preview) return;
    if (!active || gone) {
      releaseVeilHold();
      return;
    }
    ensureVeilHold();
    if (!veil) claimVeilHold();
  }, [active, mounted, gone, veil]);

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
      <div
        ref={layerRef}
        className={`pointer-events-none fixed inset-0 z-[60] overflow-hidden ${drapeMode && !drapeShows({ unveiled, coverInView }) ? 'invisible' : ''}`}
        {...{ [REVEAL_LAYER_ATTR]: '' }}
        /* 🎭 What the drape is doing — read by the walk and the guard, styles nothing: `on` with the cover, `away` without. */
        data-veil-drape={drapeMode ? (drapeShows({ unveiled, coverInView }) ? 'on' : 'away') : undefined}
      >
        <VeilReveal
          veilColor={eventEffects?.veilColor ?? veilColor}
          petalsColor={eventEffects?.petalColor ?? petalsColor}
          look={looks.veil}
          /* 🎭 Off the Save the Date: one unveil per visit — the lifted drape never takes a hand again (2026-10-17). */
          keepsOpen={firstPageOnly && !preview}
          /* …and no frames while the cover (and so the drape) is off screen. */
          paused={drapeMode && !drapeShows({ unveiled, coverInView })}
          autoplay={preview !== null}
          autoplayAfterMs={preview?.liftAfterMs}
          /* 🎬 ▶ in the Maker: no hand lifts it — the instruction goes the moment it starts to rise by itself, and the
             cover's lines enter on that same moment (`CoverPlayOpening` → `playCover`). */
          onAutoLift={
            preview
              ? () => {
                  setLifting(true);
                  preview.onLift?.();
                }
              : undefined
          }
          features={{
            petals: eventEffects?.petals ?? config?.features?.petals ?? true,
            logo: config?.features?.logo ?? true,
            music: eventEffects?.music ?? config?.features?.music ?? false,
          }}
          /* 👆 THE TAP / SWIPE UP ITSELF, synchronously inside its pointerup: the page behind starts, and the
             music with it (owner 2026-10-15: "when they unveil, the music starts playing upon tap"). */
          onUnveil={() => {
            unveilInGesture();
            setLifting(true);
          }}
          onRevealed={() => {
            if (preview) return setOpen(true);
            // Start the film once, on the first lift; keep the veil on top.
            if (!open) window.dispatchEvent(new CustomEvent('std-reveal-done'));
            setOpen(true);
            // A lift with no gesture (no WebGL, reduced motion switched on) still lets the page play.
            releaseVeilHold();
          }}
        />
        {/* Legible instruction (owner 2026-06-20 "the text at the bottom should
            be visible so old people can understand the app"): larger type, full
            contrast, and a soft dark scrim so cream text never washes out on a
            light/ivory veil. Still fades once the veil is lifted.

            ✉️ 2026-08-24 (H-1) — IT ASKS LIKE AN INVITATION NOW, NOT LIKE A
            TERMINAL. Measured on the live site at 375px: DM Mono, UPPERCASE,
            3.52px and 2.24px of letter-spacing — a monospaced DATA face, set as
            a system message, on the first thing a guest ever sees of somebody's
            wedding. The WORDS are unchanged and deliberately so: they are the
            owner's, and they are what made this understandable in the first
            place. Only the voice setting them changed.

            🔒 LEGIBILITY GOES UP, NEVER DOWN. That is the owner's lock on this
            pill, so it is a constraint to clear, not something to trade against
            a prettier face. The headline grows 16px → 24px. The second line
            keeps its size and drops ALL-CAPS-at-wide-tracking, which is
            measurably slower to read than sentence case. Scrim, contrast and
            text-shadow are untouched.

            📏 "you" WAS STRANDED ALONE ON ITS OWN LINE — measured on the live
            page, not assumed: at 375px the second line rendered as
            "or double-tap to lift it for" / "you". `text-balance` makes the
            browser even the lines out, so the fix survives a longer translation
            instead of depending on this exact string happening to fit.

            ⛔ NOT H-2. That is the FILM's label face (`lib/std-themes.ts`), it
            is owner-gated, and nothing here touches it. This is the reveal
            overlay — a different component, and W3-D's own scheduled item.

            👆 2026-10-15 — ONE LINE NOW, IN THE OWNER'S NEW WORDS (*"before we
            had double tap to unveil. now we make it simpler. Tap, swipe up to
            unveil"*). The two lines ("Lift the veil ↑" / "or double-tap to lift
            it for you") said two gestures; there is one instruction now, set at
            the headline's 24px, so legibility still only went up. */}
        {/* 🍪 ABOVE THE FIRST-VISIT COOKIE NOTICE (Batch 8 tester R3, 2026-10-15: the notice, z 70 over the veil's 60,
            covered this — the veil's ONE instruction — until it was answered). It stands the notice's published
            height (`--cookie-banner-top`, 0 once answered or off a phone) above its old 4rem, as #6518 did. */}
        {kitSeal ? (
          <div
            data-veil-seal=""
            className={`pointer-events-none absolute inset-x-0 transition-opacity ${
              lifting ? 'opacity-0 duration-0' : open ? 'opacity-0 duration-500' : 'opacity-100 duration-500'
            }`}
            style={{ bottom: 'calc(4rem + 4.75rem + var(--cookie-banner-top, 0px))', height: '86px' }}
          >
            {kitSeal}
          </div>
        ) : null}
        <div
          data-veil-hint=""
          className={`pointer-events-none absolute inset-x-0 flex justify-center transition-opacity ${
            lifting ? 'opacity-0 duration-0' : open ? 'opacity-0 duration-500' : 'opacity-100 duration-500'
          }`}
          style={{ bottom: 'calc(4rem + var(--cookie-banner-top, 0px))' }}
        >
          <div className="rounded-full bg-black/35 px-6 py-3 text-center backdrop-blur-[2px]">
            <p className="text-balance font-display text-2xl font-medium leading-snug text-cream [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
              {VEIL_HINT}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Rigid family — RigidStage owns the seal-swipe gate + scroll-scrub open and
  // fires onOpened once the flaps are fully clear; we then remove the overlay.
  const onOpened = () => {
    releaseVeilHold();
    window.dispatchEvent(new CustomEvent('std-reveal-done'));
    setGone(true);
  };
  // Couple-chosen decorative effect that plays as the opening parts:
  // butterflies on envelopes, petals on church doors (null → none).
  const rigidEffect = eventEffects ? rigidEffectFor(template, eventEffects) : null;
  return (
    <div
      className="fixed inset-0 z-[60] overflow-hidden"
      {...{ [REVEAL_LAYER_ATTR]: '' }}
      data-reveal-dressed={materials ? '' : undefined}
      style={revealMaterialVars(materials ?? null) as CSSProperties}
    >
      {template === 'two-flap-vertical' ||
        template === 'two-flap-horizontal' ||
        template === 'church-doors' ? (
        <RigidReveal
          variant={template}
          markSvg={markSvg}
          monogram={monogram}
          waxColor={materials?.seal ?? waxColor}
          config={sealConfig}
          fallbackSeed={sealFallbackSeed}
          onOpened={onOpened}
          effect={rigidEffect}
          effectLook={looks.effects}
        />
      ) : (
        <FourFlapEnvelope
          markSvg={markSvg}
          monogram={monogram}
          waxColor={materials?.seal ?? waxColor}
          config={sealConfig}
          fallbackSeed={sealFallbackSeed}
          onOpened={onOpened}
          effect={rigidEffect}
          effectLook={looks.effects}
        />
      )}
    </div>
  );
}
