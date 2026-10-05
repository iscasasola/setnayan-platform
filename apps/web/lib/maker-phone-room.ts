/**
 * 📱 THE PAGE KEEPS MOST OF A PHONE — THE MAKER'S ROOM RULE (owner, live iPhone
 * test 2026-10-02, the headline finding: *"the screen is too clumped, not much
 * space to work on"*).
 *
 * At 390 × 844 and 375 × 667, with ANY Maker panel or sheet open:
 *
 *   · the page preview keeps at least 55% of the screen's height;
 *   · the top bar + the sheet + any strip take at most 45% together;
 *   · one panel shows at a time.
 *
 * Every piece of the Maker's phone chrome DECLARES its phone height in its own
 * classes — a fixed `max-md:h-[Npx]` / `max-lg:h-[Npx]` for a bar or a strip, a
 * cap for a panel — and wears `data-phone-chrome="bar|strip|panel"`. The cap a
 * panel wears is one of the two below: what is left of 45% after the bar (and,
 * in the guided flow, after its one line). `lib/the-maker-keeps-the-page-on-a-phone.test.ts`
 * renders each panel and adds up what is visible with `phoneChromeHeight`;
 * a panel whose height is not declared fails it.
 */

export const MAKER_PHONE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
] as const;

/** The page preview's share of a phone's height, at least. */
export const MAKER_PREVIEW_MIN_SHARE = 0.55;

/** The toolbar on a phone: ONE 44 px row, 4 px padding above and below (owner 2026-10-02: one row, Apply always in it). */
export const MAKER_PHONE_BAR_PX = 52;
/** The guided flow's one line (progress · step ▾ · ‹ › · All items). */
export const MAKER_PHONE_GUIDE_LINE_PX = 52;

/* The two panel caps — whole Tailwind class strings, so the stylesheet is built
   from them (`tailwind.config` scans lib/). Bar + cap (+ line) = 45dvh. */
/** A panel or sheet under the bar alone. */
export const MAKER_PHONE_PANEL_CAP = 'max-lg:max-h-[calc(45dvh-52px)]';
/** A panel under the bar AND the guided flow's line. */
export const MAKER_PHONE_GUIDED_PANEL_CAP = 'max-lg:max-h-[calc(45dvh-104px)]';

/*
 * 📏 THE PHONE'S TWO BARS — frame G ("Phone — the preview is the screen") of
 * `prototypes/maker_in_four_2026-09-30_fable.html`, as rearranged by the owner on
 * 2026-10-04 (PR-0 of the Maker rearrangement): fix 5 of "FOUR FIXES BEFORE
 * BUILD" put Undo beside Apply; then *"that can be a preview icon?"* (⋯ → 👁)
 * and *"apply icon · undo icon · exit icon"*:
 *
 *   TOP     ‹ Exit · the stage you are on ("Invitation · as a guest sees it")
 *           · ↶ Undo · 👁 Preview · ✓ Apply (n) — every button a 44 × 44 icon
 *           with its name (`MAKER_BAR_ICON`); Apply's first tap opens the Apply
 *           sheet, and only its labelled Apply publishes.
 *   BOTTOM  Page ▾ (the page: "Welcome ▾") · Look · Event Details.
 *
 * Apply sits up top beside Undo: one place per control, and in reach while a
 * half sheet (`MakerHalfSheet`, lib/element-sheet-state.ts) covers the bottom of the screen.
 *
 * One row each at 375 px: each item declares its phone width (`w-[…]`, or
 * `min-w-[…]` for the one that takes what is left); `lib/the-maker-keeps-the-page-on-a-phone.test.ts`
 * adds each row up and fails a row over 375, a word its button cannot hold, or
 * a bar button under 44 px or without a name.
 * (Details wears its current name, "Event Details" — tracker d15.)
 */
export const MAKER_BAR_PHONE = {
  /* top */
  exit: 'max-md:w-11',
  stage: 'max-md:min-w-[120px]',
  undoTop: 'max-md:w-11',
  preview: 'max-md:w-11',
  applyTop: 'max-md:w-11',
  /** The bar's own Page ▾ — on a phone it is the bottom bar's. */
  pageTop: 'max-md:hidden',
  /* bottom */
  page: 'max-md:min-w-[100px]',
  look: 'max-md:w-[48px]',
  details: 'max-md:w-[118px]',
} as const;

/**
 * 🔘 A BAR BUTTON: a 44 × 44 icon, on every width (owner 2026-10-04, *"apply
 * icon · undo icon · exit icon"*). Its name is its `aria-label` (and `title`).
 */
export const MAKER_BAR_ICON =
  'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink aria-expanded:bg-ink/[0.09] disabled:cursor-not-allowed disabled:text-ink/35 disabled:hover:bg-transparent';
/** ✓ Apply: the one filled button — a wine circle (`bg-mulberry`, the house primary). */
export const MAKER_BAR_APPLY =
  'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mulberry text-cream transition-colors duration-sn-control ease-sn hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40 disabled:hover:bg-ink/10';
/** The phone's bottom bar: one 52 px row (+ the bottom safe area, which is the phone's, not the page's). */
export const MAKER_PHONE_BOTTOM_BAR_PX = 52;
/** A word on a phone bar: 13 px, 8 px each side. */
export const MAKER_BAR_PHONE_WORD_PX = 13;
export const MAKER_BAR_PHONE_PAD_PX = 8;
/** Each bar's gap between items, and its side padding, on a phone. */
export const MAKER_BAR_PHONE_GAP_PX = 4;
export const MAKER_BAR_PHONE_SIDE_PX = 8;

