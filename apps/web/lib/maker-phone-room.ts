/**
 * 📱 THE PAGE KEEPS MOST OF A PHONE — THE MAKER'S ROOM RULE (owner, live iPhone
 * test 2026-10-02: *"the screen is too clumped, not much space to work on"*;
 * 2026-10-05: *"we only maximize the height on the lower third. and all tools
 * can only reside on the thumb area / lower third"* → *"approve"*).
 *
 * On a phone the Maker is three zones, in this order and no other:
 *
 *   TOP NAV      52 px — ✕ · the screen you are on · [↺ | 👁] · ✓
 *   WORKSPACE    the page, full width — nothing editable opens over it
 *   LOWER THIRD  `MAKER_LT_HEIGHT` — where you are · the navigator, or a tool
 *
 * At 390 × 844 and 375 × 667 the page keeps at least 55% of the height, with or
 * without a tool open, because a tool opens INSIDE the lower third
 * (`MAKER_LT_TOOL`) — never over the page, never dimming it. Every piece of
 * phone chrome DECLARES its phone height in its own classes and wears
 * `data-phone-chrome="bar|bottom|panel"`; `lib/the-maker-keeps-the-page-on-a-phone.test.ts`
 * renders each and adds them up.
 */

export const MAKER_PHONE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
] as const;

/** The page preview's share of a phone's height, at least. */
export const MAKER_PREVIEW_MIN_SHARE = 0.55;

/** The toolbar on a phone: ONE 44 px row, 4 px padding above and below (owner 2026-10-02: one row, Apply always in it). */
export const MAKER_PHONE_BAR_PX = 52;

/*
 * 📏 THE TOP NAV — ONE ROW AT 375 PX (owner 2026-10-05, the keynote chrome):
 *
 *   ✕ Exit (red, its own pill) · the screen you are on ("RSVP · RSVP form",
 *   truncates) · [ ↺ Undo | 👁 Preview ] (one shared pill) · ✓ Apply (green,
 *   its own pill, the count) — every button a 44 × 44 icon with its name
 *   (`MAKER_BAR_ICON`); Apply's first tap opens the Apply sheet, and only its
 *   labelled Apply publishes.
 *
 * Each item declares its phone width (`w-[…]`, or `min-w-[…]` for the one that
 * takes what is left); `lib/the-maker-keeps-the-page-on-a-phone.test.ts` adds
 * the row up and fails it over 375, or a bar button under 44 px or unnamed.
 */
export const MAKER_BAR_PHONE = {
  /* top */
  exit: 'max-md:w-11',
  stage: 'max-md:min-w-[120px]',
  undoTop: 'max-md:w-11',
  preview: 'max-md:w-11',
  applyTop: 'max-md:w-11',
  /** The bar's own Page ▾ — a desktop's; on a phone the lower third's menu and navigator are. */
  pageTop: 'max-lg:hidden',
  /** The new Maker's one Stages | Studio segmented control (`makerStagesStudioEnabled`) — it takes what is left of the row. */
  side: 'max-md:min-w-[150px]',
} as const;

/**
 * 🔘 A BAR BUTTON: a 44 × 44 icon, on every width (owner 2026-10-04, *"apply
 * icon · undo icon · exit icon"*). Its name is its `aria-label` (and `title`).
 */
export const MAKER_BAR_ICON =
  'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink aria-expanded:bg-ink/[0.09] disabled:cursor-not-allowed disabled:text-ink/35 disabled:hover:bg-transparent';
/**
 * ✓ Apply: the one filled button — a GREEN circle, its own pill, on a phone
 * (owner 2026-10-05: *"apply should show a green color?"*); a desktop keeps
 * the wine circle (`bg-mulberry`, the house primary) this round.
 */
export const MAKER_BAR_APPLY =
  'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mulberry text-cream transition-colors duration-sn-control ease-sn hover:bg-mulberry-600 max-lg:bg-success-600 max-lg:hover:bg-success-700 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40 disabled:hover:bg-ink/10';
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

