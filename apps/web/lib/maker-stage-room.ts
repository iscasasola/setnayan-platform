/**
 * lib/maker-stage-room.ts — 📏 THE STAGES PANEL'S ROOM ON A PHONE (the new Maker,
 * `makerStagesStudioEnabled`; `launch/_components/stage-tools.tsx`).
 *
 * Owner, 2026-10-06 (the approved prototype; DECISION_LOG "ONE HEIGHT: 44"): the
 * panel is ONE row while nothing is picked — the stage ▾, Style | Text | Animate,
 * ▶ — over the strip of the page's parts, and rises to HALF the screen, never
 * more, when a part is picked (PR 1's `MAKER_LT_HALF`, `lib/maker-lt-size.ts`).
 * Every control in it is at least Apple's 44 px.
 *
 * The class strings live here, not in the component, so the guard
 * (`lib/the-stage-panel-fits-a-phone.test.ts`) measures the SAME strings the
 * panel draws (`phoneHeightPx`, `lib/maker-phone-room.ts`). Pure; imported only
 * by the lazy Stages panel and the test.
 */
import { makerLtClampPx } from './maker-lt-size';

/**
 * 🎨 THE PROTOTYPE'S OWN COLOURS (`maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`
 * `:root`), set once on the Maker shell while the Stages panel is drawn (`stage-tools.tsx`)
 * and read by every string below as `var(--sp-…)` — the panel is the prototype's, not a
 * reinterpretation (DECISION_LOG 2026-10-07 "THE STAGES PANEL IS REDRAWN FROM THE PROTOTYPE").
 *
 * 🎯 WHAT IS ON, PICKED OR TAPPABLE IS THE APP'S ACCENT — NOT A COLOUR WRITTEN HERE (owner 2026-10-08: *"if we change
 * our color to blue, it will be easy to change the button colors"*, `INTERACTION_RULES.md` § 9). `--sp-cta` and its
 * wash READ `--sn-accent` (`globals.css`), and `--sp-bad` reads the house danger token (`--color-danger`): the picked
 * card's ring, the colour circle's ring, the slider's fill and every `var(--sp-cta)` in the panel follow the one
 * setting. The thirteen left are NEUTRALS and the gold — grounds, inks and hairlines, never "on":
 * page · paper · ink · ink2 · mute · gold · gold-soft · gold-wash · line · line2 · pill · pill-on · ok.
 * Held by `lib/the-stages-panel-wears-the-accent.test.ts`.
 */
export const STAGE_PANEL_VARS =
  '--sp-page:#F3F0EA;--sp-paper:#FFFFFF;--sp-ink:#2C2A29;--sp-ink2:#5A5755;--sp-mute:#8A8580;--sp-gold:#A9834B;' +
  '--sp-gold-soft:#E6D8BE;--sp-gold-wash:#F8F3E9;--sp-cta:rgb(var(--sn-accent));--sp-cta-wash:rgb(var(--sn-accent) / .1);--sp-line:#E6E1D8;' +
  '--sp-line2:#D9D3C8;--sp-pill:#F1EEE8;--sp-pill-on:#D8D3CA;--sp-ok:#2F6B4F;--sp-bad:rgb(var(--color-danger))';

/** The panel's one row — [ stage ▾ ] · [ Style | Text | Animate ] · ▶ (prototype `.row1`, 44 px, gap 6). */
export const STAGE_ROW = 'flex h-11 shrink-0 items-center gap-1.5';
/** ▶ — a 44 px tap; the prototype's 40 px round is its inner `STAGE_ICON_FACE`. */
export const STAGE_ICON_BUTTON = 'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--sp-ink)]';
export const STAGE_ICON_FACE =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--sp-line)] bg-[var(--sp-pill)]';
/** The stage ▾ pill (prototype `.ddp`: caps, a gold chevron, open = gold ring). */
export const STAGE_ITEM_BUTTON =
  'sn-press inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--sp-line)] bg-[var(--sp-pill)] px-3 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--sp-ink)] transition-[box-shadow,border-color,background-color] duration-150 aria-expanded:border-[var(--sp-gold)] aria-expanded:bg-white aria-expanded:shadow-[0_0_0_2px_var(--sp-gold-soft)]';
