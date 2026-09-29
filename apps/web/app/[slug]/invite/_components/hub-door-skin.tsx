import type { DoorSkin } from '@/app/_components/door/door-shell';
import { LayeredLogoPlayer } from '@/app/_components/layered-logo-player';
import { isLayeredLogo } from '@/lib/logo-layers';
import { SealMark } from './themes/seal-mark';

/**
 * THE RSVP PAGE WEARS THE EVENT HUB, NOT A DOOR (owner 2026-09-28, verbatim:
 * *"background should follow the background of the event hub"*; DECISION_LOG
 * 2026-09-27 "GUEST SCREENS INHERIT THE THEME" and 2026-09-26 "RSVP IS ONE
 * EXTRA PAGE INSIDE THE EVENT HUB … same theme").
 *
 * The door compositions (capiz · velvet · galeriya · abaca) paint their OWN
 * ground — Capiz's lattice over the reveal photo, the "pixel grid" the owner
 * saw. This skin paints NOTHING behind the card: the RSVP page wraps itself in
 * the Event Hub's own look (`GuestLookScope`) and its Main background, so what
 * shows through a transparent frame is exactly the ground the Event Hub draws —
 * paper, ombré (Plain · Dawn · Diagonal · Glow), the theme's loop, or the
 * couple's own photo or clip.
 *
 * 🔑 WHAT IT OWNS, AND WHAT IT LEAVES:
 *   · `className: ''` — the frame is transparent (DoorShell's bare door would
 *     lay an opaque `bg-cream` over the Event Hub's ground).
 *   · `--surface` → the page's PAPER. The card stays a card (DoorShell's own
 *     edge, border and shadow), on the paper colour every ink in the scope was
 *     computed against — so it stays legible over a photo, an ombré, a dark
 *     theme, or a couple's own dark background colour, where House's white
 *     `--surface` would put the adapted light ink on white.
 *   · the crest — their LOGO (the Event Hub hero's mark), their initials only
 *     when they have none.
 *   · NO `action`. The Send / Next button is `.button-primary`, which the Event
 *     Hub's look already colours (the theme's own button, or the couple's Pro
 *     button colour — `proSiteVarsFor`). A door `action` would paint the door's
 *     colour over the hub's, which is the terracotta Next the owner saw.
 */
export function hubDoorSkin({
  mark,
  monogram,
  animate = false,
}: {
  mark: string | null;
  monogram: string;
  /**
   * ▶ THE LOGO PLAYS (owner 2026-09-29, pointing at the mark on the RSVP card:
   * *"can we also animate this?"*). A LAYERED logo (the Maker's Logo page) plays
   * its saved motion — draw on, then drift — through the ONE player the Event
   * Hub hero and the Maker's ▶ Play use (`LayeredLogoPlayer`), so the guest sees
   * what the couple saw. Behind the SAME gate as the hero (`loadMedia`'s
   * `animatedMonogram`: the animation is owned and not switched to "Use Static
   * Image") — the caller decides it. Not layered, or not allowed → the still
   * mark, as before. It plays ONCE: the crest sits outside the reply form, so
   * stepping through the questions never remounts it; `prefers-reduced-motion`
   * is the player's own still fallback.
   */
  animate?: boolean;
}): DoorSkin {
  const plays = Boolean(mark && animate && isLayeredLogo(mark));
  return {
    themeId: 'hub',
    className: '',
    style: { ['--surface' as string]: 'rgb(var(--color-cream))' } as React.CSSProperties,
    crest: (
      <div className="-mt-1 mb-3 flex justify-center" data-door-mark={mark ? 'logo' : 'initials'}>
        {plays ? (
          <span className="inline-flex" style={{ width: 72, height: 72 }} data-door-mark-plays="">
            <LayeredLogoPlayer svg={mark!} />
          </span>
        ) : mark ? (
          <SealMark mark={mark} monogram={monogram} px={72} />
        ) : (
          <span className="grid h-14 w-14 place-items-center whitespace-nowrap rounded-full border border-ink/15 font-serif text-lg text-ink">
            {monogram}
          </span>
        )}
      </div>
    ),
  };
}
