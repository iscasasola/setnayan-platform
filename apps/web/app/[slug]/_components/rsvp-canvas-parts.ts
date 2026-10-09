/**
 * 🧩 THE RSVP STAGE'S THREE SCREENS, AS PARTS — owner, on the Maker's Stages › RSVP (2026-10-07/08, verbatim):
 * *"RSVP cannot select anything"* · *"it is the actual RSVP not an editing way"* · *"no way to access yes and no
 * response"* · *"yes and no page for the rsvp is to show what the rsvp looks like after the reply yes or no"*.
 *
 * On the Maker's canvas (`?editor=1` from a VERIFIED host, the SAMPLE guest) the reply form and the two
 * after-screens are EDITED, never used: every piece is a part the couple picks, exactly as on the Invitation's
 * canvas. This file is that canvas's own rules, on the page's own document:
 *
 *   · WHERE EACH PART IS — the page marks a section with the SHIPPED marker (`<span hidden data-maker-section>`,
 *     `maker-section-find.ts`): `f:greeting` · `f:rsvp` on the form, `f:yesnote` + `f:pass` · `f:nonote` on the
 *     after-screens. The masthead (`DoorShell`: the couple's mark, the eyebrow, their names, the date, the place)
 *     is `f:hero`, its parts `[data-el]` — stamped here (`stampRsvpCanvas`), on the canvas only, because the door's
 *     own markup is every guest's and is not touched.
 *   · WHAT A TAP PICKED — `rsvpPartOfTap`: the part tapped (`{ key, el }`, the SAME pair the Event Hub canvas posts
 *     with its `edit`), and the word under the finger when there is one. Null: the page's ground.
 *   · A TAB OPENS ITS SCREEN FROM THE TOP, AND NOTHING TAKES IT AWAY FROM THERE — `createRsvpCanvasTop`, on the
 *     hold the Stages canvas uses for its tabs (`hub-tab-dom.ts` `createPageTop`).
 *
 * 📦 No imports but `hub-tab-dom.ts` (itself import-free), on purpose: the Maker's lazy tools and the canvas bridge
 * both read this small file, so nothing of the Maker rides a guest's page and no chunk is shared between them
 * (`maker-section-find.ts` tells that story). Never mounted for a guest — `rsvp-canvas-bridge.tsx` is the only
 * caller on a page, and the pages mount it behind the host-verified `canvas`.
 *
 * Pure over a structural document: executed by `lib/the-rsvp-stage-is-parts.test.ts`.
 */
import { createPageTop } from './hub-tab-dom';

/** The masthead's canvas key — the hero's, so its parts are the hero's parts (`lib/maker-parts.ts`). */
export const RSVP_CANVAS_HERO = 'f:hero';

/** The sections each screen marks, in page order (`invite/reply/page.tsx`, `invite/enter/page.tsx`). */
export const RSVP_CANVAS_SECTIONS = {
  form: ['f:greeting', 'f:rsvp'],
  thanks: ['f:yesnote', 'f:pass'],
  decline: ['f:nonote'],
} as const;

/** The masthead's parts, as `stampRsvpCanvas` names them (`[data-el]`) — the hero's own element keys. */
export const RSVP_CANVAS_HERO_ELS = ['mark', 'eyebrow', 'names', 'line', 'date', 'venue'] as const;

/**
 * 📝 THE SECTION EACH WORD IS IN (`data-rsvp-word="rsvp:<key>"`, `lib/rsvp-ask.ts` `RSVP_WORD_KEYS` + the reply-by
 * line). A tap on a word picks THIS part; a second tap on the picked part's word types it.
 */
export const RSVP_WORD_SECTION: Readonly<Record<string, string>> = {
  attending: 'f:rsvp',
  declined: 'f:rsvp',
  'reply-by': 'f:rsvp',
  thanksHeading: 'f:yesnote',
  thanksMessage: 'f:yesnote',
  declineHeading: 'f:nonote',
  declineMessage: 'f:nonote',
  eyebrow: 'f:rsvp',
  question: 'f:rsvp',
  hint: 'f:rsvp',
};

