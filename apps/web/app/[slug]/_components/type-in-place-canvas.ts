/**
 * type-in-place-canvas.ts — ✍ TAP ANY TEXT, TYPE RIGHT THERE: the canvas half.
 *
 * Maker core part 2 (`prototypes/maker_in_four_2026-09-30_fable.html` frames
 * B · C · H; DECISION_LOG "THE MAKER RE-PLAN IS CUT TO ITS CORE" keeps *"tap
 * any text to type + Wording ▾ + Format ▾"*; owner 2026-09-30: *"I cannot edit
 * texts?"*). One tap on a hero part's words puts a caret IN them — where the
 * finger landed — and what is typed changes on the page at once, because the
 * page IS what is typed into: nothing is drawn twice, nothing is fetched,
 * nothing reloads. The Maker hears every keystroke (`type`) and does the
 * writing behind it (`type-in-place.tsx` — one write per pause, drafted); this
 * file never saves anything.
 *
 * Protocol (added to `editor-bridge.tsx`'s list, same origin rule):
 *   frame  → parent { source:'setnayan-site', t:'type', phase:'start'|'input'|'move'|'end',
 *                     key, el, text, rect, vw, caret, auto?, iso?, at?, title?, cancel? }
 *   parent → frame  { source:'setnayan-editor', t:'typeText', key, el, text }
 *   parent → frame  { source:'setnayan-editor', t:'typeStop' }
 *   parent → frame  { source:'setnayan-editor', t:'typeSync' }   (the bar loaded: say the words now)
 *   parent → frame  { source:'setnayan-editor', t:'typeHere', parts: SceneTypeWords[] }
 *   frame  → parent { source:'setnayan-site',   t:'typeHereFound', phase, found: ['<key>|<field>', …] }
 *
 * ✍ EVERY SCENE, NOT ONLY THE HERO. The hero's parts are typed in by name
 * (`typeablePart`). Another scene's parts carry no key of their own, so the
 * Maker says which WORDS each of its fields draws (`typeHere`, on every
 * `ready`); the part whose words are exactly those is marked `data-el-field`
 * and takes the caret on a tap (`sceneTypeField`). Words a style splits match
 * no part and are left alone — that scene keeps its box. The canvas answers
 * with what it found, so the Maker's box steps aside only where the caret
 * really reaches (one place per setting).
 *
 * 🔒 WORDS ONLY. The part becomes `contenteditable="plaintext-only"` (a browser
 * without it gets `true`, and a paste is taken as plain text), so nothing typed
 * or pasted can become markup; the Maker's sanitizer is still the gate
 * (`sanitizeHubElementWord`). Enter ends the line (every part is one line);
 * Esc puts the words back as they were when the tap began.
 *
 * Only in the Maker's canvas: it is reached from `EditorBridge`, which a guest
 * page never mounts.
 */
import { splitCoupleNames } from '@/lib/split-names';
import type { CanvasBringUp } from './canvas-bring-up';
import {
  HUB_TYPE_PARTS,
  SCENE_TYPE_ELS,
  SCENE_TYPE_MULTILINE,
  isSceneTypeField,
  isTypeCaretPart,
  type SceneTypeField,
  type SceneTypeWords,
} from '@/lib/hub-part-words';
import type { HubElementKey } from '@/lib/element-style';
import { findMakerSection } from './maker-section-find';

export type TypeRect = { top: number; left: number; width: number; height: number };

/** A hero part whose words the couple may type (the Maker decides what each writes). */
export function typeablePart(part: HTMLElement | null, key: string): HubElementKey | null {
  if (!part || key !== 'f:hero') return null;
  const el = part.getAttribute('data-el') as HubElementKey | null;
  return el && (HUB_TYPE_PARTS as readonly string[]).includes(el) ? el : null;
}

/**
 * The Maker's `typeHere` list, read on the canvas — dropped rather than
 * repaired, like every message the bridge reads: only scene keys, known fields,
 * strings, and a sane number of them.
 */
