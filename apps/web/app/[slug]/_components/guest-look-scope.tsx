'use client';

import { useSelectedLayoutSegment } from 'next/navigation';
import type { InviteThemeId } from '@/lib/invite-themes';

/**
 * The route segments under `/[slug]` that dress THEMSELVES and must not wear
 * the page look on top.
 *
 * `invite` is the door — `/invite`, `/invite/enter`, `/invite/reply`. It has
 * its own, owner-approved composition (`invite-skin.tsx`, `DoorShell`,
 * `data-invite-theme`), and globals.css says so in as many words: the
 * `[data-hub-theme]` page mappings are *"`[data-hub-theme]` ONLY. The door must
 * not be re-skinned by these."* An ancestor attribute would reach straight into
 * it — Velvet's page ink is a light cream, and the door's card is bright.
 */
export const SEGMENTS_THAT_DRESS_THEMSELVES: readonly string[] = ['invite'];

/**
 * Does the page under `segment` wear the look? Every segment does, except the
 * ones above — and only when there is a look to wear (House with no palette,
 * no Pro colours and daylight art wears nothing at all).
 */
export function lookIsWorn(
  segment: string | null,
  look: { theme: string | null; art: string | null; style: Record<string, string> | null },
): boolean {
  if (segment !== null && SEGMENTS_THAT_DRESS_THEMSELVES.includes(segment)) return false;
  return Boolean(look.theme || look.art || look.style);
}

/**
 * THE ONE PLACE THE COUPLE'S LOOK IS WORN — for every page of the guest tree.
 *
 * Owner, 2026-09-25: *"event hub has the different menus that are not
 * editable. but they should still adapt to their theme"*. Until this, the look
 * was stamped on the `<main>` of the landing page, the recap and the money-gift
 * page; `/find-seat`, `/seat`, `/find-my-table`, `/hub`, `/everyone`,
 * `/welcome`, `/venue`, `/avatar` and `/print` wore Clean-Editorial whatever
 * the couple chose. `[slug]/layout.tsx` is the only node that wraps all of
 * them, so the look is worn here and nowhere below.
 *
 * ── WHY A CLIENT COMPONENT ───────────────────────────────────────────────────
 * Only to ask which child segment is showing. A layout is not told its
 * pathname, and it is NOT re-rendered when a guest taps from `/invite` to
 * `/hub` — so a decision made on the server from a request header would be
 * stale after the first client-side navigation. `useSelectedLayoutSegment`
 * answers on the server render AND after every navigation. Everything it wears
 * is resolved on the server and handed in as plain data; nothing here reads
 * the event.
 *
 * ── WHAT IT WEARS ────────────────────────────────────────────────────────────
 *   • `data-hub-theme` — keys the theme's material and its page mapping in
 *     globals.css (`[data-hub-theme='x']`).
 *   • `data-art="candlelight"` — Pahina's dark direction.
 *   • the theme's font classes — the `--font-*` variables `next/font` generates.
 *   • inline vars — mood-board palette, the couple's Pro colours and face, and
 *     the `--accent` the material mixes with. INLINE on purpose, on the SAME
 *     element as the attribute: inline beats a stylesheet, which is what keeps
 *     the precedence `theme < palette < the couple's own hex`.
 *   • a fixed PAPER behind everything — see `GuestGround`.
 *
 * ⛔ HOUSE WEARS NOTHING. An event with no theme, no palette, no Pro colours
 * and daylight art gets `<div class="sn-editorial contents">` — the exact
 * element this layout rendered before, byte for byte.
 */
export function GuestLookScope({
  theme,
  art,
  fontClassName,
  style,
  children,
}: {
  theme: Exclude<InviteThemeId, 'house'> | null;
  art: 'candlelight' | null;
  fontClassName: string;
  style: Record<string, string> | null;
  children: React.ReactNode;
}) {
  const worn = lookIsWorn(useSelectedLayoutSegment(), { theme, art, style });

  return (
    <div
      /* `display: contents` keeps this wrapper out of the box model so no guest
         page's layout shifts — and custom properties still INHERIT through a
         `contents` element, which is what lets the vars set here reach every
         page below it. */
      /* `text-ink` when worn: `<body>` sets the text colour from the ROOT ink,
         outside this scope, so any heading that names no colour of its own
         inherited House's espresso — near-black on Velvet (measured: the
         `/everyone` h1 vanished). Restating it here makes the inherited colour
         the THEME's ink. `color` inherits through `display: contents`. */
      className={worn ? `sn-editorial contents text-ink ${fontClassName}`.trim() : 'sn-editorial contents'}
      data-hub-theme={worn && theme ? theme : undefined}
      data-art={worn && art ? art : undefined}
      data-guest-look={worn ? '' : undefined}
      style={worn && style ? (style as React.CSSProperties) : undefined}
    >
      {worn ? <GuestGround /> : null}
      {children}
    </div>
  );
}

/**
 * The page's own paper, laid under the whole viewport.
 *
 * 🔴 WITHOUT IT A DARK THEME IS UNREADABLE ON HALF THE TREE. The vars above
 * move `--color-ink` AND `--color-cream` together, but `<body>` sits OUTSIDE
 * this wrapper and paints the ROOT cream. Any page whose `<main>` does not
 * paint its own paper — `/everyone`, and the landing page itself, which drops
 * its paper for a themed ground — would put Velvet's cream ink on a white body.
 *
 * `bg-cream` resolves inside this scope, so it IS the theme's paper (or the
 * palette's, or the couple's own hex) by construction and cannot drift from the
 * ink the page computes against — the same rule the site skins keep
 * (`the-site-wears-the-doors-theme.test.ts`: every ground is `--color-cream`).
 *
 * `-z-10` + `fixed`: behind every in-flow box of every page and every fixed
 * layer a page draws itself (a spatial backdrop, a film), and never scrolled
 * away. Decorative only — hidden from assistive tech, deaf to the pointer.
 *
 * ⚠ IT CARRIES NO PHOTO AND NO TEXTURE. The couple's reveal photo is never
 * resolved for this layer (see `resolveHubTheme`), because the layout wraps the
 * private landing, and a stranger there must see nothing the private landing
 * did not already show.
 */
function GuestGround() {
  return (
    <div
      aria-hidden
      data-guest-ground
      className="pointer-events-none fixed inset-0 -z-10 bg-cream"
    />
  );
}
