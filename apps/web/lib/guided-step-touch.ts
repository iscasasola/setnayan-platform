/**
 * guided-step-touch.ts — DID THE COUPLE CHANGE ANYTHING ON THIS STEP?
 *
 * The guided walk asks before it leaves a step the couple changed something on
 * ("Keep editing" · "Skip anyway"). Until 2026-10-05 it only knew a change by a
 * NATIVE field's own `input` / `change` event, remembered by ELEMENT — and so
 * (review 2026-10-05):
 *
 *   · a CUSTOM picker — the one dropdown (`PickMenu`, whose list is portalled to
 *     <body>, outside the step), a segmented control, a switch — sets React
 *     state with no native event at all, and was never a change;
 *   · a field that REMOUNTED after its first keystroke (a re-render keyed on the
 *     value) was a new element the memory had never seen.
 *
 * Now: a change is the couple's own act — a trusted keystroke or pick in a
 * native field, a trusted press on a control that IS a choice (a switch, a
 * radio, an option, a pressed toggle), or a picker's own announcement
 * (`announceMakerTouch`). A pick in a list PORTALLED out of the step (the one
 * dropdown's) belongs to the button that opened it (`touchOrigin`: the list's
 * `id` is that button's `aria-controls`), so the step it sits in hears it —
 * with no byte added to `PickMenu`, which is held under its inline size
 * (`pick-menu-stays-inline.test.ts`). A field is remembered by its NAME (or id),
 * so a remount is the same field. Opening a step changes nothing: a tool that
 * fills a field on its own fires no trusted event and announces nothing — and
 * a control that writes LIVE (`writesLive`) is saved as it changes, so it never
 * makes the step "changed" either.
 *
 * Pure where it decides (`isCouplesTouch`, `leaveAsks`), so it is tested with
 * plain objects — there is no DOM in this repo's unit runner.
 */

/** The event a custom picker sends, bubbling, from an element INSIDE the step, when the couple picks. */
export const MAKER_TOUCH_EVENT = 'setnayan:maker-touch';

/** A picker says "the couple just chose something here" — from its own (in-step) element. */
export function announceMakerTouch(from: EventTarget | null | undefined): void {
  if (!from || typeof CustomEvent === 'undefined') return;
  from.dispatchEvent(new CustomEvent(MAKER_TOUCH_EVENT, { bubbles: true }));
}

/** The part of an event this decides on — a DOM `Event` is one. */
export type TouchEventLike = { type: string; isTrusted: boolean; target: unknown };

type ElementLike = {
  tagName?: string;
  getAttribute?: (name: string) => string | null;
  closest?: (sel: string) => unknown;
  name?: unknown;
  id?: unknown;
};

const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
/** A press on one of these IS a choice — the custom pickers' own roles. */
const CHOICE = '[role="switch"],[role="radio"],[role="option"],[role="menuitemradio"],[role="checkbox"],[aria-pressed]';

type Doc = { querySelector: (sel: string) => unknown };

/**
 * Where a touch HAPPENED, for "is it inside this step?" — the element itself, or,
 * for an option in a list portalled out of the step, the button that opened the
 * list (it names the list in `aria-controls` while it is open).
 */
export function touchOrigin(target: unknown, doc: Doc | null): unknown {
  const t = target as ElementLike | null;
  if (!t || typeof t.closest !== 'function' || !doc) return target;
  const list = t.closest('[role="listbox"][id]') as ElementLike | null;
  const id = list && typeof list.getAttribute === 'function' ? list.getAttribute('id') : null;
  if (!id || !/^[\w:.-]+$/.test(id)) return target;
  return doc.querySelector(`[aria-controls="${id}"]`) ?? target;
}

/**
 * The opt-in a control that WRITES LIVE carries — the Wedding March order and
 * Reply by (owner 2026-10-05: they stay instant, and say "Guests see this right
 * away"). ON THE CONTROL'S OWN BLOCK, never inferred from the "Guests see this
 * right away" mark: that mark also sits beside forms with a Save of their own
 * (the parent add, the words blocks, the print menu), and typing a parent's name
 * there and pressing Skip would lose it with no question (review 2026-10-05).
 */
