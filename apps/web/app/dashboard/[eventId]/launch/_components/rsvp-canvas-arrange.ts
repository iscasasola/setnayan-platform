/**
 * 🧱 THE MAKER'S CANVAS, RE-ARRANGED AT THE TAP — the lines of a reply screen laid out as the couple's list says,
 * on the page the frame ALREADY drew (owner 2026-09-30: *"make sure what we rebuild is fast and realtime and changes
 * instantly"* — never a reload).
 *
 * The SERVER draws a saved list (`rsvp-lines.tsx`, for every guest). This does the same thing to the Maker's sample,
 * live: same list (`rsvpScreenLayout`, the one strict reader), same elements — the page's OWN line elements are
 * MOVED, never rebuilt (so a word being typed, a look, a Build in stay on them) — same classes for a line the couple
 * added and for a group (`rsvp-lines.tsx`'s own constants), same naming of the answers' group. That the two agree is
 * measured in a browser (the lab: the sample arranged live, then the same list drawn by the server, compared).
 *
 * It runs FROM THE MAKER, on the same-origin frame's document — loaded with the lazy RSVP stage, so nothing of it is
 * in a guest's page or in the Maker's first load. Safe to call again with the same list: nothing moves (a node that
 * is re-inserted plays its Build in again, so nothing is re-inserted that already stands where it should).
 *
 * 🔒 It never removes one of the page's own lines, and never creates a control: the two answers are the page's own
 * elements, moved inside the reply's one fieldset.
 */
import { RSVP_GROUP_ATTR, RSVP_SCREEN_LINES, rsvpLayoutIsGroup, rsvpScreenLayout, type RsvpLayoutItem, type RsvpLayoutLine, type RsvpLook, type RsvpLookCard } from '@/lib/rsvp-look';
import { rsvpGroupName } from '@/lib/rsvp-layout-edit';
import type { RsvpStageScene } from '@/lib/rsvp-stage';
import { RSVP_ADDED_CLASS, RSVP_ADDED_EMPTY_CLASS, RSVP_ADDED_NAME, RSVP_FORM_LINE_ID, RSVP_FORM_QUESTION_CLASS, RSVP_GROUP_CLASS, RSVP_NOTE_ADDED_CLASS } from '@/app/[slug]/_components/rsvp-lines';

/** The element that holds a screen's lines: the reply's fieldset · the note after a Yes · the note's card after a No. */
export function rsvpLinesBox(doc: Document, part: RsvpLookCard): HTMLElement | null {
  if (part === 'rsvp') return doc.querySelector<HTMLElement>('[data-rsvp-line="yes"]')?.closest('fieldset') ?? null;
  if (part === 'nonote') return doc.querySelector<HTMLElement>('[data-landing-missed]');
  return doc.querySelector<HTMLElement>('[data-landing="message"]');
}

/** A line's ROW: the piece of the box that moves with it — the line itself, or what the page wraps it in. */
export function rsvpLineRow(box: HTMLElement, name: string): HTMLElement | null {
  let el = box.querySelector<HTMLElement>(`[data-rsvp-line="${CSS.escape(name)}"]`);
  while (el?.parentElement && el.parentElement !== box && el.parentElement.tagName !== 'LEGEND' && !el.parentElement.hasAttribute(RSVP_GROUP_ATTR)) el = el.parentElement;
  return el;
}

/** The screen's card each of the stage's three screens draws — whose list of lines it lays out. */
export const RSVP_SCENE_PART: Record<RsvpStageScene, RsvpLookCard> = { form: 'rsvp', thanks: 'yesnote', decline: 'nonote' };

export type RsvpPageRow = { name: string; row: HTMLElement };
/**
 * A screen's TOP ROW as it stands on the page now: each line's row and each group's wrapper, in page order, by the
 * name the list knows it by. Only what HAS a place in the list — the Hint, a question's field and the rest of the
 * card are not in it (they cannot be moved, held or picked for a group).
 */
export function rsvpTopRows(box: HTMLElement, part: RsvpLookCard): RsvpPageRow[] {
  const out: RsvpPageRow[] = [];
  box.querySelectorAll<HTMLElement>(`[data-rsvp-line], [${RSVP_GROUP_ATTR}]`).forEach((el) => {
    const group = el.getAttribute(RSVP_GROUP_ATTR);
    if (group !== null) return void out.push({ name: rsvpGroupName(group), row: el });
    if (el.closest(`[${RSVP_GROUP_ATTR}]`)) return;
    const name = el.getAttribute('data-rsvp-line') ?? '';
    if (!(RSVP_SCREEN_LINES[part] as readonly string[]).includes(name) && !el.hasAttribute('data-rsvp-added')) return;
    const row = rsvpLineRow(box, name);
    if (row) out.push({ name, row });
  });
  return out;
}
/** The lines a group holds, as they stand in it. */
export function rsvpGroupRows(box: HTMLElement, wrap: HTMLElement): RsvpPageRow[] {
  const out: RsvpPageRow[] = [];
  wrap.querySelectorAll<HTMLElement>('[data-rsvp-line]').forEach((el) => {
    const name = el.getAttribute('data-rsvp-line') ?? '';
    const row = rsvpLineRow(box, name);
    if (row) out.push({ name, row });
  });
  return out;
}