/**
 * The Style | Text | Animate pill (prototype `.tpill`, white, 44 px).
 * 🎚 A PILL SELECTOR WHOSE THUMB SLIDES (owner 2026-10-08, selecting this group: *"apply the same pill selector"*;
 * DECISION_LOG "SELECTORS ARE PILLS THAT SLIDE"): the track wears the app's thumb (`app/_components/pill-thumb.tsx`,
 * `group/seg relative`), so the face TRAVELS from one tool to the next instead of one fading out and another in. ONE
 * colour, as every pill selector (owner: *"pill selector should have a consistent color"*): the terracotta when a
 * tool is on, grey icons when off. The icons stay where they are and their ink cross-fades to white on the thumb.
 */
export const STAGE_TOOL_PILL = 'group/seg relative inline-flex h-11 shrink-0 items-center rounded-full border border-[var(--sp-line)] bg-white';
/** One of Style | Text | Animate — 44 px tall to the thumb; its 46 × 38 face (`STAGE_TOOL_FACE`) is the prototype's `.tb`. Above the travelling thumb (`z-[1]`). */
/* A tool with nothing to set on the picked part is GREY and still hears a tap (`aria-disabled`, never `disabled`): the tap says why. */
export const STAGE_TOOL_BUTTON = 'sn-press group relative z-[1] inline-flex h-11 w-[46px] items-center justify-center text-[var(--sp-mute)] aria-disabled:opacity-30';
/** The face: it paints the dark pill itself until the thumb is laid, then hands the fill over (never a frame with none, never two). */
export const STAGE_TOOL_FACE =
  'inline-flex h-[38px] w-[46px] items-center justify-center rounded-full transition-colors duration-sn-pill ease-sn motion-reduce:transition-none group-aria-pressed:bg-sn-accent group-aria-pressed:text-sn-on-accent group-data-[seg-thumb]/seg:group-aria-pressed:bg-transparent';
/**
 * The hairline between two tools. It fades out on either side of the picked tool — the thumb is never cut by a line
 * as it passes, and the line beside it is gone when it lands (the way iOS draws a segmented control).
 */
export const STAGE_TOOL_DIVIDER =
  'mx-px h-5 w-px bg-[var(--sp-line2)] transition-opacity duration-sn-pill ease-sn motion-reduce:transition-none has-[+[aria-pressed=true]]:opacity-0 [[aria-pressed=true]+&]:opacity-0';
/** A part's tile in the strip (shown only when the panel is dragged taller with nothing picked — prototype `.th`). */
export const STAGE_PART_TILE =
  'sn-press flex h-[124px] w-[104px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-[var(--sp-line)] bg-[#FBF9F5] text-center text-[12.5px] text-[var(--sp-ink2)] aria-pressed:border-[var(--sp-cta)]';
/** A row of the stage ▾ sheet (a stage, or one of its pages). */
export const STAGE_SHEET_ROW =
  'sn-press flex h-12 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] text-ink transition-colors duration-sn-control ease-sn hover:bg-ink/5 disabled:text-ink/40';
/** A page of the guest's tab bar under the page preview (prototype `.gbar button`: words only, 44 px). */
export const STAGE_GUEST_TAB =
  'sn-press relative flex h-11 min-w-0 flex-1 items-center justify-center whitespace-nowrap px-1 text-[12px] font-semibold text-[var(--sp-mute)] aria-[current=page]:text-[var(--sp-ink)]';

/* ── the panel's body (`stage-panel/*`) — every row ONE height, 44 px (owner 2026-10-06 "keep all rows consistent in height") ── */