export function readSceneTypeWords(raw: unknown): SceneTypeWords[] {
  if (!Array.isArray(raw)) return [];
  const out: SceneTypeWords[] = [];
  for (const p of raw.slice(0, 64)) {
    const m = p as Record<string, unknown> | null;
    if (!m || typeof m.key !== 'string' || !m.key.startsWith('w:') || m.key.length > 64) continue;
    if (!isSceneTypeField(m.field) || typeof m.text !== 'string' || m.text.length > 4000) continue;
    out.push({ key: m.key, field: m.field, text: m.text });
  }
  return out;
}

/** ✍ A scene's part the Maker offered to type in (`markSceneWords`) — the field its words are. */
export function sceneTypeField(part: HTMLElement | null): SceneTypeField | null {
  const f = part?.getAttribute('data-el-field');
  return isSceneTypeField(f) ? f : null;
}

const flat = (t: string) => t.replace(/\s+/g, ' ').trim();

/**
 * ✍ MARK THE SCENE PARTS WHOSE WORDS ARE A FIELD'S — exactly, whole. Each
 * field is looked for in its own scene only, among the parts the bridge stamped
 * (`label` · `heading` · `body`) that belong to that scene and not to one inside
 * it. Words drawn split (or not drawn) match nothing. Returns `<key>|<field>`
 * for every field found.
 */
export function markSceneWords(doc: Document, parts: readonly SceneTypeWords[]): string[] {
  // The words being typed right now keep their mark — their letters are the couple's, mid-word.
  doc.querySelectorAll('[data-el-field]').forEach((n) => {
    if (!n.hasAttribute('contenteditable') && !n.querySelector('[contenteditable]')) n.removeAttribute('data-el-field');
  });
  const found: string[] = [];
  for (const p of parts) {
    const section = findMakerSection(doc, p.key);
    if (!section) continue;
    if (section.querySelector(`[data-el-field="${p.field}"]`)) {
      found.push(`${p.key}|${p.field}`);
      continue;
    }
    const want = flat(p.text);
    if (!want) continue;
    const hit = Array.from(section.querySelectorAll<HTMLElement>('[data-el]')).find(
      (n) =>
        SCENE_TYPE_ELS.includes(n.getAttribute('data-el') ?? '') &&
        !n.hasAttribute('data-el-field') &&
        !n.closest('[data-maker-look]') &&
        (n.closest('[data-setnayan-editor-bound="1"]') ?? section) === section &&
        flat(n.textContent ?? '') === want,
    );
    if (!hit) continue;
    hit.setAttribute('data-el-field', p.field);
    found.push(`${p.key}|${p.field}`);
  }
  return found;
}

/**
 * THE ELEMENT THE WORDS ARE IN — the caret goes there, and only there.
 *   · a part that marks its words (`[data-el-words]` — the link, whose ↓ stays);
 *   · else the part's one child that holds words (the date's line between its two
 *     rules), or the part itself.
 * A styled letter (`[data-el-run]`) is words, never a target of its own.
 */
export function typeTargetOf(part: HTMLElement, hit?: Element | null): HTMLElement {
  // ✍ The names: the caret goes in the ONE person tapped (the joiner between
  // them is its own part), else the first.
  const people = peopleOf(part);
  if (people.length > 0) {
    const tapped = hit?.closest?.<HTMLElement>('[data-el-person]');
    return tapped && people.includes(tapped) ? tapped : people[0]!;
  }
  const marked = part.querySelector<HTMLElement>('[data-el-words]');
  if (marked) return marked;
  let at: HTMLElement = part;
  for (;;) {
    const kids = Array.from(at.children).filter(
      (c): c is HTMLElement => !c.hasAttribute('data-el-run') && c.getAttribute('aria-hidden') !== 'true' && (c.textContent ?? '').trim().length > 0,
    );
    const ownText = Array.from(at.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
    if (kids.length !== 1 || ownText) return at;
    at = kids[0]!;
  }
}

/** Each person's name in the names part (`[data-el-person]`, stamped by the masthead in the Maker only). */
function peopleOf(part: HTMLElement): HTMLElement[] {
  /* The part's own lines — never the pair kept inside the canvas's template (`layNames`). */
  return Array.from(part.querySelectorAll<HTMLElement>('[data-el-person]')).filter((p) => !p.closest('template'));
}

const words = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * What the part says now. The names say BOTH people, joined the way the page
 * splits them (" & ", `splitCoupleNames`) — what `events.display_name` holds.
 * A scene's words of several lines keep their lines (the page draws them
 * `whitespace-pre-line`): read as the browser lays them out (`innerText`).
 */
