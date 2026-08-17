'use client';

import { useState } from 'react';
import { Home, Info, BookOpen, Camera, Images, Radio, User, Lock } from 'lucide-react';
import type { NavSlot } from '../_lib/site-nav';

/**
 * THE EVENT-SITE BOTTOM BAR — icon + label, one shape for everyone.
 *
 * ── WHAT CHANGED, AND WHY ───────────────────────────────────────────────────
 * This was a row of uppercase mono TEXT anchors. The owner designed a proper
 * bottom navigation across five rounds, then saw it live and said plainly:
 * *"bottom nav is not following the design"* and *"the contents of the menu
 * doesn't look clean and correct as what should have been planned"*. He was
 * right — a Camera had been bolted onto the old text bar instead of the
 * designed bar being built.
 *
 * ── THE DESIGN ──────────────────────────────────────────────────────────────
 *  · **Icon + label, always.** Never icons alone — the labelled grid every
 *    GCash user already knows, and the strongest convention in the PH market.
 *  · **Camera in the MIDDLE.** The widest, easiest place for a thumb, because
 *    on the day taking pictures is what people are actually doing.
 *  · **A slot with nothing behind it is not drawn**, and the others widen. A
 *    tab that leads nowhere teaches people the bar is unreliable.
 *  · **Except the camera, which LOCKS rather than vanishing.** An absent camera
 *    says the wedding has none; a dead button says the app is broken; a locked
 *    one with its reason says the truth (owner 2026-08-03 — the host holds the
 *    switch, and the camera is part of what the invitation promises).
 *  · **Watch gets its OWN slot**, never the gallery's: a guest must not lose the
 *    photos the moment a broadcast begins (owner: *"papic button as well"*).
 *  · **A home-indicator strip**, so labels never sit under an iPhone's home bar.
 *
 * Presentational and props-only — zero DB reads. Mounted only when
 * `siteMenuEnabled` (always on for the sample event).
 *
 * ── AND ON A DESKTOP IT STANDS UP (2026-08-17) ──────────────────────────────
 * 🚨 THE BAR WAS `fixed` AT EVERY WIDTH. Measured before this change: no
 * responsive modifier anywhere in it, so on a 1440px screen it striped the full
 * width of the glass with five tabs clustered in a centred 28rem group and a
 * metre of empty rule either side. That was shipped behaviour, not a
 * hypothetical — the guest tree used `sm:` 124 times, `lg:` 23 and `md:` ZERO,
 * and none of them reached this component.
 *
 * At `xl` (1280px) the pinned bar is not drawn at all and the SAME five slots
 * stand up as a rail down the left margin.
 *
 * ⚠ `xl`, NOT the app's usual `lg` phone↔desktop switch — and the reason is
 * ARITHMETIC, not taste. The rail floats in the left margin, which is
 * (viewport − the widest column any room uses) ÷ 2. Against the 64rem stage
 * that the venue page and the editorial use, `lg` leaves only 4rem and the rail
 * would sit ON TOP of them; `xl` leaves 8rem and a 7rem rail clears it. My
 * first cut used `lg` because I measured against the 48rem plate — the column
 * MOST rooms use, which is the wrong end of the range. `rail-fits.test.ts`
 * asserts the sum so the next person is told rather than trusted.
 *
 * 🔒 **SAME FIVE. SAME ORDER. NO SIXTH DESTINATION AT ANY WIDTH.** The five-slot
 * limit is an owner ruling and a wider screen is not a reason to reopen it — a
 * tab that appears only when there happens to be room teaches people the bar is
 * unreliable, which is the exact failure `site-nav.ts`'s rules exist to prevent.
 * The rail renders `slots` verbatim: it cannot add, drop or reorder one, because
 * it never decides anything — the resolver already did.
 *
 * 🔑 THE CAMERA IS NOT RE-CENTRED ON THE RAIL, AND THAT IS DELIBERATE. Putting
 * it in the middle is a THUMB decision — the widest, easiest reach on a phone
 * held one-handed. A vertical rail read by a mouse has no such centre, so the
 * camera keeps its ACTION COLOUR (what marks it as the destination) and drops
 * the centring (what was only ever ergonomics). Copying the middle position
 * across would be mimicking the shape instead of the reason.
 *
 * ⚖ BOTH FORMS ARE ALWAYS IN THE MARKUP and one is `display:none` at any given
 * width — which removes it from the accessibility tree too, so a screen reader
 * meets exactly one navigation, never two identically-labelled ones. This is a
 * CSS switch on purpose: measuring the viewport in JS would flash the wrong
 * form on first paint and can disagree with the CSS after a resize.
 */

/** The camera slot — Papic. Not an in-page anchor: it LEAVES for the capture
 *  surface, and it is the only slot that can be present-but-not-pressable. */
export type SiteMenuCamera = { href: string } | { locked: true; reason: string } | null;

/** The live broadcast, when one is running. Its own slot, never the gallery's. */
export type SiteMenuWatch = { href: string } | null;