const setClass = (el: Element, cls: string) => {
  if (el.getAttribute('class') !== cls) el.setAttribute('class', cls);
};
const setAttr = (el: Element, name: string, value: string | null) => {
  if (value === null) el.removeAttribute(name);
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
};
/** Put `want` in this order at the end of `parent` — only if that is not already how they stand. */
function inOrder(parent: Element, want: readonly Element[], managed: (el: Element) => boolean) {
  const now = Array.from(parent.children).filter(managed);
  if (now.length === want.length && now.every((el, i) => el === want[i])) return;
  for (const el of want) parent.appendChild(el);
}

export function arrangeRsvpScreen(doc: Document, part: RsvpLookCard, look: RsvpLook): boolean {
  const box = rsvpLinesBox(doc, part);
  if (!box) return false;
  const list = rsvpScreenLayout(look, part);
  const items: readonly RsvpLayoutItem[] = list ?? RSVP_SCREEN_LINES[part].map((line) => ({ line, added: null }));
  /* The page's own rows, found BEFORE anything moves. */
  const own = new Map<string, HTMLElement>();
  for (const name of RSVP_SCREEN_LINES[part]) {
    const row = rsvpLineRow(box, name);
    if (row) own.set(name, row);
  }
  const kept = new Set<Element>();
  const lineNode = (line: RsvpLayoutLine): HTMLElement | null => {
    if (!line.added) return own.get(line.line) ?? null;
    if (line.added.k === 'p') return null;
    const { k, t } = line.added;
    const p = box.querySelector<HTMLElement>(`p[data-rsvp-line="${CSS.escape(line.line)}"]`) ?? doc.createElement('p');
    setAttr(p, 'data-rsvp-line', line.line);
    setAttr(p, 'data-rsvp-added', k);
    setAttr(p, 'data-rsvp-empty', t ? null : '');
    setClass(p, `${RSVP_ADDED_CLASS[k]}${part === 'yesnote' ? ` ${RSVP_NOTE_ADDED_CLASS}` : ''}${t ? '' : ` ${RSVP_ADDED_EMPTY_CLASS}`}`);
    const words = t || RSVP_ADDED_NAME[k];
    if (p.textContent !== words) p.textContent = words;
    kept.add(p);
    return p;
  };

  /* ♿ THE FORM: Eyebrow then Question lead the card → they are its legend; otherwise the same two name the fieldset. */
  let rest = items;
  let legend = part === 'rsvp' ? box.querySelector<HTMLElement>(':scope > legend') : null;
  if (part === 'rsvp') {
    const [first, second] = items;
    const led = Boolean(first && second && !rsvpLayoutIsGroup(first) && !rsvpLayoutIsGroup(second) && first.line === 'eyebrow' && second.line === 'question');
    const eyebrow = own.get('eyebrow');
    const question = own.get('question');
    if (led && eyebrow && question) {
      if (!legend) {
        legend = doc.createElement('legend');
        legend.className = 'mb-3';
        box.insertBefore(legend, box.firstChild);
      }
      if (legend.children[0] !== eyebrow || legend.children[1] !== question) legend.append(eyebrow, question);
      rest = items.slice(2);
    }
    if (eyebrow) setAttr(eyebrow, 'id', led ? null : RSVP_FORM_LINE_ID.eyebrow);
    if (question) {
      setAttr(question, 'id', led ? null : RSVP_FORM_LINE_ID.question);
      setClass(question, led ? RSVP_FORM_QUESTION_CLASS.led : RSVP_FORM_QUESTION_CLASS.out);
    }
    setAttr(box, 'aria-labelledby', led ? null : `${RSVP_FORM_LINE_ID.eyebrow} ${RSVP_FORM_LINE_ID.question}`);
    if (led) kept.add(legend!);
  }
  /* After a No the card spaces its lines itself once they are arranged (`rsvp-note-lines.tsx`). */
  if (part === 'nonote') {
    box.classList.toggle('space-y-2', list !== null);
    own.get('message')?.classList.toggle('mt-2', list === null);
  }

  const want: HTMLElement[] = [];
  const groups = new Set<Element>();
  for (const item of rest) {
    if (!rsvpLayoutIsGroup(item)) {
      const node = lineNode(item);
      if (node) want.push(node);
      continue;
    }
    const id = item.group.id;
    const wrap = box.querySelector<HTMLElement>(`[${RSVP_GROUP_ATTR}="${CSS.escape(id)}"]`) ?? doc.createElement('div');
    setAttr(wrap, RSVP_GROUP_ATTR, id);
    setClass(wrap, RSVP_GROUP_CLASS);
    const kids = item.lines.map(lineNode).filter((n): n is HTMLElement => n !== null);
    inOrder(wrap, kids, () => true);
    groups.add(wrap);
    want.push(wrap);
  }
  /* What this manages in the box: every row but the legend it keeps. */
  inOrder(box, want, (el) => el !== legend || !kept.has(el));
  /* Gone from the list: a line the couple took off, a group they ungrouped (its lines were moved out above), and a
     legend that no longer leads. */
  box.querySelectorAll<HTMLElement>('p[data-rsvp-added]').forEach((p) => {
    if (!kept.has(p)) p.remove();
  });
  box.querySelectorAll<HTMLElement>(`[${RSVP_GROUP_ATTR}]`).forEach((g) => {
    if (!groups.has(g)) g.remove();
  });
  if (legend && !kept.has(legend)) legend.remove();
  return true;
}