/** A tool's column (prototype `.pane`): rows 8 px apart, scrolls only when a tool is longer than half the screen. */
export const SP_PANE = 'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-[10px] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
/**
 * The segmented control (Look | Background | Arrange · Build in | Action | Build out) — prototype `.sub.phases`.
 * 🎚 A FULL PILL WHOSE THUMB SLIDES (owner 2026-10-08, selecting it: *"apple the same pill selector"*; DECISION_LOG
 * "SELECTORS ARE PILLS THAT SLIDE"): the app's track shape (`group/seg relative … rounded-full p-[3px]`, as
 * `PILL_TRACK_CLASS`) on the panel's own ground, 44 px tall, with the app's thumb inside (`Phases`, `stage-panel/kit.tsx`).
 */
export const SP_PHASES = 'group/seg relative flex h-11 w-full min-w-0 shrink-0 rounded-full bg-[rgba(44,42,41,.07)] ring-1 ring-inset ring-[var(--sp-line2)]';
/**
 * One segment: 44 px to the finger (`h-11` — the panel's own rule, `the-stage-panel-fits-a-phone`), its white pill
 * clipped 3 px inside (a transparent border), so the face is the 38-px pill of the app's selector. `SP_PHASE_INSET`
 * tells the thumb the same 3 px. It paints the pill itself until the thumb is laid, then hands the fill over.
 */
export const SP_PHASE =
  'sn-press relative z-[1] flex h-11 min-w-0 flex-1 items-center justify-center rounded-full border-[3px] border-transparent bg-clip-padding text-[13px] font-semibold text-[var(--sp-mute)] transition-colors duration-sn-pill ease-sn motion-reduce:transition-none aria-pressed:bg-sn-accent aria-pressed:text-sn-on-accent group-data-[seg-thumb]/seg:aria-pressed:bg-transparent';
/** The 3 px `SP_PHASE` keeps clear around its face (its `border-[3px]`) — what the thumb is laid inside. */
export const SP_PHASE_INSET = 3;
/** A labelled dropdown row (prototype `.dd`: white pill, the small caps label, the value, a gold chevron). */
export const SP_DD = 'relative flex h-11 min-w-0 flex-1 items-center rounded-full bg-white pl-[14px] ring-1 ring-inset ring-[var(--sp-line)]';
/** The small caps word before a dropdown's value (prototype `.dd small`). */
export const SP_DD_LABEL = 'max-w-[48%] shrink-0 truncate text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--sp-mute)]';
/**
 * The shipped PickMenu inside `SP_DD` — transparent, the whole pill its tap. Its ▾ is the dropdown template's own
 * (`pickArrowClass`: the accent — owner 2026-10-08 *"Dropdown — Chevron should be teracota color?"*); nothing here
 * repaints it.
 */
export const SP_DD_BUTTON = 'h-11 !min-h-0 min-w-0 flex-1 !justify-between !rounded-full !bg-transparent !pl-1.5 !pr-3 !text-[14px] !font-medium';
/** A row of one label and its control (prototype `.r` / `.ar`). */
export const SP_ROW = 'flex h-11 shrink-0 items-center gap-2.5';
export const SP_ROW_LABEL = 'w-[70px] shrink-0 text-[13px] font-semibold text-[var(--sp-ink2)]';
/** An on / off switch — the app's ONE drawing (`SwitchTrack`, 50 × 30) on a 44 px tap. */
export const SP_SWITCH = 'sn-press relative inline-flex h-11 w-[50px] shrink-0 items-center';
/**
 * A colour CIRCLE (the approved gallery's kind 21, "the five colour circles" — owner 2026-10-08): a 32 px circle on a
 * 44 px tap. Picked, it wears the accent's ring with a gap of the panel's ground (`SP_SWATCH_ON`).
 */