/**
 * 🎞 THE SCENE STRIP NEVER SCROLLS DOWN ON A PHONE (owner, iPhone, 2026-10-05:
 * under the canvas every thumbnail was cut at its TOP — "ticket" and "RSVP"
 * sliced in half). MEASURED on the live Maker at 375 and 430 px: the strip
 * (`<ol>`, `overflow-x: auto`, which makes its Y overflow `auto` too) was 185 px
 * tall and 295 px deep. The extra 110 px were the CLOSED `(i)` bubbles of the
 * tile labels — `.sn-tip` is always in the DOM, `visibility: hidden`, hanging
 * BELOW its label — so the strip had a vertical scroll range, and a diagonal
 * swipe or Page ▾'s `scrollIntoView({ block: 'start' })` slid every tile up
 * under the strip's top edge.
 *
 * On a phone, then: a closed bubble takes no room and the strip cannot scroll
 * on Y at all. An OPEN bubble does not live in the strip either — it floats on
 * the viewport (`lib/float-open-tips.ts`): MEASURED at 375 px with the Maker in
 * Desktop view, a tile label had 81 px above it and 35 below in a 116 px strip,
 * and the longest real note (a fixed scene's "where it comes from") is 132 px,
 * so neither above nor below fits inside the strip.
 * Held by `lib/the-scene-strip-never-scrolls-down.test.ts`.
 */
export const MAKER_STRIP_PHONE = 'max-lg:overflow-y-hidden max-lg:[&_.sn-tip:not([data-open=true])]:hidden';

/* ─── the measuring half (pure — for the guard) ─────────────────────────── */

const PHONE_PREFIXES = ['max-md:', 'max-lg:', 'max-sm:'];
const WIDE_PREFIX = /^(sm|md|lg|xl|2xl|min-\[[^\]]+\]):/;

/** Is this class list hidden on a phone? */
export function hiddenOnPhone(classes: string): boolean {
  const tokens = classes.split(/\s+/).filter(Boolean);
  const phone = tokens.filter((t) => PHONE_PREFIXES.some((p) => t.startsWith(p))).map((t) => t.slice(t.indexOf(':') + 1));
  const base = tokens.filter((t) => !t.includes(':'));
  const display = ['hidden', 'flex', 'block', 'grid', 'inline-flex', 'contents', 'inline-block'];
  const last = (list: string[]) => [...list].reverse().find((t) => display.includes(t));
  return (last(phone) ?? last(base)) === 'hidden';
}

/** One length token → px at this viewport height (null when it is not a length this guard reads). */
function lengthPx(v: string, viewportH: number): number | null {
  // A bar over the phone's own safe area: the inset is the device's, not the page's.
  let m = /^calc\((\d+)px\+env\(safe-area-inset-[a-z]+\)\)$/.exec(v);
  if (m) return Number(m[1]);
  m = /^calc\((\d+(?:\.\d+)?)dvh-(\d+)px\)$/.exec(v);
  if (m) return (Number(m[1]) * viewportH) / 100 - Number(m[2]);
  m = /^(\d+(?:\.\d+)?)dvh$/.exec(v);
  if (m) return (Number(m[1]) * viewportH) / 100;
  m = /^(\d+)px$/.exec(v);
  if (m) return Number(m[1]);
  return null;
}

/**
 * The most this element can take of a phone's height, from its classes — a
 * fixed height, else a max-height. A percentage cap is relative to whatever
 * holds it, so it is NOT read: it returns null, and the guard fails it ("declare
 * a phone height"). Phone variants win over the base; wide variants are ignored.
 */
export function phoneHeightPx(classes: string, viewportH: number): number | null {
  const tokens = classes.split(/\s+/).filter(Boolean).filter((t) => !WIDE_PREFIX.test(t));
  const phone = tokens.filter((t) => PHONE_PREFIXES.some((p) => t.startsWith(p))).map((t) => t.slice(t.indexOf(':') + 1));
  const base = tokens.filter((t) => !t.includes(':'));
  const read = (list: string[], kind: 'h' | 'max-h'): number | null => {
    for (const t of [...list].reverse()) {
      const m = new RegExp(`^${kind}-\\[([^\\]]+)\\]$`).exec(t);
      if (m) return lengthPx(m[1]!, viewportH);
      const n = new RegExp(`^${kind}-(\\d+(?:\\.5)?)$`).exec(t);
      if (n) return Number(n[1]) * 4;
    }
    return null;
  };
  return read(phone, 'h') ?? read(phone, 'max-h') ?? read(base, 'h') ?? read(base, 'max-h');
}

export type PhoneChrome = { kind: string; classes: string; label: string };

/** Every `data-phone-chrome` element in rendered markup, with its classes (attribute order-free). */
export function phoneChromeIn(html: string): PhoneChrome[] {
  const out: PhoneChrome[] = [];
  for (const m of html.matchAll(/<[a-z]+\b[^>]*\bdata-phone-chrome="([a-z]+)"[^>]*>/g)) {
    const tag = m[0];
    const classes = /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '';
    const label = /\baria-label="([^"]*)"/.exec(tag)?.[1] ?? /\bdata-phone-chrome-name="([^"]*)"/.exec(tag)?.[1] ?? m[1]!;
    if (/\shidden=""/.test(tag)) continue;
    out.push({ kind: m[1]!, classes, label });
  }
  return out;
}