/**
 * 🧩 EVERY LINE IS ITS OWN PART, AND THE GROUP IS ONE TOO (owner 2026-10-09, on the live Maker's RSVP stage: *"why is
 * this grouped?"* — the eyebrow, the question, both answers and the hint sat in ONE frame · *"shouldn't it be per
 * element?"* — yes · on the prototype: *"heading message then the whole group?"* — yes). The page marks each line of
 * a section (`data-rsvp-line`, for every guest: it is only a name); a tap on a line picks THAT line, a tap on the
 * section between its lines picks the group. The frame, its name and the toolbar's rows follow the line.
 *
 * `data-rsvp-line`, never `data-el`: that attribute is the Event Hub's own (the cover's parts and their looks), and
 * these lines are not those.
 */
export const RSVP_LINE_ATTR = 'data-rsvp-line';
/** The lines each section holds, in page order — and each one's name on its frame and in "You're editing". */
export const RSVP_SECTION_LINES: Readonly<Record<string, readonly string[]>> = {
  'f:rsvp': ['eyebrow', 'question', 'yes', 'no', 'hint'],
  'f:yesnote': ['heading', 'message'],
  'f:nonote': ['heading', 'message'],
  'f:pass': ['save'],
};
export const RSVP_LINE_NAME: Readonly<Record<string, string>> = {
  eyebrow: 'Eyebrow',
  question: 'Question',
  yes: 'Yes answer',
  no: 'No answer',
  hint: 'Hint',
  heading: 'Heading',
  message: 'Message',
  save: 'Save button',
};
/** A line of a section, or null when that section has no such line (a stray attribute picks nothing). */
export function rsvpLineOf(section: string | null | undefined, line: string | null | undefined): string | null {
  return section && line && RSVP_SECTION_LINES[section]?.includes(line) ? line : null;
}

/** The words TYPED on the page (the reply-by line is a date — it is set in the form's own tools, never typed). */
export function rsvpWordIsTyped(bridgeKey: string | null | undefined): boolean {
  if (!bridgeKey || !bridgeKey.startsWith('rsvp:')) return false;
  const key = bridgeKey.slice(5);
  return key !== 'reply-by' && key in RSVP_WORD_SECTION;
}

/* ── the messages and the window events ───────────────────────────────────── */

/** Maker → frame: the part picked now (`<canvas>|<el>`, `makerStagePickedAttr`) — null: none. */
export const RSVP_PICKED_MESSAGE = 'rsvpPicked';
/** Maker → frame: this screen was just opened by its tab — start at the top, and stay. */
export const RSVP_TOP_MESSAGE = 'rsvpTop';
/** Maker → frame: Done — the words being typed are left. */
export const RSVP_TYPE_STOP_MESSAGE = 'rsvpTypeStop';
/**
 * Frame → Maker. ⚠ NEVER the Event Hub canvas's own `t:'edit'` / `'tapOutside'` / `'type'`: the Maker's work area
 * stays mounted UNDER the RSVP stage and answers those from any frame — an `edit` for `f:hero` would move the
 * Maker's selection to the Invitation's cover and close this stage under the couple's finger. These are the RSVP
 * stage's own, heard by the Stages panel alone (`stage-tools.tsx`).
 */
/** A part was tapped — `{ key, el?, word? }`: the pair `makerPartOfTap` reads, and the word under the finger. */
export const RSVP_PICK_MESSAGE = 'rsvpPick';
/** The page's ground was tapped: the picked part is let go. */
export const RSVP_GROUND_MESSAGE = 'rsvpGround';
/** Typing on the page began or ended — `{ phase: 'start' | 'end', key, el?, word }`. */
export const RSVP_TYPING_MESSAGE = 'rsvpTyping';
/** A word as it is typed — `{ key: 'rsvp:<word>', text }`. */
export const RSVP_TYPED_MESSAGE = 'rsvpType';

/** A word typed on the page — `detail: { key, text }`; the RSVP panel saves it (one value, two doors). */
export const RSVP_WORD_TYPED_EVENT = 'setnayan:rsvp-word-typed';
/** The Stages panel asks the RSVP stage — `detail: { scene?, controls? }`: show that screen · open or fold its tools. */
export const RSVP_STAGE_ASK_EVENT = 'setnayan:rsvp-stage-ask';
/** The RSVP stage says which screen it has on show — `detail: scene`. The label follows the canvas, never a guess. */
export const RSVP_STAGE_SCENE_EVENT = 'setnayan:rsvp-stage-scene';