export const SP_SWATCH = 'sn-press inline-flex h-11 min-w-0 max-w-[44px] flex-1 items-center justify-center';
/** The circle itself — `sn-press-ring` so a press rings it like every other template. */
export const SP_SWATCH_FACE = 'sn-press-ring relative block h-8 w-8 shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_var(--sp-line2)]';
/** The picked circle: a gap of the panel's ground, then the accent (never a colour written here). */
export const SP_SWATCH_ON = '!shadow-[0_0_0_2px_var(--sp-page),0_0_0_4px_rgb(var(--sn-accent))]';
/** "+" — any colour: a dashed circle, its mark in the accent (the mark that says "you can tap this"). */
export const SP_SWATCH_MORE = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--sp-line2)] bg-white text-[16px] font-semibold leading-none text-sn-accent';
/** A layout card (prototype `.lcard`: 62% wide, the real miniature 104 px, its name 18 px). */
export const SP_LAYOUT_CARD = 'sn-press flex h-32 w-[62%] shrink-0 snap-center flex-col items-stretch gap-1.5 text-left';
/** The picture's height in a look card (`h-[104px]`). */
export const SP_CARD_PICTURE_PX = 104;
/**
 * A look card's WIDTH follows its picture (owner 2026-10-07: *"should not extend the element. it should just be the
 * size in proportion to the height"*): the row's fixed height × the picture's width/height — a portrait ticket is a
 * narrow card, a wide title a wide one, so more looks show per swipe. Null aspect (not measured yet) keeps 62 %.
 */
export function spCardWidth(aspect: number | null | undefined): { width: number } | undefined {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return undefined;
  return { width: Math.round(Math.min(280, Math.max(76, SP_CARD_PICTURE_PX * aspect + 4))) };
}
/**
 * 📱 EVERY STYLE CARD IS PHONE-SHAPED (owner 2026-10-08, DECISION_LOG "A BACKGROUND CARD IS PHONE-SHAPED",
 * widened: *"we are on mobile view, so show in mobile view, not like a header that is short and wide or at least
 * square or 4:3 or 3:4"* · *"on all style across the market hub"*). A look's picture is drawn in the ONE shared
 * frame — `globals.css` `.sn-phone-card` (3 : 4 portrait, a fixed width from `--phone-card-w`, never flexed) —
 * and the strip scrolls; a card never stretches with the panel. This supersedes the 62 % / follow-the-part card
 * (`SP_LAYOUT_CARD`, `spCardWidth`) for every look picker; `lib/every-style-card-is-phone-shaped.test.ts` walks
 * them. The frame's rule lives in the stylesheet alone — never copied here.
 */
export const SP_PHONE_CARD = 'sn-phone-card';
/** The frame as a look card's picture: the shared class, clipped, the page's ground behind it. */
export const SP_PHONE_PICTURE = `${SP_PHONE_CARD} relative block overflow-hidden rounded-lg bg-[var(--sp-page)]`;
/** A look card: the frame over its one-line name — exactly as wide as the frame (`w-min`), never a share of the row. */
export const SP_LOOK_CARD = 'sn-press flex min-h-11 w-min shrink-0 snap-center flex-col items-stretch gap-1.5 text-left';
/** The card's name under the frame: one line, cut to the frame's width (it never widens the card). */
export const SP_LOOK_NAME = 'block h-[18px] w-0 min-w-full truncate text-center text-[13px] font-semibold leading-[18px]';
/**
 * A card's name that must READ WHOLE (the Reveal's openings — "Four-flap envelope" is wider than the 112-px frame, and
 * with its ◆ Pro mark beside it the words were cut from BOTH ends: "r-flap envelope ◆ PR"; controller 2026-10-09:
 * *"the name must read whole … never clip a word"*). It takes a second line at a space or a hyphen, never mid-word
 * and never cut; it still never widens the card (`w-0 min-w-full`). The mark goes on its own line (`SP_LOOK_MARK`).
 */
export const SP_LOOK_NAME_WHOLE = 'block w-0 min-w-full whitespace-normal text-center text-[13px] font-semibold leading-[18px] [overflow-wrap:normal]';
/** The line under such a name that holds the card's mark (◆ Pro) — centred, as wide as the frame, 18 px. */
export const SP_LOOK_MARK = 'flex h-[18px] w-0 min-w-full items-center justify-center';