export function partWords(part: HTMLElement): string {
  const people = peopleOf(part);
  if (people.length > 0) return people.map(words).filter(Boolean).join(' & ');
  const target = typeTargetOf(part);
  if (SCENE_TYPE_MULTILINE.includes(part.getAttribute('data-el-field') ?? '')) {
    const raw = typeof target.innerText === 'string' ? target.innerText : (target.textContent ?? '');
    return raw.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  }
  return words(target);
}

/** Put the part's words back, or new ones in (a Wording ▾ or Format ▾ pick, a refused save). */
export function setPartWords(part: HTMLElement, text: string): void {
  if (layNames(part, text)) return;
  (peopleOf(part)[0] ?? typeTargetOf(part)).textContent = text;
}

/* ── the names, drawn as the page draws them ─────────────────────────────────────────────────────────────────── */

const kids = (part: HTMLElement) => Array.from(part.children) as HTMLElement[];
const personAt = (part: HTMLElement, i: 0 | 1) => kids(part).find((c) => c.getAttribute('data-el-person') === String(i)) ?? null;
const joinerIn = (part: HTMLElement) => kids(part).find((c) => c.getAttribute('data-el') === 'joiner') ?? null;
const twoNamesOf = (part: HTMLElement) =>
  (kids(part).find((c) => c.tagName === 'TEMPLATE' && c.hasAttribute('data-el-names-two')) as HTMLTemplateElement | undefined) ?? null;

/** The joiner and the second line a cover put away for one name — the SAME elements come back (their look with them). */
const PUT_AWAY = new WeakMap<HTMLElement, { joiner: HTMLElement | null; second: HTMLElement }>();

/** A new joiner and second line, as the masthead draws them for this design (`<template data-el-names-two>`). */
function freshPair(tpl: HTMLTemplateElement | null): { joiner: HTMLElement | null; second: HTMLElement } | null {
  if (!tpl) return null;
  /* A template the server sent keeps its elements in `content`; one React drew in the browser keeps them as children. */
  const inside = tpl.content && tpl.content.children.length > 0 ? tpl.content.children : tpl.children;
  const made = Array.from(inside).map((c) => c.cloneNode(true) as HTMLElement);
  const second = made.find((c) => c.getAttribute('data-el-person') === '1');
  return second ? { joiner: made.find((c) => c.getAttribute('data-el') === 'joiner') ?? null, second } : null;
}

/**
 * ✍ THE NAMES ON THE CANVAS ARE THE NAMES THE PAGE WOULD DRAW — for the line typed, at once (owner 2026-10-11).
 *
 * Twice the canvas drew a name line its own way. One name typed into a two-name cover left the joiner standing over
 * nothing ("TEsting Event / and / (blank)"). Then two names typed into a cover drawn for ONE were a single plain line
 * ("Bolognese &" / "Pasta" — "it did not make the secondary font"): the page had no joiner and no second line to
 * write into. And "Ana and Ben" kept the old joiner's word.
 *
 * So the line is split by the page's own rule (`splitCoupleNames`) and laid out with the page's own elements:
 *   · one name  → the first person's line alone; the joiner and the second line are taken OFF the page (kept, to come
 *                 back as they were), exactly as the masthead draws no joiner without a second name;
 *   · two names → first · joiner · second; when the cover was drawn for one name they are made from the masthead's
 *                 own template, so the joiner is the masthead's element, in its own face;
 *   · the joiner's WORD is the page's: the couple's own when they chose one, else what the line gives — "and", or
 *     "&" as this cover writes it (`data-amp`: the card says "and").
 * Returns false for a part that is not the names of two people (one person at the centre: one line, as typed).
 *
 * Held for every design × cover by `lib/a-joiner-never-stands-over-nothing.test.ts`: the canvas after each line
 * equals the server's render of that line. ⚠ A joiner word the couple chose that IS the automatic one cannot be told
 * from it here, and is treated as automatic. Letters styled one by one (`data-el-run`) are plain until the next
 * render, as before.
 */
