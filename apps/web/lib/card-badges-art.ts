/**
 * 🎨 THE CARD-BADGE MEDALS — colours and icons, copied from the approved design (v86 `AW` · `VBo`), never redrawn.
 * Kept in `lib/` because a medal's colour IS data (the same reason `lib/service-icon-art.ts` holds hex): the app's
 * raw-hex guard reads `.tsx` screens, and a medal's fill is not a screen colour choice.
 *
 * `ink` / `inkDark` are the LABEL colours (the design names each badge "in that badge's colour"). The medal fills are
 * the design's own; the label inks are the nearest tone of the same hue that reads at 4.5:1 on the card's paper in
 * light and dark — held by `card-badges.test.ts`, which measures them.
 */
import type { CardBadgeKey } from './card-badges';

/** One stroke of an icon: a path, or a rounded rect as [x, y, width, height, rx]. */
export type CardBadgeIconPart = { d: string } | { rect: readonly [number, number, number, number, number] };

export type CardBadgeArt = {
  /** The medal fill (v86 `ac`). */
  fill: string;
  /** The label, light theme (≥ 4.5:1 on paper). */
  ink: string;
  /** The label, dark theme (≥ 4.5:1 on the dark card). */
  inkDark: string;
  /** The icon, a 24×24 stroke drawing (v86 `ic`) — as data, so a screen draws it with real elements, never HTML text. */
  icon: ReadonlyArray<CardBadgeIconPart>;
};

export const CARD_BADGE_ART: Record<CardBadgeKey, CardBadgeArt> = {
  book: {
    fill: '#2F8F5B',
    ink: '#1F6E43',
    inkDark: '#4FB37A',
    icon: [{ rect: [3.5, 5, 17, 15, 2.5] }, { d: 'M3.5 10h17M8 3v4M16 3v4' }, { d: 'm8.6 14.6 2.3 2.2 4.6-4.6' }],
  },
  quick: {
    fill: '#2C5FC8',
    ink: '#2C5FC8',
    inkDark: '#7FA3E8',
    icon: [{ d: 'M13 2.5 5 13.5h6l-1 8 8-11h-6z' }],
  },
  trend: {
    fill: '#D9561E',
    ink: '#B7330E',
    inkDark: '#FF9A4D',
    icon: [{ d: 'M12 21c-4 0-6.5-2.6-6.5-6 0-3 2-5.2 3.5-6.8.3 1.7 1.2 2.8 2.3 3.2C11 8 12.3 5 15 3c-.3 3 1.2 4.6 2.4 6.2 1 1.4 1.6 2.8 1.6 4.8 0 4-3 7-7 7z' }],
  },
  rave: {
    fill: '#B8871F',
    ink: '#8A6410',
    inkDark: '#FFE08A',
    icon: [{ d: 'm12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z' }],
  },
  gift: {
    fill: '#B03A78',
    ink: '#B03A78',
    inkDark: '#E07AB0',
    icon: [{ rect: [3.5, 9, 17, 11.5, 1.5] }, { d: 'M2.5 9h19v-3h-19zM12 6v14.5M12 6c-1.5-3-5.5-3.5-5.5-1S10 6 12 6zm0 0c1.5-3 5.5-3.5 5.5-1S14 6 12 6z' }],
  },
  verified: {
    fill: '#1F4CBA',
    ink: '#1F4CBA',
    inkDark: '#8AB6FF',
    icon: [{ d: 'm5.5 12.5 4 4 9-9' }],
  },
};

/** The paper the label sits on, for the contrast check (ServiceFace `--m-paper`, light and dark). */
export const CARD_PAPER = { light: ['#FFFFFF', '#F4F2EC'], dark: ['#232019', '#2C2820'] } as const;

/** The medal's ring: the lifted one wears the design's gold rim (v86 `.awc i.on`); the rest a thin paper ring. */
export const CARD_BADGE_RIM = {
  on: '0 0 0 1.6px #e2be6e, 0 0 0 2.4px #6b4a10, 0 3px 5px rgba(0,0,0,.3)',
  off: '0 0 0 1.5px var(--m-paper)',
} as const;