export const WRITES_LIVE_ATTR = 'data-writes-live';

type NodeLike = { parentElement?: NodeLike | null; hasAttribute?: (name: string) => boolean };

/**
 * Does this touch land on a control that writes live? Such a change is saved the
 * moment it is made, so it never makes the step "changed" — asking "Skip
 * anyway?" after it is the false warning the owner already rejected. True only
 * inside a block that opted in (`WRITES_LIVE_ATTR`) below the step's own root.
 */
export function writesLive(target: unknown, stepRoot: unknown): boolean {
  let el = target as NodeLike | null;
  while (el && el !== stepRoot) {
    if (typeof el.hasAttribute === 'function' && el.hasAttribute(WRITES_LIVE_ATTR)) return true;
    el = el.parentElement ?? null;
  }
  return false;
}

/** The couple's own change? (Never a tool's fill: untrusted events are not the couple.) */
export function isCouplesTouch(e: TouchEventLike): boolean {
  if (e.type === MAKER_TOUCH_EVENT) return true;
  if (!e.isTrusted) return false;
  const t = e.target as ElementLike | null;
  if (!t || typeof t !== 'object') return false;
  if (e.type === 'input' || e.type === 'change') return FIELD_TAGS.has(String(t.tagName ?? '').toUpperCase());
  if (e.type === 'click') return typeof t.closest === 'function' && Boolean(t.closest(CHOICE));
  return false;
}

/** How a touched field is remembered — by name (or id), so a remounted field is the same field. */
export function fieldKey(el: unknown): string | null {
  const t = el as ElementLike | null;
  if (!t) return null;
  const name = typeof t.name === 'string' && t.name ? t.name : null;
  const id = typeof t.id === 'string' && t.id ? t.id : null;
  return name ? `name:${name}` : id ? `id:${id}` : null;
}

/** One step's memory of what the couple changed on it. */
export type StepTouch = { any: boolean; fields: Set<unknown> };

export function newStepTouch(): StepTouch {
  return { any: false, fields: new Set() };
}

/** Note an event (already known to be inside the step) — a field by element AND by key. */
export function noteTouch(touch: StepTouch, e: TouchEventLike): void {
  if (!isCouplesTouch(e)) return;
  touch.any = true;
  if (e.type === 'input' || e.type === 'change') {
    touch.fields.add(e.target);
    const k = fieldKey(e.target);
    if (k) touch.fields.add(k);
  }
}

/**
 * The step's listener, whole: a touch at `origin` (already `touchOrigin`'d) is
 * noted only when it is inside the step (`scope`) and not on a control that
 * writes live. What the workspace runs on every input / change / click.
 */
export function noteStepTouch(touch: StepTouch, e: TouchEventLike, origin: unknown, scope: unknown | null): void {
  if (!scope || writesLive(origin, scope)) return;
  noteTouch(touch, e);
}

/** Was this field (or one with its name) changed by the couple on this step? */
export function fieldTouched(touch: StepTouch | ReadonlySet<unknown>, el: unknown): boolean {
  const fields = touch instanceof Set ? touch : (touch as StepTouch).fields;
  if (fields.has(el)) return true;
  const k = fieldKey(el);
  return k !== null && fields.has(k);
}

/**
 * Leaving a step — ask first?
 *   · a field still differs from what it was drawn with → "isn't saved yet", whatever the way out;
 *   · SKIP ("leave this for now") from a step the couple changed something on → "skip anyway?";
 *   · otherwise — opening, looking, or Next/Back after a saved change — never.
 */
export function leaveAsks(input: { via: 'skip' | 'next' | 'back' | 'pick'; unsaved: boolean; touched: boolean }): 'unsaved' | 'skip' | null {
  if (input.unsaved) return 'unsaved';
  if (input.via === 'skip' && input.touched) return 'skip';
  return null;
}