export function layNames(part: HTMLElement, text: string): boolean {
  const first = personAt(part, 0);
  const tpl = twoNamesOf(part);
  let second = personAt(part, 1);
  if (!first || (!second && !tpl && !PUT_AWAY.has(part))) return false;
  const names = splitCoupleNames(text, true);
  let joiner = joinerIn(part);
  if (!names.second) {
    first.textContent = names.first;
    if (second) {
      PUT_AWAY.set(part, { joiner, second });
      joiner?.remove();
      second.remove();
    }
    return true;
  }
  if (!second) {
    const pair = PUT_AWAY.get(part) ?? freshPair(tpl);
    if (!pair) return false;
    PUT_AWAY.delete(part);
    ({ joiner, second } = pair);
    if (joiner) first.after(joiner, second);
    else first.after(second);
  }
  first.textContent = names.first;
  second.textContent = names.second;
  if (joiner) {
    const auto = names.joiner === '&' ? (tpl?.getAttribute('data-amp') ?? '&') : (names.joiner ?? '');
    /* The couple's own word is one that is not the automatic word this joiner was last drawn with. */
    const said = words(joiner);
    const own = said !== '' && said !== (joiner.getAttribute('data-el-word') ?? '') ? said : null;
    joiner.textContent = own ?? auto;
    joiner.setAttribute('data-el-word', auto);
  }
  return true;
}

/**
 * 🔗 TYPED ON THE PAGE ITSELF (a caret in one person's line): when the typing ends, the names are laid out as the
 * page would draw what they now say — a second name erased leaves no joiner behind; two names typed into one line
 * become two. Names that already read one per line are not touched (their joiner keeps the word it was drawn with).
 */
export function tidyNames(part: HTMLElement): void {
  const said = kids(part).filter((c) => c.hasAttribute('data-el-person')).map(words);
  if (said.length === 0) return;
  const named = said.filter(Boolean);
  const asDrawn = named.length === said.length && said.every((w) => splitCoupleNames(w, true).second === null);
  if (!asDrawn) layNames(part, named.join(' & '));
}

