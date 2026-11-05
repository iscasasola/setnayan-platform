/**
 * guest-hub-desktop.ts — 🖥 THE GUEST'S EVENT HUB ON A DESKTOP, FROM THE APPROVED SYSTEM SHEET ALONE (desktop area 1,
 * part 2). DECISION_LOG 2026-10-15 "ONE-PAGE INVITATION + SAVE THE DATE, THE DESKTOP SYSTEM SHEET, AND FIVE ANSWERS —
 * APPROVED" (owner, verbatim: *"Approved: … the desktop system sheet, and all five recommendations (top bar, …, Reply as
 * a side panel)"*) on `prototypes/event_hub_one_page_and_desktop_2026-10-15_fable.html` § 2 (the seven pieces) and § 4 C.
 *
 *   1 · THE TOP BAR — the shipped sticky header (× · Setnayan · the stage word) IS the bar: the page's slots sit in its
 *       centre, icon + word, as 44-px pills; the corner (music · Account) on its right. The floating left rail is
 *       retired and the bottom bar goes. Over the cover the bar is held off with the header, and slides in with it.
 *   2 · TWO WIDTHS — the reading column stays the scenes' own 48 rem; the stage is 64 rem, or the window less 64 px
 *       (1024); the 76-rem ceiling (it existed only to clear the rail) goes with the rail. 1440 adds margin, never width.
 *   3 · THE SIDE PANEL — a sheet the phone raises from the bottom opens as the SAME dialog, a 440-px panel from the right
 *       over its own dim scrim (Escape and focus return are each sheet's own `useModalA11y`, untouched).
 *   5 · 6 · THE HOVER RING (2 px #A9834B, pressables only) and THE FOCUS RING (ink on a paper gap), on the bar's slots.
 *   7 · 44-PX PRESSES — the slots and the corner's chips.
 *
 * CSS ONLY, and only for the viewers the flag lets in (`guestHubDesktopEnabled`, `lib/guest-hub-desktop-flag.ts`): the
 * guest page writes this `<style>` for them and for nobody else, and every rule is inside `min-width:1024px` — so a
 * guest's page (and every phone) is byte-for-byte what it was. Nothing here moves a node: the shipped bar, header and
 * sheets are only placed differently, as the Maker's desktop does with the phone's tree.
 *
 * 🔒 Where the sheet is silent the phone's layout stays, centred in the column (named in the PR, not invented here).
 */

/** The system sheet's measures (piece 1 · 2 · 3). */
export const GUEST_DESK_FROM_PX = 1024;
export const GUEST_DESK_BAR_PX = 68;
export const GUEST_DESK_SLOTS_PX = 520;
export const GUEST_DESK_STAGE_REM = 64;
export const GUEST_DESK_PANEL_PX = 440;
export const GUEST_DESK_GOLD = '#A9834B';

/** The shipped bottom bar and the shipped rail — the two forms `site-menu-bar.tsx` always draws (one hidden by width). */
export const GUEST_BAR = 'nav[aria-label="Site sections"][class~="bottom-0"]';
export const GUEST_RAIL = 'nav[aria-label="Site sections"][class~="top-1/2"]';
/** The bar's room kept at the foot of the page, and its locked-slot note that stands over it. */
const BAR_SPACER = 'div[aria-hidden][class~="xl:hidden"][class*="h-[calc(3.5rem"]';
const BAR_NOTE = 'div[class~="fixed"][class*="bottom-[calc(3.5rem"]';
/** The cover's hold (`globals.css` "THE COVER SCENE TAKES THE WHOLE FIRST SCREEN"). */
const COVER_WAITS = "html:has(> head > style[data-cover-menu='wait']):has(header[data-cover-scene])";

/** One panel from the right: the same dialog, 440 px, full height, its outer corners round. */
const PANEL =
  `width:${GUEST_DESK_PANEL_PX}px!important;max-width:100vw!important;height:100%!important;max-height:none!important;` +
  'margin:0!important;border-radius:24px 0 0 24px!important;border-width:0 0 0 1px!important';
/** …and the box that holds it puts it on the right, edge to edge in height. */
const PANEL_HOLDER = 'justify-content:flex-end!important;align-items:stretch!important;padding:0!important';

/** The guest page's sheets (each a bottom sheet on a phone) — every one already has its own scrim and `useModalA11y`. */
export const GUEST_SHEETS = {
  /** The shared `Sheet` (`app/_components/sheet.tsx`) — the gift and wish sheets: already a right drawer at `lg`. */
  shared: '[data-sheet] [data-sheet-panel]',
  /** "Open in your browser" (`copy-my-link.tsx`). */
  openInBrowser: '[role="dialog"][aria-labelledby="open-in-browser-title"]',
  /** The hub's "More event functions" (`hub/hub-shell.tsx`). */
  more: '[role="dialog"][aria-label="More event functions"]',
  /** A story moment's sheet (`story/story-clock.tsx`) — a floating 26-rem card from `sm`. */
  storyMoment: '[role="dialog"][class~="sm:w-[26rem]"]',
} as const;