/** A pill in Background's third row (Gallery ▸ · Upload ◆) — a `.dd` that opens a sheet. */
export const SP_PILL_BUTTON =
  'sn-press flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-[var(--sp-line)] bg-white pl-[14px] pr-3 text-left text-[14px] font-medium text-[var(--sp-ink)]';
/** ‹ › beside a row (Order) — prototype `.r2 .nb`. */
export const SP_STEP_BUTTON =
  'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--sp-line)] bg-white text-[var(--sp-ink)] disabled:opacity-35';
/** The keyboard's bar while typing on the page (prototype `#kbd .kbar`): "Typing · Names" · Done. */
export const SP_KEY_BAR = 'flex h-11 shrink-0 items-center justify-between border-t border-[var(--sp-line)] bg-white pl-[14px] pr-2 text-[13px] font-semibold text-[var(--sp-ink2)]';
export const SP_KEY_DONE = 'sn-press inline-flex h-11 items-center px-1';
/** The resize grab (prototype `.grab`): a 44 × 5 pill in a 14 px strip — the tap reaches 15 px above and below. */
export const SP_GRAB = 'relative flex !h-[14px] !min-h-0 w-full shrink-0 touch-none items-center justify-center before:absolute before:inset-x-0 before:-top-[15px] before:-bottom-[15px] before:content-[""]';

/** Every class string a tap lands on, by name — the guard walks them all. */
export const STAGE_TAP_TARGETS = {
  STAGE_ROW,
  STAGE_ICON_BUTTON,
  STAGE_ITEM_BUTTON,
  STAGE_TOOL_PILL,
  STAGE_TOOL_BUTTON,
  STAGE_PART_TILE,
  STAGE_SHEET_ROW,
  STAGE_GUEST_TAB,
  SP_PHASES,
  SP_PHASE,
  SP_DD,
  SP_DD_BUTTON,
  SP_ROW,
  SP_SWITCH,
  SP_SWATCH,
  SP_LAYOUT_CARD,
  SP_PILL_BUTTON,
  SP_STEP_BUTTON,
  SP_KEY_BAR,
  SP_KEY_DONE,
} as const;

/** The panel with nothing picked: the grab and the one row (prototype `.lt.min`, 62 px of an 812 phone). */
export const STAGE_PANEL_REST_PX = 62;

/** The panel picked open: the lower half of this screen — never more. */
export function stagePanelOpenPx(viewportH: number): number {
  return Math.min(Math.floor(viewportH / 2), makerLtClampPx(Number.POSITIVE_INFINITY, viewportH));
}

/** How long the panel takes to rise or fold (the prototype's 240 ms). */
export const STAGE_PANEL_MS = 240;

/**
 * 🖼 THE PICKED PART'S FRAME, BETWEEN ITS NEIGHBOURS (owner 2026-10-07: the Logo's frame and ＋ sat ON "TOGETHER WITH
 * THEIR FAMILIES" — "the frame hugs its part's real box, the ＋ sits in the gap BETWEEN parts and never over another
 * part's content, and a tap on another part's visible text always picks that part"). Each edge sits at most `pad` px
 * out, and never past the MIDDLE of the gap to the neighbour on that side; a control on that edge is at most as tall
 * as the gap (never under 26 px, the ＋'s own face), so its tap stops where the neighbour's words begin.
 * `gapAbove` / `gapBelow` null: nothing drawn on that side (the page's own margin) — the full pad and a 44 px tap.
 */
export function partFrameEdges(
  box: { top: number; height: number },
  gapAbove: number | null,
  gapBelow: number | null,
  pad = 22,
): { top: number; bottom: number; tapAbove: number; tapBelow: number } {
  const half = (g: number | null) => (g === null ? pad : Math.max(0, Math.min(pad, g / 2)));
  const tap = (g: number | null) => (g === null ? 44 : Math.max(26, Math.min(44, g)));
  return { top: box.top - half(gapAbove), bottom: box.top + box.height + half(gapBelow), tapAbove: tap(gapAbove), tapBelow: tap(gapBelow) };
}