/*
 * 🧰 THE LOWER THIRD — every phone editing tool lives here (owner, 2026-10-05:
 * *"we only maximize the height on the lower third. and all tools can only
 * reside on the thumb area/ lower third"* → *"approve"* of
 * `prototypes/maker_lower_third_interactive_2026-10-05_fable.html`).
 *
 *   TOP NAV      ✕ · the screen you are on · [↺ | 👁] · ✓          (52 px)
 *   WORKSPACE    the page, full width — nothing editable opens over it
 *   LOWER THIRD  where you are (menu ▾ + the pick) · the navigator   (`MAKER_LT_HEIGHT`)
 *                — or, with a tool open, the collapsed column + the tool
 *
 * The shell sets `--maker-lt-h` (`MAKER_LT_HEIGHT`) and draws the lower third
 * in its flow, under the workspace. A tool is `fixed` over the lower third,
 * right of the collapsed column (`MAKER_LT_TOOL`): at 375 px it is 311 px wide.
 * Phone only (`max-lg:`) — the desktop keeps its columns.
 */
/** The lower third's height, the home indicator's room added by the shell. */
export const MAKER_LT_HEIGHT = 'clamp(216px,30dvh,236px)';
/** `MAKER_LT_HEIGHT` in px at a phone's visible height — the guard's arithmetic, the same three numbers. */
export function makerLtHeightPx(viewportH: number): number {
  return Math.min(236, Math.max(216, 0.3 * viewportH));
}
/*
 * ↕ THE LOWER THIRD CAN BE RESIZED (owner, live iPhone 2026-10-06: *"Also the
 * lower third screen can be resized up to lower half of the screen. Drag the
 * edge to resize"* — DECISION_LOG "THE LOWER THIRD CAN BE RESIZED"). The new
 * Maker only (`makerStagesStudioEnabled`): a grab handle on its top edge drags
 * it between its default (`MAKER_LT_HEIGHT`) and the LOWER HALF of the screen
 * (`MAKER_LT_HALF`), never more; a tap on the handle toggles default ↔ half.
 * The size is remembered per device as a SHARE of the screen (a convenience in
 * localStorage, `MAKER_LT_SIZE_KEY`), so a rotated phone re-clamps it. A Studio
 * tool drawn full screen rests its editor at `MAKER_LT_HALF` too.
 * The shipped Maker keeps `MAKER_LT_HEIGHT` and no handle.
 */
/** The most the lower third may take — the lower half of the screen. */
export const MAKER_LT_HALF = '50dvh';
export const MAKER_LT_HALF_SHARE = 0.5;
/* The drag's arithmetic (clamp · tap · remembered share) is `lib/maker-lt-size.ts` — it loads with
   the handle, never in the Maker's first load. */

/** The collapsed column a tool leaves on the left: the tool's name, ‹ ›, ×. */
export const MAKER_LT_COLUMN_PX = 52;
/** A tool's width at the narrowest phone, at least (owner: "make sure it doesn't feel too cramped"). */
export const MAKER_LT_TOOL_MIN_PX = 300;
/** A tool in the lower third: fixed over it, 60 px from the left (column 52 + 4 + 4), 4 px from the right. */
export const MAKER_LT_TOOL =
  'max-lg:fixed max-lg:left-[60px] max-lg:right-1 max-lg:top-auto max-lg:bottom-[calc(env(safe-area-inset-bottom)+4px)] max-lg:z-30 max-lg:h-[calc(var(--maker-lt-h)-8px)] max-lg:max-h-none max-lg:w-auto max-lg:rounded-2xl max-lg:bg-cream max-lg:shadow-none max-lg:ring-1 max-lg:ring-ink/10';

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
  // 🧰 The lower third and what sits in it (\`--maker-lt-h\`, \`MAKER_LT_HEIGHT\`).
  if (v === 'calc(var(--maker-lt-h)+env(safe-area-inset-bottom))') return makerLtHeightPx(viewportH);
  let m = /^calc\(var\(--maker-lt-h\)-(\d+)px\)$/.exec(v);
  if (m) return makerLtHeightPx(viewportH) - Number(m[1]);
  // A bar over the phone's own safe area: the inset is the device's, not the page's.
  m = /^calc\((\d+)px\+env\(safe-area-inset-[a-z]+\)\)$/.exec(v);
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