function rectOf(el: HTMLElement): TypeRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** The caret where the finger landed — or at the end of the words when the point is not in them. */
function placeCaret(doc: Document, target: HTMLElement, x: number, y: number): void {
  const sel = doc.getSelection();
  if (!sel) return;
  type CaretDoc = Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  const d = doc as CaretDoc;
  let range: Range | null = null;
  if (typeof d.caretRangeFromPoint === 'function') range = d.caretRangeFromPoint(x, y);
  else if (typeof d.caretPositionFromPoint === 'function') {
    const p = d.caretPositionFromPoint(x, y);
    if (p) {
      range = doc.createRange();
      range.setStart(p.offsetNode, p.offset);
    }
  }
  if (!range || !target.contains(range.startContainer)) {
    range = doc.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

export type CanvasTyping = {
  /** Is a tap inside the words being typed now? (the bridge then lets it move the caret) */
  inside: (target: EventTarget | null) => boolean;
  typing: () => boolean;
  begin: (part: HTMLElement, key: string, el: HubElementKey, at: { x: number; y: number }) => void;
  stop: () => void;
  /** Say the words as they are now (the Maker's bar has just loaded). */
  sync: () => void;
  /** The Maker's words for a part (a pick, a revert) — on the page now. A scene's part is found by its `field`. */
  set: (section: HTMLElement | null, el: string, text: string, field?: string | null) => void;
  dispose: () => void;
};

export function createCanvasTyping(
  win: Window,
  post: (message: Record<string, unknown>) => void,
  /** 📱 The bring-up (`canvas-bring-up.ts`) — shared with the bridge's own taps; its way back is the Maker's `settle`. */
  lift?: Pick<CanvasBringUp, 'up'>,
): CanvasTyping {
  const doc = win.document;
  let session: {
    part: HTMLElement;
    target: HTMLElement;
    key: string;
    el: HubElementKey;
    before: string;
    off: () => void;
  } | null = null;

  const send = (phase: string, extra: Record<string, unknown> = {}) => {
    if (!session) return;
    post({
      source: 'setnayan-site',
      t: 'type',
      phase,
      key: session.key,
      el: session.el,
      text: partWords(session.part),
      rect: rectOf(session.part),
      vw: win.innerWidth,
      ...extra,
    });
  };

  const end = (cancel: boolean) => {
    const s = session;
    if (!s) return;
    if (cancel) setPartWords(s.part, s.before);
    /* 🔗 Typed on the page itself: a second name typed away leaves no joiner behind (`tidyNames`). */
    else if (s.el === 'names') tidyNames(s.part);
    send('end', cancel ? { cancel: true } : {});
    s.off();
    s.target.removeAttribute('contenteditable');
    session = null;
    /* 📱 NO way back here: the end of typing is not the end of the edit — the
       Maker's type bar stays open, and Style ▾ hands the part to its sheet. The
       Maker says when the LAST surface closes (`settle`, `canvas-bring-up.ts`). */
  };

  return {
    inside: (t) => Boolean(session && t instanceof Node && session.target.contains(t)),
    typing: () => session !== null,
    begin(part, key, el, at) {
      if (session) end(false);
      const target = typeTargetOf(part, doc.elementFromPoint(at.x, at.y));
      // ✍ A scene's words (`markSceneWords`): a caret always; several lines take Enter as a new line.
      const field = sceneTypeField(part);
      const caret = field !== null || isTypeCaretPart(el);
      const lines = field !== null && SCENE_TYPE_MULTILINE.includes(field);
      const before = partWords(part);
      const onInput = () => send('input');
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !lines) {
          e.preventDefault();
          target.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          end(true);
        }
      };
      const onPaste = (e: ClipboardEvent) => {
        e.preventDefault();
        const raw = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n');
        const text = lines ? raw.replace(/[ \t]+/g, ' ') : raw.replace(/\s+/g, ' ');
        doc.execCommand('insertText', false, text);
      };
      const onBlur = () => end(false);
      let raf = 0;
      const onScroll = () => {
        if (raf) return;
        raf = win.requestAnimationFrame(() => {
          raf = 0;
          send('move');
        });
      };
      if (caret) {
        target.setAttribute('contenteditable', 'plaintext-only');
        if (target.contentEditable !== 'plaintext-only') target.setAttribute('contenteditable', 'true');
        target.addEventListener('input', onInput);
        target.addEventListener('keydown', onKey);
        target.addEventListener('paste', onPaste);
        target.addEventListener('blur', onBlur);
      }
      win.addEventListener('scroll', onScroll, { passive: true });
      win.addEventListener('resize', onScroll);
      session = {
        part,
        target,
        key,
        el,
        before,
        off: () => {
          target.removeEventListener('input', onInput);
          target.removeEventListener('keydown', onKey);
          target.removeEventListener('paste', onPaste);
          target.removeEventListener('blur', onBlur);
          win.removeEventListener('scroll', onScroll);
          win.removeEventListener('resize', onScroll);
          if (raf) win.cancelAnimationFrame(raf);
        },
      };
      if (caret) {
        // In the tap itself — a phone raises its keyboard only for a focus made in the gesture.
        target.focus({ preventScroll: true });
        placeCaret(doc, target, at.x, at.y);
      }
      // 📱 Above the keyboard: on a phone the part is brought up the page — with
      // room above it, and the way back kept for when the typing ends.
      try {
        lift?.up(part);
      } catch {
        /* the part stays where it was tapped */
      }
      send('start', {
        auto: part.getAttribute('data-el-word') ?? target.getAttribute('data-el-word') ?? undefined,
        iso: part.getAttribute('data-el-iso') ?? undefined,
        at: part.getAttribute('data-el-at') ?? undefined,
        title: part.getAttribute('data-el-title') ?? undefined,
        caret,
        ...(field ? { field } : {}),
      });
    },
    stop: () => {
      if (!session) return;
      if (session.target === doc.activeElement) session.target.blur();
      else end(false);
    },
    sync: () => send('input'),
    set(section, el, text, field) {
      const part =
        session && session.el === el && (!section || section.contains(session.part))
          ? session.part
          : field
            ? (section?.querySelector<HTMLElement>(`[data-el-field="${field}"]`) ?? null)
            : (section?.querySelector<HTMLElement>(`[data-el="${el}"]`) ?? null);
      if (!part) return;
      setPartWords(part, text);
      if (session && session.part === part && session.target === doc.activeElement) {
        // The caret stays in the words, at their end.
        placeCaret(doc, session.target, -1, -1);
      }
    },
    dispose: () => end(false),
  };
}
