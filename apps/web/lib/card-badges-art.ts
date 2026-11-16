/**
 * 🎨 THE CARD-BADGE MEDALS — colours and icons, copied from the approved design (v86 `AW` · `VBo`), never redrawn.
 *
 * The COLOURS are tokens in `app/globals.css` ("THE SERVICE-CARD BADGE MEDALS", `--sn-cb-*`, light + `html.dark`):
 * this file only names them. `fill` is the medal; `ink` is the label "in that badge's colour", a token that already
 * switches in dark. The ICONS are drawing data (24×24 strokes), so a screen draws them with real elements.
 * 🔒 `card-badges.test.ts` § 7 measures each ink at 4.5:1 on the card, reading the values from globals.css.
 */
import type { CardBadgeKey } from './card-badges';

/** One stroke of an icon: a path, or a rounded rect as [x, y, width, height, rx]. */
export type CardBadgeIconPart = { d: string } | { rect: readonly [number, number, number, number, number] };

export type CardBadgeArt = {
  /** The medal fill (v86 `ac`) — a `var(--sn-cb-*-fill)` token. */
  fill: string;
  /** The label colour — a `var(--sn-cb-*-ink)` token (≥ 4.5:1 on the card, light and dark). */
  ink: string;
  /** The icon, a 24×24 stroke drawing (v86 `ic`) — as data, so a screen draws it with real elements, never HTML text. */
  icon: ReadonlyArray<CardBadgeIconPart>;
};

export const CARD_BADGE_ART: Record<CardBadgeKey, CardBadgeArt> = {
  hot_booking: {
    fill: 'var(--sn-cb-hot-booking-fill)',
    ink: 'var(--sn-cb-hot-booking-ink)',
    icon: [{ rect: [3.5, 5, 17, 15, 2.5] }, { d: 'M3.5 10h17M8 3v4M16 3v4' }, { d: 'm8.6 14.6 2.3 2.2 4.6-4.6' }],
  },
  quick_responder: {
    fill: 'var(--sn-cb-quick-responder-fill)',
    ink: 'var(--sn-cb-quick-responder-ink)',
    icon: [{ d: 'M13 2.5 5 13.5h6l-1 8 8-11h-6z' }],
  },
  trending_now: {
    fill: 'var(--sn-cb-trending-now-fill)',
    ink: 'var(--sn-cb-trending-now-ink)',
    icon: [{ d: 'M12 21c-4 0-6.5-2.6-6.5-6 0-3 2-5.2 3.5-6.8.3 1.7 1.2 2.8 2.3 3.2C11 8 12.3 5 15 3c-.3 3 1.2 4.6 2.4 6.2 1 1.4 1.6 2.8 1.6 4.8 0 4-3 7-7 7z' }],
  },
  rave_reviews: {
    fill: 'var(--sn-cb-rave-reviews-fill)',
    ink: 'var(--sn-cb-rave-reviews-ink)',
    icon: [{ d: 'm12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z' }],
  },
  generous_giver: {
    fill: 'var(--sn-cb-generous-giver-fill)',
    ink: 'var(--sn-cb-generous-giver-ink)',
    icon: [{ rect: [3.5, 9, 17, 11.5, 1.5] }, { d: 'M2.5 9h19v-3h-19zM12 6v14.5M12 6c-1.5-3-5.5-3.5-5.5-1S10 6 12 6zm0 0c1.5-3 5.5-3.5 5.5-1S14 6 12 6z' }],
  },
  verified: {
    fill: 'var(--sn-cb-verified-fill)',
    ink: 'var(--sn-cb-verified-ink)',
    icon: [{ d: 'm5.5 12.5 4 4 9-9' }],
  },
  partner: {
    fill: 'var(--sn-cb-partner-fill)',
    ink: 'var(--sn-cb-partner-ink)',
    icon: [{ d: 'm5.5 12.5 4 4 9-9' }],
  },
};


/** The medal's ring: the lifted one wears the design's gold rim (v86 `.awc i.on`); the rest a thin paper ring. */
export const CARD_BADGE_RIM = {
  on: '0 0 0 1.6px var(--sn-cb-rim-gold), 0 0 0 2.4px var(--sn-cb-rim-edge), 0 3px 5px rgba(0,0,0,.3)',
  off: '0 0 0 1.5px var(--m-paper)',
} as const;
