'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * photo-group-header.tsx — 🖼 THE GROUP HEADER WITH A PHOTO THAT PINS, drawn in ONE place.
 *
 * Owner-approved 2026-11-09 for the supplier's Shop › Services ("Services group row will look like a header with
 * photo … also show how it pins"), and asked for on the couple's Event › Suppliers › Find the same day: *"event
 * dashboard> suppliers> find still doesn't have the photo effect done for the pinned group rows."* The contract is the
 * corpus prototype `prototypes/shop_discounts_bundle_card_open_2026-11-09/shop-services-menu.html` (`src/add.js`
 * `gheadProp` · `src/add.css` `.gphoto` / `.ghd`), copied as drawn:
 *
 *   · the PHOTO BAND — 96 px, 16 px corners, the photo covering it, the count in mono caps at its bottom-left;
 *   · the TITLE ROW under it — 52 px, the page's own ground, the title (16 px, 600) over an optional mono-caps line —
 *     which PINS (`position: sticky`) while the group's rows scroll under it. It sits inside the group's own
 *     `<section>`, so when that section ends the next group's header PUSHES it up — the browser's own sticky
 *     containment, no script;
 *   · PINNED, the photo comes back as a 36 px thumb at the row's left (the family spring, `--sn-pill-dur` ·
 *     `--sn-pill-spring`) and a hairline fades in under it (`data-pinned`). Reduced motion: no transition at all.
 *   · NO PHOTO → no band and no empty box: the plain title row, the count as its small line (`data-photo="none"`).
 *
 * Two homes: Find's groups (`find-category-list.tsx`) today, and the supplier's Shop › Services (Build 5), whose
 * ⋯ menu goes in `trailing` — Find draws none (the menu is supplier-only).
 *
 * Nothing here is pressable, so nothing here wears a frame (house rule): the band is a photo with rounded corners, the
 * pinned hairline is a divider. The pin's offset is `--pgh-top` (default: under the app bar, `--fd-bar`, the token
 * everything parked under the bar reads); a host that scrolls inside its own box sets `--pgh-top: 0px`.
 * 📱 On a phone the app bar slides away on a scroll down (`useHideOnScroll` → `.fd-topwrap[data-hidden='true']`, below
 * 1024 px — the same line `front-door.css` hides it at). The row then pins at 0 and slides with the bar (0.3 s
 * ease-out, the bar's own), so no strip of the list shows where the bar was — measured 51 px at 375 before this. The pinned
 * row's ground is `--pgh-bg` (default the page canvas) and it bleeds `--pgh-bleed` (default 16 px) past its column
 * on both sides so rows scrolling under it never show in the gutters. 🔒 `photo-group-header.test.ts`
 */

export function PhotoGroupHeader({
  title,
  count,
  photoUrl,
  subtitle = null,
  trailing = null,
  headingId,
}: {
  /** The group's name — the row's heading (an `<h3>`). */
  title: string;
  /** "6 categories · 2 booked" — on the band when there is a photo, else the row's small line. */
  count: string | null;
  /** The group's photo from the taxonomy (Admin › Categories), already resolved to a URL. null = the text row. */
  photoUrl: string | null;
  /** A small line under the title on the photo layout (the supplier's crumb). */
  subtitle?: string | null;
  /** The supplier's ⋯ menu (Shop › Services). Find hands none. */
  trailing?: ReactNode;
  headingId?: string;
}) {
  const bandRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [barAway, setBarAway] = useState(false);
  const hasPhoto = !!photoUrl;

  // The phone's app bar slid away → pin at 0 (see the header note). Read off the bar's own attribute, on the same
  // breakpoint its CSS hides it at, so a desktop bar (which never moves) never pulls the row up under it.
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('.fd-topwrap[data-hidden]');
    if (!bar || typeof MutationObserver === 'undefined') return;
    const phone = window.matchMedia('(max-width: 1023.98px)');
    const sync = () => setBarAway(bar.getAttribute('data-hidden') === 'true' && phone.matches);
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(bar, { attributes: true, attributeFilter: ['data-hidden'] });
    phone.addEventListener('change', sync);
    return () => {
      mo.disconnect();
      phone.removeEventListener('change', sync);
    };
  }, []);

  // Pinned = the row has come away from its band (the band scrolled on, the row stayed). One passive CAPTURE listener
  // (the page may scroll the window or an inner box), read once per frame — the shape `PinnedRow` uses.
  useEffect(() => {
    const band = bandRef.current;
    const row = rowRef.current;
    if (!band || !row) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      setPinned(row.getBoundingClientRect().top - band.getBoundingClientRect().bottom > 1);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hasPhoto]);

  const small = hasPhoto ? subtitle : count;

  return (
    <>
      {hasPhoto ? (
        <div
          ref={bandRef}
          className="relative mt-3.5 h-24 overflow-hidden rounded-2xl bg-ink/10"
          data-photo-group-band=""
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a signed catalogue URL, not an optimisable asset */}
          <img
            src={photoUrl}
            alt=""
            width={390}
            height={96}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {count ? (
            <>
              {/* A soft shade under the count only — white 10.5 px caps must read on a bright photo. */}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/35 to-transparent" />
              <span
                className="absolute bottom-2.5 left-3 font-mono text-[10.5px] uppercase tracking-[0.13em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.45)]"
                data-photo-group-count=""
              >
                {count}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
      <div
        ref={rowRef}
        className={`group sticky top-[var(--pgh-top,var(--pgh-bar,var(--fd-bar,0px)))] z-sn-sticky -mx-[var(--pgh-bleed,1rem)] flex h-[52px] items-center bg-[var(--pgh-bg,var(--sn-canvas))] px-[var(--pgh-bleed,1rem)] [transition:top_.3s_ease-out,box-shadow_.2s_ease-out] motion-reduce:transition-none data-[pinned]:shadow-[0_1px_0_rgb(var(--color-ink)/0.06)]${
          hasPhoto ? '' : ' mt-4'
        }`}
        data-photo-group-header=""
        data-photo={hasPhoto ? 'photo' : 'none'}
        data-pinned={pinned ? '' : undefined}
        style={barAway ? ({ '--pgh-bar': '0px' } as CSSProperties) : undefined}
      >
        {hasPhoto ? (
          <span
            aria-hidden
            className="mr-0 h-9 w-0 shrink-0 scale-[0.6] overflow-hidden rounded-[9px] bg-cover bg-center opacity-0 [transition:width_var(--sn-pill-dur)_var(--sn-pill-spring),margin_var(--sn-pill-dur)_var(--sn-pill-spring),opacity_var(--sn-pill-dur)_var(--sn-pill-spring),transform_var(--sn-pill-dur)_var(--sn-pill-spring)] motion-reduce:transition-none group-data-[pinned]:mr-2.5 group-data-[pinned]:w-9 group-data-[pinned]:scale-100 group-data-[pinned]:opacity-100"
            style={{ backgroundImage: pinned ? `url("${photoUrl}")` : undefined }}
            data-photo-group-thumb=""
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <h3 id={headingId} className="truncate text-[16px] font-semibold leading-[1.15] text-ink">
            {title}
          </h3>
          {small ? (
            <span className="block truncate font-mono text-[10.5px] uppercase tracking-[0.13em] text-[color:var(--m-slate-2)]">
              {small}
            </span>
          ) : null}
        </span>
        {trailing ? <span className="ml-2.5 shrink-0">{trailing}</span> : null}
      </div>
    </>
  );
}
