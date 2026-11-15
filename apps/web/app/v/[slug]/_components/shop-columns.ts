/**
 * The shop page's two columns (supplier website by plan, owner-approved 2026-10-30; the "universal" calling card
 * 2026-09-10 §C; owner 2026-10-29 "always maximize the screen"). One place for the classes, so `/v/[slug]` and the
 * dev lab (`/dev/shop-layout-lab`) draw the same layout:
 *
 *   phone (< 768)   one column, the card on top — unchanged;
 *   tablet (768+)   the card as a 300 px sticky column, the page beside it;
 *   computer (1024+) a 360 px card column, a wider gap.
 *
 * Every plan. The page is the full screen width on every plan (was Pro+ only, 2026-07-03).
 */
export const SHOP_ARTICLE_WIDTH = 'max-w-screen-2xl';

export const SHOP_COLUMNS_CLASS =
  'md:grid md:grid-cols-[300px_minmax(0,1fr)] md:items-start md:gap-x-7 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-x-11';

/** Sticky beside the page; a card taller than the screen scrolls inside itself rather than hiding its foot. */
export const SHOP_CARD_COLUMN_CLASS = 'min-w-0 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto md:pr-1';

/** The identity section inside the card column: logo beside the name on a phone's wide row, stacked in the column. */
export const SHOP_CARD_SECTION_CLASS =
  'flex flex-col items-start gap-6 border-b border-ink/10 pb-8 sm:flex-row md:flex-col md:gap-4 md:border-b-0';

/**
 * 🎴 THE CALLING CARD (verified look, owner-approved 2026-11-13; prototype `public_pages_three_2026-11-13`, `.vcard`):
 * the card column becomes a raised card that overlaps the hero's foot, and — with `SHOP_CARD_COLUMN_CLASS` — stays
 * pinned beside the body on a tablet and up.
 */
export const SHOP_CALLING_CARD_CLASS =
  'relative z-10 -mt-9 rounded-3xl bg-cream p-[18px] shadow-[0_10px_30px_-12px_rgba(30,26,18,.22),0_2px_6px_-2px_rgba(30,26,18,.08)] md:-mt-[72px] md:p-[22px]';

/**
 * 🌿 THE CALM COLUMN (unverified look, owner-approved 2026-11-13: "a free unverified looks like a user profile page.
 * simple and clean"): one centred reading column, the notice card on top, the header, the section bar, the sections.
 */
export const SHOP_CALM_COLUMN_CLASS = 'mx-auto w-full max-w-3xl';

/**
 * ✅ THE ONE INQUIRE (owner 13 Nov 2026, "Yes, only one"). In the calling card's action row; below 768 px the same
 * element floats bottom-right so it stays in reach as the card scrolls away — one control, never a second copy.
 */
export const SHOP_MAIN_INQUIRE_CLASS =
  'button-primary inline-flex items-center gap-2 max-md:fixed max-md:bottom-[max(1rem,env(safe-area-inset-bottom))] max-md:right-4 max-md:z-30 max-md:shadow-lg';