const STAGE = `min(${GUEST_DESK_STAGE_REM}rem,calc(100vw - 64px))`;
const SLOT = `${GUEST_BAR}>ul>li>:is(a,button)`;

export const GUEST_HUB_DESKTOP_CSS =
  `@media (min-width:${GUEST_DESK_FROM_PX}px){` +
  /* ── 1 · THE TOP BAR: the shipped bar's slots in the header's centre; the rail and the bottom bar retired ── */
  `${GUEST_RAIL},${BAR_SPACER}{display:none!important}` +
  `${GUEST_BAR}{display:block!important;top:0!important;bottom:auto!important;left:50%!important;right:auto!important;width:${GUEST_DESK_SLOTS_PX}px;max-width:calc(100vw - 440px);height:${GUEST_DESK_BAR_PX}px;transform:translateX(-50%);border:0!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;z-index:21}` +
  `${GUEST_BAR}>div{display:none!important}` +
  `${GUEST_BAR}>ul{height:100%!important;max-width:none!important;justify-content:center!important;align-items:center!important;gap:4px;padding:0!important}` +
  `${GUEST_BAR}>ul>li{flex:0 1 auto!important;height:auto!important}` +
  `${SLOT}{height:44px!important;min-width:44px;flex-direction:row!important;gap:8px!important;padding:0 14px!important;border-radius:9999px;font-size:13px!important}` +
  `${GUEST_BAR} [aria-current]{background:color-mix(in srgb,currentColor 10%,transparent)}` +
  /* 5 · 6 — one soft gold ring on what you can press; the keyboard's ink ring on a paper gap. */
  `${SLOT}:hover{box-shadow:0 0 0 2px ${GUEST_DESK_GOLD}}` +
  `${SLOT}:focus-visible,[data-sticky-top] a:focus-visible,[data-top-corner] :is(a,button):focus-visible{outline:none!important;box-shadow:0 0 0 2px #F7F2EC,0 0 0 4px #2C2A29}` +
  /* A locked slot's note opens under the bar now, not over a bottom bar that is not there. */
  `${BAR_NOTE}{top:${GUEST_DESK_BAR_PX}px!important;bottom:auto!important}` +
  /* Over the cover the bar is held off WITH the header — upward, as the header goes. */
  `${COVER_WAITS} ${GUEST_BAR}{translate:0 -100%!important}` +
  /* 7 · the corner's chips are 44-px presses, centred in the bar's height. */
  `[data-top-corner]{top:12px!important}` +
  `[data-top-corner] :is(a,button){min-height:44px}` +
  /* ── 2 · TWO WIDTHS: the stage is 64 rem (the window less 64 px at 1024); the 76-rem ceiling goes with the rail ── */
  `[data-sticky-top]>div,[data-page-column]{max-width:${STAGE}!important}` +
  /* The corner stands at the window's edge: the header's right cell keeps clear of it. */
  `html:has([data-top-corner]) [data-sticky-top]>div{padding-right:calc(2rem + max(0px, 180px - (100vw - ${STAGE}) / 2))!important}` +
  /* ── 3 · THE SIDE PANEL: each sheet the phone raises from the bottom, as a 440-px panel from the right ── */
  `${GUEST_SHEETS.shared}{width:${GUEST_DESK_PANEL_PX}px!important;max-width:100vw!important}` +
  `div:has(> ${GUEST_SHEETS.openInBrowser}),div:has(> ${GUEST_SHEETS.more}){${PANEL_HOLDER}}` +
  `${GUEST_SHEETS.openInBrowser},${GUEST_SHEETS.more}{${PANEL};overflow-y:auto}` +
  `${GUEST_SHEETS.storyMoment}{top:0!important;bottom:0!important;right:0!important;left:auto!important;${PANEL}}` +
  /* A sheet's grab handle is a phone's (a panel is not dragged). */
  `${GUEST_SHEETS.openInBrowser}>div[aria-hidden]:first-child{display:none}` +
  '}' +
  /* Under 1280 with the corner drawn, the stage word gives the corner its room (the bar's slots need the middle). */
  `@media (min-width:${GUEST_DESK_FROM_PX}px) and (max-width:1279.98px){html:has([data-top-corner]) .sn-top-label{visibility:hidden}}`;