/** One icon per slot the resolver can emit. Exhaustive over NavSlotKey, so a
 *  new slot in the rules engine is a TYPE ERROR here rather than a blank tab. */
const ICONS: Record<NavSlot['key'], typeof Home> = {
  home: Home,
  details: Info,
  story: BookOpen,
  camera: Camera,
  watch: Radio,
  gallery: Images,
  me: User,
};

/** One slot's chrome. `min-w-0` + nowrap + ellipsis because a label that wraps
 *  grows its slot and tilts the whole bar. */
const SLOT =
  'flex h-full flex-col items-center justify-center gap-1 px-0.5 text-center ' +
  'text-xs font-semibold leading-none tracking-tight ' +
  'whitespace-nowrap overflow-hidden text-ellipsis transition-colors';

export function SiteMenuBar({ slots }: { slots: readonly NavSlot[] }) {
  // 🔴 A LOCKED TAB'S REASON WAS IN A `title=`, WHICH A PHONE CANNOT SHOW.
  //
  // This file's own comment says "a padlock with its reason says the truth" —
  // and the reason lived in a native tooltip, which needs a mouse hovering. On
  // a phone there is no hover, so the entire audience for this bar saw a faint
  // Camera with a small padlock on it and no way whatsoever to find out why.
  // The resolver has always carried `lockedReason` precisely so it can be SAID;
  // the bar just never said it. Tapping now shows it.
  const [openReason, setOpenReason] = useState<string | null>(null);
  // The camera is pulled OUT and re-inserted at the centre. That is a LAYOUT
  // decision — the one kind this component may still make. It never decides
  // whether a slot exists, where it points, or whether it is locked; those come
  // resolved. Owner design: the camera sits in the middle because on the day,
  // taking pictures is what people are actually doing.
  const camera = slots.find((s) => s.key === 'camera') ?? null;
  const rest = slots.filter((s) => s.key !== 'camera');
  const mid = Math.ceil(rest.length / 2);
  const before = rest.slice(0, mid);
  const after = rest.slice(mid);

  /** A locked slot is DRAWN and unpressable, never absent: an absent tab says
   *  the wedding has no such thing, a dead link says the app is broken, and a
   *  padlock with its reason says the truth. */
  const renderSlot = (slot: NavSlot) => {
    const Icon = ICONS[slot.key];
    return (
      <li key={slot.key} className="min-w-0 flex-1">
        {slot.state === 'locked' ? (
          <button
            type="button"
            aria-disabled="true"
            aria-label={`${slot.label} — ${slot.lockedReason ?? 'not available yet'}`}
            onClick={() => setOpenReason(slot.lockedReason ?? null)}
            className={`${SLOT} w-full text-ink/35`}
          >
            <span className="relative inline-flex">
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              <Lock
                aria-hidden
                className="absolute -right-1.5 -top-1 h-3 w-3 text-terracotta-700"
                strokeWidth={2.5}
              />
            </span>
            {slot.label}
          </button>
        ) : (
          <a href={slot.href} className={`${SLOT} text-ink/65 hover:text-ink`}>
            <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            {slot.label}
          </a>
        )}
      </li>
    );
  };

  /** The camera keeps its own chrome — the CTA colour and a slightly larger
   *  glyph — because the design makes it the destination. */
  const renderCamera = (slot: NavSlot) => (
    <li key="camera" className="min-w-0 flex-1">
      {slot.state === 'locked' ? (
        <button
          type="button"
          aria-disabled="true"
          aria-label={`${slot.label} — ${slot.lockedReason ?? 'not available yet'}`}
          onClick={() => setOpenReason(slot.lockedReason ?? null)}
          className={`${SLOT} w-full text-ink/35`}
        >
          <span className="relative inline-flex">
            <Camera aria-hidden className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
            <Lock
              aria-hidden
              className="absolute -right-1.5 -top-1 h-3 w-3 text-terracotta-700"
              strokeWidth={2.5}
            />
          </span>
          {slot.label}
        </button>
      ) : (
        <a href={slot.href} className={`${SLOT} text-mulberry hover:text-mulberry-600`}>
          <Camera aria-hidden className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
          {slot.label}
        </a>
      )}
    </li>
  );

  /** One slot on the RAIL. Same three states as the bar — live · locked · the
   *  camera's action colour — laid out horizontally (glyph then label) because
   *  a rail is read left-to-right at rest, unlike a stacked tab. */
  const renderRailSlot = (slot: NavSlot) => {
    const Icon = ICONS[slot.key];
    const isCamera = slot.key === 'camera';
    // Stacked icon-over-label, the SAME grammar as the bar — because "icon +
    // label, always, never icons alone" is an owner design lock, and a 7rem
    // rail cannot hold them side by side. Same rule, laid out for the space.
    const RAIL_SLOT =
      'flex w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 ' +
      'text-center text-xs font-semibold leading-none tracking-tight ' +
      'whitespace-nowrap overflow-hidden text-ellipsis transition-colors';
    return (
      <li key={slot.key}>
        {slot.state === 'locked' ? (
          <button
            type="button"
            aria-disabled="true"
            aria-label={`${slot.label} — ${slot.lockedReason ?? 'not available yet'}`}
            onClick={() => setOpenReason(slot.lockedReason ?? null)}
            className={`${RAIL_SLOT} text-ink/35`}
          >
            <span className="relative inline-flex shrink-0">
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              <Lock
                aria-hidden
                className="absolute -right-1.5 -top-1 h-3 w-3 text-terracotta-700"
                strokeWidth={2.5}
              />
            </span>
            {slot.label}
          </button>
        ) : (
          <a
            href={slot.href}
            className={`${RAIL_SLOT} ${
              isCamera ? 'text-mulberry hover:text-mulberry-600' : 'text-ink/65 hover:text-ink'
            }`}
          >
            <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            {slot.label}
          </a>
        )}
      </li>
    );
  };

  return (
    <>
    {/* The bar reserves its own space (PR11, 2026-08-05).
        Being `fixed`, it is out of flow and covers the last ~3.5rem of the
        document. Whatever ended up at the foot of the page was therefore
        UNTAPPABLE: for a visitor with no invitation that is "Open my
        invitation" — the single control that gets them in — and for a guest it
        is Sign out. This element sits in normal flow at the end of the page, so
        the document simply grows by the height the bar occupies. Putting it
        here rather than on a page wrapper means the space is reserved wherever
        the bar renders and nowhere it does not — the two can never drift.

        ⚠ `xl:hidden` because ABOVE 1280 THE BAR IS NOT DRAWN — the rail replaces
        it — so reserving its height would leave a dead 3.5rem strip at the foot
        of every desktop page. The spacer and the bar must vanish at the SAME
        breakpoint or the pair drifts, which is the whole reason this element
        lives beside the bar rather than on a page wrapper. `rail-fits.test.ts`
        asserts they agree. */}
    {/* ⚠ KEPT ON ONE LINE ON PURPOSE. `bottom-edge.test.ts` matches this
        attribute order as a single string; splitting it across lines for
        readability broke that guard in CI. The guard is right and the
        formatting was mine, so the formatting gives way. */}
    <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] print:hidden xl:hidden" />
    {/* The reason, said out loud. Sits ABOVE the bar so it is never the thing
        the bar is covering, and dismisses on its own tap — no click-away layer
        to fight the tabs underneath it. */}
    {openReason ? (
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 pb-2">
        <button
          type="button"
          onClick={() => setOpenReason(null)}
          role="status"
          className="max-w-md rounded-xl border border-ink/10 bg-ink px-3.5 py-2 text-left text-sm text-cream shadow-lg"
        >
          {openReason}
        </button>
      </div>
    ) : null}
    {/* ── THE RAIL — `xl` (1280px) and up. Same five slots, resolved elsewhere.
        🚨 THE BREAKPOINT IS ARITHMETIC, NOT TASTE, AND `lg` WOULD OVERLAP.
        The rail floats in the LEFT MARGIN — every room centres its column with
        `mx-auto`, so the space available is (viewport − widest column) ÷ 2, and
        the rail must fit in it AT THE WIDEST COLUMN ANY ROOM USES, not the
        narrowest:

            at lg  1024px − 64rem stage = 128px ÷ 2 =  4rem   ✗ too tight
            at xl  1280px − 64rem stage = 256px ÷ 2 =  8rem   ✓ fits 7rem + 0.75

        My first cut put an 11rem rail at `lg` and it would have sat ON TOP of
        the venue page and the editorial, both of which use the 64rem stage. The
        first draft measured against the 48rem plate — the column MOST rooms
        use — which is the wrong end of the range. `rail-fits.test.ts` now
        asserts this arithmetic so the next person to widen the rail or lower
        the breakpoint is told rather than trusted.
        Below `xl` the pinned bar serves — correct for phones and tablets, which
        are touch anyway, and honest on a small laptop. */}
    <nav
      aria-label="Site sections"
      className="fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 pl-3 xl:block print:hidden"
    >
      <ul className="flex w-[7rem] flex-col gap-0.5 rounded-2xl border border-ink/10 bg-cream/95 p-2 shadow-sm backdrop-blur">
        {slots.map(renderRailSlot)}
      </ul>
    </nav>
    <nav
      aria-label="Site sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-cream/95 backdrop-blur xl:hidden"
    >
      <ul className="mx-auto flex h-[3.5rem] max-w-md items-stretch justify-around px-1">
        {before.map(renderSlot)}
        {camera ? renderCamera(camera) : null}
        {after.map(renderSlot)}
      </ul>
      {/* The home-indicator strip — without it the labels sit under the home bar. */}
      <div className="min-h-[0.5rem] bg-cream [height:env(safe-area-inset-bottom)]" />
    </nav>
    </>
  );
}