/**
 * 🧭 WHERE THE STAGES TAB ROW STANDS ON THE RSVP STAGE: a slot at the FOOT of the stage's own column
 * (`maker-rsvp-stage.tsx`), a flex sibling AFTER its screens — so the screens end above the row by construction.
 * (Measured on the preview, 08 Oct: drawn over the foot of the work area as on other stages, the row sat UNDER the
 * RSVP layer — the layer covers the work area — and no finger could reach Form · When yes · When no.)
 */
export const RSVP_STAGE_BAR_SLOT = 'data-rsvp-stage-bar-slot';

/** The RSVP stage's frame for one screen, while it is the one on show (`maker-rsvp-stage.tsx`). */
export const rsvpStageFrameSelector = (screen: string) => `iframe[data-rsvp-stage-frame="${screen}"]:not([hidden])`;

/**
 * 🔒 EVERY CONTROL OF A SAMPLE PAGE IS DRAWN, NEVER LIVE. The bridge gives each of these the platform's own `inert`:
 * it cannot take focus — not by a tap, not by the Tab key, not from a script — it cannot be pressed, and a tap on
 * it lands on the part it sits in (so it still PICKS). The belt to the bridge's braces (its capture-phase stops).
 * A `label` is not in the list: the couple's own words sit inside the answers' labels, and are typed there. Nor is
 * anything that only WRAPS content (a `[tabindex]` container): inert, it would take every part inside it out of reach.
 */
export const RSVP_CANVAS_CONTROLS = 'input, textarea, select, button, a[href], summary';

/* ── what a tap picked ────────────────────────────────────────────────────── */

type TapEl = {
  getAttribute(name: string): string | null;
  readonly parentElement: TapEl | null;
  readonly previousElementSibling: { getAttribute(name: string): string | null } | null;
  querySelector?(sel: string): unknown;
};

/**
 * 🃏 THE CARD IS THE GROUP (owner 2026-10-09, on the prototype: *"heading message then the whole group?"* — yes; the
 * brief: the card is picked as the group **from its edge**). Each screen's door card holds ONE group of lines — the
 * form's, the When-yes note's or the When-no note's. A tap on the card that lands on no line and on no part of the
 * masthead (its edge; the gaps between its own layers) picks THAT group, and the group's frame is drawn round the card
 * (`[data-rsvp-card]`, named on the canvas by `stampRsvpCanvas`).
 *
 * Why the edge and not "between the lines": measured in the lab (2026-10-10), a finger's tap in the 20 px beside an
 * answer is moved by the browser onto that answer's button, so the gap between lines cannot be relied on.
 */
export const RSVP_CARD_GROUPS = ['f:rsvp', 'f:yesnote', 'f:nonote'] as const;
export const RSVP_CARD_ATTR = 'data-rsvp-card';

export type RsvpTapPart = {
  /** The section's canvas key (`f:hero`, `f:rsvp`, `f:greeting`, `f:yesnote`, `f:pass`, `f:nonote`). */
  key: string;
  /** The masthead part (`[data-el]`) — null in every other section. */
  el: string | null;
  /** The word under the finger (`rsvp:<key>`), when the tap was on one. */
  word: string | null;
  /** The LINE of the section under the finger (`data-rsvp-line`) — null: the section between its lines (the group). */
  line: string | null;
};

/**
 * THE PART A TAP IS ON: the nearest marked section above the tapped element (the element its marker stands in
 * front of), and — in the masthead — the part of it (`[data-el]`). Null: the page's ground, or the masthead's own
 * paper between its parts (a tap there lets the picked part go; it never picks the whole card). In any other
 * section, the LINE under the finger too — or none, when the tap is on the section between its lines: the group.
 */
export function rsvpPartOfTap(target: TapEl | null): RsvpTapPart | null {
  let el: string | null = null;
  let word: string | null = null;
  let line: string | null = null;
  for (let node = target; node; node = node.parentElement) {
    word ??= node.getAttribute('data-rsvp-word');
    el ??= node.getAttribute('data-el');
    line ??= node.getAttribute(RSVP_LINE_ATTR);
    const key = node.previousElementSibling?.getAttribute('data-maker-section') ?? null;
    if (!key) continue;
    if (key === RSVP_CANVAS_HERO) {
      if (el) return { key, el, word: null, line: null };
      /* The card's OWN paper — the card itself (its edge) or one of its own layers (the masthead's block, the body's
         gaps): the group this card holds. Anything deeper that is no part (a button under the note, "Open the
         invitation") is still the ground: a tap there lets go, as before. */
      if (target !== node && target?.parentElement !== node) return null;
      const group = RSVP_CARD_GROUPS.find((k) => Boolean(node.querySelector?.(`[data-maker-section="${k}"]`)));
      return group ? { key: group, el: null, word: null, line: null } : null;
    }
    return { key, el: null, word, line: rsvpLineOf(key, line) };
  }
  return null;
}

/* ── the masthead's parts ─────────────────────────────────────────────────── */

type StampEl = {
  readonly tagName: string;
  readonly children: ArrayLike<StampEl>;
  readonly parentElement: StampEl | null;
  readonly className: string;
  setAttribute(name: string, value: string): void;
  querySelector(sel: string): StampEl | null;
  insertBefore?(node: unknown, before: unknown): unknown;
};
type StampDoc = {
  querySelector(sel: string): StampEl | null;
  createElement(tag: string): { hidden: boolean; setAttribute(name: string, value: string): void };
};

/**
 * 🏷 NAME THE MASTHEAD'S PARTS, ON THE CANVAS ONLY. `DoorShell` draws the couple's mark, the eyebrow, their names
 * and the date · place for every guest; here, on the Maker's sample, each is given the hero part it IS
 * (`data-el`), and the card is marked as the hero's section — so the SHIPPED finder (`findMakerSection` +
 * `[data-el]`) frames them and a tap names them. Attributes and one hidden marker; nothing a guest is served, and
 * nothing that draws. The date and the place arrive already named (the page splits that line for the canvas).
 * Safe to call again (a second call changes nothing).
 */
export function stampRsvpCanvas(doc: StampDoc): boolean {
  const header = doc.querySelector('[data-door-header]');
  const card = header?.parentElement;
  if (!header || !card) return false;
  if (!doc.querySelector(`[data-maker-section="${RSVP_CANVAS_HERO}"]`) && card.parentElement?.insertBefore) {
    const marker = doc.createElement('span');
    marker.hidden = true;
    marker.setAttribute('data-maker-section', RSVP_CANVAS_HERO);
    card.parentElement.insertBefore(marker, card);
  }
  /* 🃏 The card is the screen's group of lines (`RSVP_CARD_GROUPS`): its frame is drawn round this. */
  card.setAttribute(RSVP_CARD_ATTR, '');
  let pastNames = false;
  for (const child of Array.from(header.children)) {
    if (child.tagName === 'H1') {
      child.setAttribute('data-el', 'names');
      pastNames = true;
    } else if (child.tagName !== 'P') continue;
    else if (!pastNames) child.setAttribute('data-el', 'eyebrow');
    /* After the names: the couple's own invitation line (the door's `sub`); the date · place line is mono, and its
       two halves are named by the page. */
    else if (!/\bfont-mono\b/.test(child.className)) child.setAttribute('data-el', 'line');
  }
  doc.querySelector('[data-door-mark] > *')?.setAttribute('data-el', 'mark');
  return true;
}

/* ── a tab opens its screen from the top ──────────────────────────────────── */

/**
 * 🔝 THE SCREEN A TAB JUST OPENED STARTS AT ITS TOP AND STAYS THERE until the couple moves it (owner's rule for
 * every Stages tab; `hub-tab-dom.ts`). `open()` — the Maker said this screen was opened by its tab; `onScroll()` —
 * a scroll that is not the couple's is put back; their own touch, or picking a part (which may bring that part
 * into view), ends the hold.
 */
export function createRsvpCanvasTop(
  win: { readonly scrollY: number; scrollTo(to: { top: number; behavior: 'instant' }): void },
  now: () => number = Date.now,
) {
  const top = createPageTop(win, now);
  return {
    open() {
      top.hold();
      win.scrollTo({ top: 0, behavior: 'instant' });
    },
    onScroll: () => top.onScroll(),
    /** The couple's own touch on the page. */
    onTouch: () => top.release(),
    /** A part was picked (non-null): the Maker may bring it into view. */
    onPicked(picked: string | null) {
      if (picked) top.release();
    },
    held: () => top.held(),
  };
}

/* ── words typed on the page ──────────────────────────────────────────────── */

/** What was typed, as one line of plain words (a paste or a stray newline never makes a second line). */
export function rsvpTypedText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}
