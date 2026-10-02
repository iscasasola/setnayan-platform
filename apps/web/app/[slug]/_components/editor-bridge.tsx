'use client';

import { LOVE_STORY_PREVIEW_T as LOVE_STORY_PREVIEW, SCHEDULE_PREVIEW_T as SCHEDULE_PREVIEW, applyLoveStoryPreview, applySchedulePreview } from '@/lib/maker-live-preview-apply';
import { useEffect } from 'react';
import {
  HUB_ELEMENT_EXCLUDED_WIDGETS,
  HUB_ELEMENT_FIELDS,
  HUB_ELEMENT_LOOK_PROPS,
  HUB_ELEMENT_MOTION_PROPS,
  HUB_ELEMENT_RUN_KEYS,
  HUB_HERO_ELEMENT_KEYS,
  HUB_SCENE_ELEMENT_KEYS,
  HUB_SCENE_ELEMENT_SELECTOR,
  hubElementDeclarations,
  hubElementHeroMotionVars,
  hubElementSceneCss,
  hubSceneRunsAttr,
  hubTextHash,
  isHubElementKey,
  readHubSceneRuns,
  sanitizeHubElements,
  type HubElementKey,
  type HubElementStyle,
  type HubElementStyles,
} from '@/lib/element-style';
import { postEventElementScope } from '@/lib/post-event-styles';
import { findMakerSection, sectionAfter } from './maker-section-find';
import { applySceneBgPreview, sanitizeSceneBgPreview } from './scene-bg-preview';
import { applyPartRuns, applySceneRuns, type RunsDoc } from './part-runs';
import { applySceneCardPreview } from '@/lib/scene-card-look';
import { createCanvasTyping, markSceneWords, readSceneTypeWords, sceneTypeField, typeablePart } from './type-in-place-canvas';

/**
 * EditorBridge — the guest site's half of the unified-editor two-way sync
 * (Unified Website Editor · design 2026-07-25 · PR-1).
 *
 * Mounts ONLY in the Maker's canvas: `?editor=1` AND a server-verified host
 * membership (`isEditorCanvas && editorBridge`, app/[slug]/page.tsx). For guests
 * and anonymous visitors this component never renders, so their HTML is
 * unchanged byte-for-byte.
 *
 * Protocol (both directions verify `event.origin === window.location.origin`;
 * the editor iframe is same-origin by construction):
 *   parent → frame  { source:'setnayan-editor', t:'scrollTo', key }
 *   parent → frame  { source:'setnayan-editor', t:'play',     key }
 *   parent → frame  { source:'setnayan-editor', t:'markEl',   key, el }
 *   frame  → parent { source:'setnayan-site',   t:'edit',     key, el?, moment? }
 *   frame  → parent { source:'setnayan-site',   t:'select',   key, el, start, end, of, text, whole }
 *   parent → frame  { source:'setnayan-editor', t:'playEl',   key, el }
 *   parent → frame  { source:'setnayan-editor', t:'words',    key, text }
 *   parent → frame  { source:'setnayan-editor', t:'elStyle',  key, el, elements, motion, replay }
 *   parent → frame  { source:'setnayan-editor', t:'sceneBg',  scenes:[{ key, classes, vars }] }
 *   parent → frame  { source:'setnayan-editor', t:'sceneShow', key, shown }
 *   frame  → parent { source:'setnayan-site',   t:'ready',    order, bar }
 *   frame  ⇄ parent  t:'type' · 'typeText' · 'typeStop' · 'typeSync' · 'typeHere' — ✍ tap-to-type
 *                    (`type-in-place-canvas.ts` has the whole protocol)
 *
 * ✍ `words` IS THE SCENE'S TEXT, LIVE (owner 2026-09-27, writing his own
 * message: *"needs to show on the scene editor"*). The Content box of a scene
 * whose words are ONE text (the Special message, a Letter, What to bring)
 * posts what is in it on every keystroke, and the canvas shows it at once, in
 * the scene's own look (`previewSceneWords`). Nothing is saved by it; Save puts
 * the words in the draft. An `edit` tap on an empty scene says `empty: true`.
 *
 * ⚡ `elStyle` IS THE INSTANT PREVIEW (owner 2026-09-27, editing his own page:
 * *"changing size does nothing"* · *"the toolbars are not working"*). The
 * element sheet posts it on every choice BEFORE the draft save, and this canvas
 * lays the choice on the part at once — through the SAME functions the guest
 * page renders with (`hubElementDeclarations` for a hero part's inline style,
 * `hubTextSegments` + `hubRunDeclarations` for its runs, `hubElementSceneCss`
 * for a scene's scoped `<style>`), never a second mapping. The save then lands
 * without reloading this frame (the canvas hold, `element-preview.ts`); a save
 * that fails is answered by a second `elStyle` carrying the last saved style.
 *
 * 🧭 `bar` is the stage's Event Bar exactly as the page resolved it for this
 * canvas (`data-maker-bar`, stamped by `site-body.tsx` from the SAME value the
 * guest tab bar is drawn from). The Maker's navigator shows it as its tabs —
 * it never builds a menu of its own.
 *
 * 🧭 KEYS. The navigator's keys (`lib/maker-scene-list.ts`): `f:hero`,
 * `f:film`, `f:editorial`, `f:entourage`, `f:story` and `w:<widget_type>`.
 * `site-body.tsx` stamps a hidden `[data-maker-section]` marker immediately
 * before each section in the canvas; the section is the marker's next element
 * sibling. The entourage and the story already carry their own ids. The
 * legacy row keys (`home`, `details`, `story`, …) still resolve through
 * `SECTION_IDS` for the rows that name them.
 *
 * 🔤 ELEMENTS (owner 2026-09-26/27: *"tapping element, changes fonts, color,
 * size, animation"*). A tap ON a part — the hero's names, a scene's heading —
 * sends `el` beside `key`, and the Maker opens that element's sheet; a tap on
 * the scene's empty space sends `key` alone, exactly as before. The hero's
 * parts carry `data-el` from the server (`PahinaMasthead stampElements`, canvas
 * only); a scene's label / heading / words are stamped HERE, at mount, by the
 * one selector list the guest page's style uses (`lib/element-style.ts`) — so
 * what the couple taps is exactly what guests see restyled, and no widget and
 * no guest's markup carries a key. ⛔ Never inside the RSVP form.
 */

/* 📦 `findMakerSection` and `sectionAfter` live in `./maker-section-find` — the
   Maker imports that small module, never this bridge, so the bridge stays in the
   guest page's code (see that file). Re-exported here for the bridge's callers. */
export { findMakerSection } from './maker-section-find';

/** The stage's Event Bar as this canvas drew it, or null when the page carries none. */
export function readMakerBar(doc: Document): unknown[] | null {
  const raw = doc.querySelector('[data-maker-bar]')?.getAttribute('data-maker-bar');
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Every section the canvas actually DREW, in page order — the navigator must equal this. */
export function drawnMakerOrder(doc: Document): string[] {
  const keys: string[] = [];
  const nodes = doc.querySelectorAll('[data-maker-section], #site-entourage, #site-story');
  nodes.forEach((n) => {
    if (n.hasAttribute('data-maker-section')) {
      const el = sectionAfter(n);
      if (el && el.getBoundingClientRect().height > 0) keys.push(n.getAttribute('data-maker-section')!);
    } else if (n.id === 'site-entourage' && (n as HTMLElement).offsetHeight > 0) {
      keys.push('f:entourage');
    } else if (n.id === 'site-story' && (n as HTMLElement).offsetHeight > 0) {
      keys.push('f:story');
    }
  });
  return keys;
}

/**
 * Stamp `data-el` on a scene's parts — its label, heading and words — by the
 * one selector list the guest style uses. A part already stamped keeps its key.
 */
export function stampSceneElements(section: HTMLElement, key: string): number {
  /* 🎞 A Post Event scene drawn in its style (`data-post-event-look`) has the
     same three parts; a shipped Post Event block not yet in a style has none. */
  const postEvent = key.startsWith('p:') && section.hasAttribute('data-post-event-look');
  if (!key.startsWith('w:') && !postEvent) return 0;
  if (!postEvent && HUB_ELEMENT_EXCLUDED_WIDGETS.includes(key.slice(2))) return 0;
  let n = 0;
  for (const el of HUB_SCENE_ELEMENT_KEYS) {
    section.querySelectorAll<HTMLElement>(HUB_SCENE_ELEMENT_SELECTOR[el]).forEach((node) => {
      if (node.hasAttribute('data-el')) return;
      node.setAttribute('data-el', el);
      n += 1;
    });
  }
  return n;
}

/** The part a tap landed on, when it belongs to THIS section (not a nested one). */
export function tappedElement(target: EventTarget | null, section: HTMLElement): HTMLElement | null {
  const part = (target as Element | null)?.closest?.('[data-el]') as HTMLElement | null;
  if (!part || !section.contains(part)) return null;
  const owner = part.closest('[data-setnayan-editor-bound="1"]');
  return owner === section ? part : null;
}

/**
 * ✍ THE SELECTION INSIDE ONE PART, AS OFFSETS INTO ITS TEXT (owner 2026-09-27:
 * *"they can take 1 letter and change the font"*). Both ends must sit inside
 * the same `data-el` part whose text can carry runs (every part with words —
 * the hero's and a scene's); the offsets are counted in that part's
 * `textContent`, the SAME string the guest page cuts its spans from, and `of`
 * fingerprints it so a run can never land on different letters after the text
 * changes. `whole` is that text itself: with it, the part's older runs are
 * ADAPTED onto the words drawn now when the choice is saved (`withRunChoice`).
 * Null when there is no such selection — the choice then styles the whole part.
 */
export function selectionInPart(
  sel: Selection | null,
): { part: HTMLElement; el: HubElementKey; start: number; end: number; of: string; text: string; whole: string } | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const startEl = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement) as Element | null;
  const part = startEl?.closest?.('[data-el]') as HTMLElement | null;
  if (!part || !part.contains(range.endContainer)) return null;
  const el = part.getAttribute('data-el') as HubElementKey;
  if (!HUB_ELEMENT_RUN_KEYS.includes(el)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(part);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const text = range.toString();
  if (text.length === 0) return null;
  const whole = part.textContent ?? '';
  return { part, el, start, end: start + text.length, of: hubTextHash(whole), text, whole };
}

/**
 * ✍ THE TEXT A SCENE'S WORDS ARE DRAWN IN. An empty scene in the Maker
 * (`MakerEmptyScene`) carries the scene's real look, hidden (`data-maker-look`);
 * otherwise the scene's own words: a template's text (`.hub-tpl-p`, never its
 * signature) or its first body part.
 */
export function sceneWordsTarget(section: Element): { look: HTMLElement | null; text: HTMLElement | null } {
  const look = section.querySelector<HTMLElement>('[data-maker-look]');
  const scope: Element = look ?? section;
  const text =
    scope.querySelector<HTMLElement>('.hub-tpl-p') ??
    scope.querySelector<HTMLElement>('[data-el="body"]') ??
    scope.querySelector<HTMLElement>(HUB_SCENE_ELEMENT_SELECTOR.body);
  return { look, text };
}

/**
 * ✍ SHOW `text` AS THE SCENE'S WORDS, NOW. An empty scene swaps its "write your
 * message" prompt for the real look carrying the text (blank → the prompt
 * again); a written scene has its words replaced. Returns false when the scene
 * draws no words to replace (the refresh after Save then shows them).
 */
export function previewSceneWords(section: Element, text: string): boolean {
  const { look, text: target } = sceneWordsTarget(section);
  if (look) {
    /* `display` as well as `hidden`: the prompt's eyebrow is a flex row, and a
       class's `display` outranks the `hidden` attribute. */
    const blank = text.trim().length === 0;
    look.hidden = blank;
    look.style.display = blank ? 'none' : '';
    section.querySelectorAll<HTMLElement>('[data-maker-empty-prompt]').forEach((p) => {
      p.hidden = !blank;
      p.style.display = blank ? '' : 'none';
    });
  }
  if (!target) return false;
  target.textContent = text;
  return true;
}

/* ── ⚡ THE INSTANT PREVIEW — one choice laid on the canvas, no reload ──── */

/** The part of the DOM the preview writes through — a real document, or a test's. */
type PreviewDoc = RunsDoc;

const LOOK_PROPS: readonly string[] = HUB_ELEMENT_LOOK_PROPS;

/**
 * A HERO PART'S OWN LOOK, laid inline exactly as `PahinaMasthead` writes it
 * (`hubElementInlineStyle` is these same declarations, camel-cased). The look
 * (font · colour · size) is always re-laid; the motion only when it changed
 * (`motion`), because writing an animation again restarts it and a font change
 * must not replay the entrance. `animation-name` goes with the motion because
 * ▶ Play leaves its `-p` twin inline.
 */
export function applyHeroPartStyle(part: HTMLElement, style: HubElementStyle | null | undefined, motion: boolean): void {
  const clear: string[] = [...LOOK_PROPS];
  if (motion) clear.push(...HUB_ELEMENT_MOTION_PROPS, 'animation-name');
  for (const p of clear) part.style.removeProperty(p);
  // The Maker's canvas: a hidden part is ghosted, never gone (as the server
  // draws it with `stampElements`).
  for (const [p, v] of hubElementDeclarations(style, { editor: true })) part.style.setProperty(p, v);
  if (!motion) return;
  /* The motion as the guest page carries it: three custom properties and the
     `data-el-motion` hook the one gated rule in globals.css reads. */
  const vars = hubElementHeroMotionVars(style);
  for (const [p, v] of vars) part.style.setProperty(p, v);
  if (vars.length > 0) part.setAttribute('data-el-motion', '');
  else part.removeAttribute('data-el-motion');
}

/**
 * 🔗 A PART'S OWN WORDS, on the canvas now — the joiner's word, or the link's
 * line. The words sit on the part itself (the joiner) or on its
 * `[data-el-words]` child (the link, whose ↓ must stay). The words the page
 * drew first are kept there (`data-el-word`), so taking the couple's words off
 * puts them back.
 */
export function applyPartWords(part: HTMLElement, word: string | null | undefined): void {
  const target = part.querySelector<HTMLElement>('[data-el-words]') ?? part;
  if (!target.hasAttribute('data-el-word')) target.setAttribute('data-el-word', target.textContent ?? '');
  target.textContent = word ?? target.getAttribute('data-el-word') ?? '';
}

/**
 * ✍ A HERO PART'S RUNS, re-cut in place — `applyPartRuns` (`part-runs.ts`), the
 * one cutter every part's runs go through, on the canvas and on the guest page.
 */
export function applyHeroPartRuns(part: HTMLElement, style: HubElementStyle | null | undefined, doc: PreviewDoc): void {
  applyPartRuns(part, style, doc);
}

/** The scene's own `<style data-hub-els>` — after the scene, before the next scene's marker. */
function sceneStyleOf(section: Element, widgetType: string): HTMLStyleElement | null {
  for (let n = section.nextElementSibling; n && !n.hasAttribute('data-maker-section'); n = n.nextElementSibling) {
    if (n.tagName === 'STYLE' && n.getAttribute('data-hub-els') === widgetType) return n as HTMLStyleElement;
  }
  return null;
}

/**
 * A SCENE'S PARTS, restyled by re-writing its scoped `<style>` with the text
 * `HubCanvasFrame` renders (`hubElementSceneCss`). A scene nobody styled yet
 * has no such tag, so one is placed straight after the scene — where the frame
 * puts it — because the rules address the scene as `:has(+ style[…])`.
 */
export function applySceneElementStyles(
  section: HTMLElement,
  widgetType: string,
  elements: HubElementStyles | null,
  doc: PreviewDoc,
): HTMLStyleElement | null {
  if (HUB_ELEMENT_EXCLUDED_WIDGETS.includes(widgetType)) return null;
  const css = hubElementSceneCss(widgetType, elements) ?? '';
  // ✍ The scene's runs ride on the same tag, as the frame renders them.
  const runs = hubSceneRunsAttr(elements);
  let tag = sceneStyleOf(section, widgetType);
  if (!tag) {
    if (!css && !runs) return null;
    tag = doc.createElement('style');
    tag.hidden = true;
    tag.setAttribute('data-hub-els', widgetType);
    section.parentNode?.insertBefore(tag, section.nextSibling);
  }
  tag.textContent = css;
  if (runs) tag.setAttribute('data-hub-runs', runs);
  else tag.removeAttribute('data-hub-runs');
  return tag;
}

/**
 * ONE ELEMENT'S CHOICE, ON THE CANVAS NOW. `key` is the navigator key the sheet
 * was opened from (`f:hero`, `w:<type>`); `motion` says whether the element's
 * motion changed (only then is its animation re-laid). Returns the parts it
 * touched, so the caller can replay their In.
 */
export function applyElementPreview(
  section: HTMLElement,
  key: string,
  el: HubElementKey,
  elements: HubElementStyles | null,
  motion: boolean,
  doc: PreviewDoc,
): HTMLElement[] {
  const parts = Array.from(section.querySelectorAll<HTMLElement>(`[data-el="${el}"]`));
  if ((HUB_HERO_ELEMENT_KEYS as readonly string[]).includes(el)) {
    /* The hero's alignment is ONE choice for every part (`withElementAlign`), and
       "↺ Use the Event Hub style" takes it off every part — so every hero part's
       LOOK is re-laid (cheap, idempotent); the motion only on the part that
       changed, so no other part's entrance replays. */
    for (const k of HUB_HERO_ELEMENT_KEYS) {
      if (k === el) continue;
      for (const other of section.querySelectorAll<HTMLElement>(`[data-el="${k}"]`)) applyHeroPartStyle(other, elements?.[k], false);
    }
    for (const part of parts) {
      applyHeroPartStyle(part, elements?.[el], motion);
      if (HUB_ELEMENT_FIELDS[el].includes('word')) applyPartWords(part, elements?.[el]?.word);
      if (HUB_ELEMENT_RUN_KEYS.includes(el)) applyHeroPartRuns(part, elements?.[el], doc);
    }
    return parts;
  }
  // 🎞 A Post Event scene's parts are scoped `pe_<scene>` (`postEventElementScope`).
  const scope = key.startsWith('w:')
    ? key.slice(2)
    : key.startsWith('p:') && section.hasAttribute('data-post-event-look')
      ? postEventElementScope(section.getAttribute('data-post-event-look')!)
      : null;
  if (!scope) return [];
  // A ▶ Play leaves an inline `-p` twin that would outrank the new motion.
  if (motion) for (const part of parts) part.style.removeProperty('animation-name');
  applySceneElementStyles(section, scope, elements, doc);
  // ✍ …and its runs, cut into the part they were made on (`applySceneRuns`).
  if (key.startsWith('w:') && !HUB_ELEMENT_EXCLUDED_WIDGETS.includes(scope)) applySceneRuns(section, elements, doc);
  return parts;
}

/**
 * ▶ REPLAY ONE PART'S IN, with the editing furniture hidden. A CSS animation
 * restarts only when its NAME changes, so the In keyframe is swapped for its
 * `-p` twin (and back on the next Play); a part that follows the scroll plays
 * on the clock for this one replay. False when the part has no In to play.
 */
export function replayElementIn(part: HTMLElement): boolean {
  const names = getComputedStyle(part).animationName.split(',').map((n) => n.trim());
  const i = names.findIndex((n) => n.startsWith('el-in-'));
  if (i < 0) return false;
  names[i] = names[i]!.endsWith('-p') ? names[i]!.slice(0, -2) : `${names[i]}-p`;
  const prevOutline = part.style.outline;
  part.style.outline = 'none';
  part.scrollIntoView({ behavior: 'auto', block: 'center' });
  const timelines = getComputedStyle(part).getPropertyValue('animation-timeline');
  if (timelines && timelines.includes('view')) {
    part.style.setProperty('animation-timeline', timelines.split(',').map(() => 'auto').join(', '));
  }
  part.style.animationName = names.join(', ');
  window.setTimeout(() => {
    part.style.outline = prevOutline;
    part.style.removeProperty('animation-timeline');
  }, 2200);
  return true;
}

let marked: HTMLElement | null = null;
/** Outline the element being edited, until another is chosen. */
function mark(el: HTMLElement | null) {
  if (marked && marked !== el) marked.style.outline = '';
  marked = el;
  if (el) {
    el.style.outline = '2px solid rgba(168,128,47,.85)';
    el.style.outlineOffset = '3px';
  }
}

function flash(el: HTMLElement) {
  const prior = el.style.boxShadow;
  el.style.boxShadow = '0 0 0 3px rgba(168,128,47,.55)';
  window.setTimeout(() => {
    el.style.boxShadow = prior;
  }, 1400);
}

export function EditorBridge() {
  useEffect(() => {
    const origin = window.location.origin;
    const cleanups: Array<() => void> = [];
    /* ✍ TAP ANY TEXT, TYPE RIGHT THERE (Maker core part 2): a tap on a hero
       part's words puts the caret in them; the Maker hears every keystroke and
       writes it (`type-in-place-canvas.ts`). */
    const typing = createCanvasTyping(window, (m) => window.parent?.postMessage(m, origin));
    cleanups.push(() => typing.dispose());

    // ── canvas → Maker: a tapped section selects its navigator tile ─────────
    const bind = (el: HTMLElement, key: string) => {
      if (el.dataset.setnayanEditorBound === '1') return;
      el.dataset.setnayanEditorBound = '1';
      const prevCursor = el.style.cursor;
      el.style.cursor = 'pointer';
      const send = (e: Event) => {
        /*
          📖 AN OPEN-UP SCENE (Maker Phase 8) OPENS IN THE CANVAS TOO. Its
          trigger goes nowhere — it lays the scene full screen over this same
          page, and ✕ / Esc / Back return — so the couple can check it where
          they edit it. The tile is still selected: by the NEAREST bound
          section only (an enclosing one — the whole story — must not take the
          selection back), and the event is left to bubble, because React
          listens at the root and a stopped click would never open anything.
        */
        const trigger = (e.target as Element | null)?.closest?.('[data-open-up-trigger]');
        if (trigger) {
          if (trigger.closest('[data-setnayan-editor-bound="1"]') === el) {
            window.parent?.postMessage({ source: 'setnayan-site', t: 'edit', key }, origin);
          }
          return;
        }
        // A link or button inside the section keeps its own job; the canvas
        // never follows it anywhere (see maker-canvas-guard.tsx).
        e.preventDefault();
        e.stopPropagation();
        // ✍ A tap inside the words being typed only moves the caret.
        if (typing.inside(e.target)) return;
        // 🔤 A tap ON a part edits that part; anywhere else, the scene.
        const part = tappedElement(e.target, el);
        mark(part);
        /* ✍ A hero part's words — or a scene's words the Maker offered
           (`markSceneWords`): the caret goes IN them, here, in the tap itself
           (a phone raises its keyboard only for a focus made in the gesture)
           — and the Maker's type bar, not its sheet, answers. */
        const typeEl = typeablePart(part, key) ?? (sceneTypeField(part) ? (part?.getAttribute('data-el') as HubElementKey | null) : null);
        if (part && typeEl) {
          const at = e as MouseEvent;
          typing.begin(part, key, typeEl, { x: at.clientX, y: at.clientY });
          return;
        }
        typing.stop();
        // 📱 On a phone the element's sheet rises over the lower canvas, so the
        // part is brought up to where it stays in view while it is edited.
        try {
          if (part && (window.top?.innerWidth ?? 1024) < 1024) part.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
          /* a parent we cannot measure — the part stays where it was tapped */
        }
        // ✍ An empty scene (the Maker's placeholder) says so: its words are
        // what the couple came to write.
        const empty = el.matches('[data-maker-empty]') || el.querySelector('[data-maker-empty]') ? { empty: true } : {};
        // 🗓 A tap on one schedule moment names it (`data-schedule-moment`,
        // schedule-widget.tsx), so the Maker opens THAT moment in Details.
        const momentId = (e.target as Element | null)?.closest?.('[data-schedule-moment]')?.getAttribute('data-schedule-moment');
        const moment = momentId ? { moment: momentId } : {};
        window.parent?.postMessage(
          part
            ? { source: 'setnayan-site', t: 'edit', key, el: part.getAttribute('data-el'), ...empty, ...moment }
            : { source: 'setnayan-site', t: 'edit', key, ...empty, ...moment },
          origin,
        );
      };
      el.addEventListener('click', send);
      cleanups.push(() => {
        el.removeEventListener('click', send);
        el.style.cursor = prevCursor;
        delete el.dataset.setnayanEditorBound;
      });
    };
    document.querySelectorAll('[data-maker-section]').forEach((m) => {
      const el = sectionAfter(m);
      if (!el) return;
      const key = m.getAttribute('data-maker-section')!;
      stampSceneElements(el, key);
      bind(el, key);
    });
    for (const key of ['f:entourage', 'f:story']) {
      const el = findMakerSection(document, key);
      if (el) bind(el, key);
    }
    // The legacy rows (details, …) — bubbling from a section above stops first.
    for (const key of ['home', 'details', 'gallery', 'me']) {
      const el = findMakerSection(document, key);
      if (el) bind(el, key);
    }

    // ── canvas → Maker: a selection inside a part's text (✍ runs) ──────────
    let selTimer: number | null = null;
    const onSelection = () => {
      if (selTimer) window.clearTimeout(selTimer);
      selTimer = window.setTimeout(() => {
        /* ✍ Letters selected while typing are the caret's, not a pick for the
           style sheet (Style ▾ opens it, on the whole part). */
        if (typing.typing()) return;
        const hit = selectionInPart(window.getSelection());
        const section = hit?.part.closest('[data-setnayan-editor-bound="1"]') as HTMLElement | null;
        const marker = section?.previousElementSibling;
        const key = marker?.getAttribute('data-maker-section') ?? null;
        window.parent?.postMessage(
          hit && key
            ? {
                source: 'setnayan-site',
                t: 'select',
                key,
                el: hit.el,
                start: hit.start,
                end: hit.end,
                of: hit.of,
                text: hit.text,
                whole: hit.whole,
              }
            : { source: 'setnayan-site', t: 'select', key: null },
          origin,
        );
      }, 160);
    };
    document.addEventListener('selectionchange', onSelection);
    cleanups.push(() => {
      document.removeEventListener('selectionchange', onSelection);
      if (selTimer) window.clearTimeout(selTimer);
    });

    // ── Maker → canvas: scroll to a tile, or play its entrance in place ──────
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as { source?: string; t?: string; key?: string; el?: unknown } | null;
      if (data && data.source === 'setnayan-editor' && data.t === 'sceneBg') {
        /* ⚡ A SCENE'S BACKGROUND, ON THE CANVAS NOW (`scene-bg-preview.ts`) —
           one scene, or every scene of the stage. The Maker computed each
           frame with the server's own functions; this only lays it, checked. */
        for (const scene of sanitizeSceneBgPreview((data as { scenes?: unknown }).scenes)) {
          const section = findMakerSection(document, scene.key);
          if (section) applySceneBgPreview(section, scene, document);
          /* 🖼 …and the widget's OWN card, at once (owner 2026-09-28, "yes must
             be instant"): the server's `sceneWidgetIsBare` answer, laid with
             the server's own class strings (`lib/scene-card-look.ts`). The
             save's reload still follows and still decides. */
          const framed = typeof scene.bare === 'boolean' ? findMakerSection(document, scene.key) : null;
          if (framed && typeof scene.bare === 'boolean') applySceneCardPreview(framed, scene.bare);
        }
        return;
      }
      /* ⚡ THE LOVE STORY AND THE PROGRAMME, AS THEY ARE TYPED (owner
         2026-09-30: *"so hard to edit … the delay of response is terrible"*).
         Page-wide, like the backgrounds above: the Maker's words land on the
         scenes the server drew (`lib/maker-live-preview.ts`); nothing is
         fetched and nothing reloads. */
      if (data && data.source === 'setnayan-editor' && data.t === LOVE_STORY_PREVIEW) {
        applyLoveStoryPreview(document, (data as { scenes?: unknown }).scenes);
        return;
      }
      if (data && data.source === 'setnayan-editor' && data.t === SCHEDULE_PREVIEW) {
        applySchedulePreview(document, (data as { moment?: unknown }).moment);
        return;
      }
      /* ✍ Tap-to-type: the Maker ends the typing (Done, Style ▾, a tap
         outside), or asks for the words as they are now (its bar just loaded). */
      if (data && data.source === 'setnayan-editor' && data.t === 'typeStop') {
        typing.stop();
        return;
      }
      if (data && data.source === 'setnayan-editor' && data.t === 'typeSync') {
        typing.sync();
        return;
      }
      /* ✍ Which scene words a tap types in (the Maker says, on every `ready`):
         marked here, and what was found is said back — the Maker's box steps
         aside only for words the caret really reaches. */
      if (data && data.source === 'setnayan-editor' && data.t === 'typeHere') {
        const found = markSceneWords(document, readSceneTypeWords((data as { parts?: unknown }).parts));
        window.parent?.postMessage(
          { source: 'setnayan-site', t: 'typeHereFound', phase: new URLSearchParams(window.location.search).get('phase'), found },
          origin,
        );
        return;
      }
      if (!data || data.source !== 'setnayan-editor' || typeof data.key !== 'string') return;
      if (data.t === 'typeText') {
        /* ✍ A Wording ▾ / Format ▾ pick, the other pane's keystroke, or a
           refused save's words put back — on the part now. */
        const text = (data as { text?: unknown }).text;
        const field = (data as { field?: unknown }).field;
        if (typeof data.el === 'string' && typeof text === 'string') {
          const scene = typeof field === 'string' && field ? field : null;
          typing.set(findMakerSection(document, data.key), data.el, text.slice(0, scene ? 4000 : 240), scene);
        }
        return;
      }
      const el = findMakerSection(document, data.key);
      if (!el) return;
      if (data.t === 'sceneShow') {
        /* 🙈 A SCENE TAKEN OFF THE PAGE, NOW (owner 2026-09-28: *"picking
           something takes a lot of time before the website reacts"*). The
           server's next render does not draw a hidden scene at all; until it
           lands, this one is simply not displayed — the same page, one frame
           later. The Maker holds that render (`orderWithout`), so it never
           reloads. Putting a scene back is never drawn here: a scene the page
           did not draw has nothing to show, so that write reloads. */
        el.style.display = (data as { shown?: unknown }).shown === false ? 'none' : '';
        return;
      }
      if (data.t === 'playEl') {
        /* ▶ REPLAY ONE ELEMENT'S IN (`replayElementIn`). */
        const part =
          typeof data.el === 'string' ? el.querySelector<HTMLElement>(`[data-el="${CSS.escape(data.el)}"]`) : null;
        if (part) replayElementIn(part);
        return;
      }
      if (data.t === 'elStyle') {
        /* ⚡ THE INSTANT PREVIEW — the choice on the canvas now, the save behind
           it. Re-sanitized here: a scene's choice becomes `<style>` text, and
           only the closed sets may ever reach CSS. A motion change replays the
           part's In so the couple sees the new arrival. */
        if (!isHubElementKey(data.el)) return;
        const msg = data as { elements?: unknown; motion?: unknown; replay?: unknown };
        const parts = applyElementPreview(
          el,
          data.key,
          data.el,
          sanitizeHubElements(msg.elements),
          msg.motion === true,
          document,
        );
        if (msg.replay === true && parts[0]) replayElementIn(parts[0]);
        return;
      }
      if (data.t === 'markEl') {
        // The Maker's element sheet is open on this part (after a reload too).
        const part =
          typeof data.el === 'string'
            ? el.querySelector<HTMLElement>(`[data-el="${CSS.escape(data.el)}"]`)
            : null;
        mark(part);
        return;
      }
      if (data.t === 'scenePlaceholder') {
        /* ＋ A SCENE ON ITS WAY (owner 2026-09-29: *"make sure 100% that there
           is no slow response on the maker"*). The couple tapped a template:
           a quiet placeholder takes the new scene's place — after the stage's
           last scene — until the render that draws it replaces this page
           (the canvas reloads double-buffered). Nothing here is kept. */
        document.querySelector('[data-maker-scene-placeholder]')?.remove();
        const box = document.createElement('div');
        box.setAttribute('data-maker-scene-placeholder', '');
        box.setAttribute('role', 'status');
        box.textContent = 'Adding your scene…';
        box.style.cssText =
          'margin:16px auto;max-width:560px;min-height:180px;display:flex;align-items:center;justify-content:center;border:1.5px dashed rgba(27,26,23,.25);border-radius:var(--m-r-md);font:500 13px/1.4 system-ui,sans-serif;color:rgba(27,26,23,.6);animation:pulse 1.4s ease-in-out infinite';
        el.insertAdjacentElement('afterend', box);
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (data.t === 'words') {
        // ✍ The Content box's words, on the scene now (`previewSceneWords`).
        const text = (data as { text?: unknown }).text;
        if (typeof text === 'string' && previewSceneWords(el, text.slice(0, 2000)) && data.key.startsWith('w:')) {
          /* ✍ The new words wiped the scene's run spans; its runs are laid
             again, ADAPTED onto what is being typed — the couple sees each
             styled letter keep its style as the words change around it. */
          const tag = sceneStyleOf(el, data.key.slice(2));
          applySceneRuns(el, readHubSceneRuns(tag?.getAttribute('data-hub-runs')), document);
        }
        return;
      }
      if (data.t === 'scrollTo') {
        /* To the scene's TOP, always (owner 2026-09-27: "a scene is as tall as
           its content — never a forced full screen"). A short scene lands with
           the next one below it on the same screen; nothing is resized. */
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        flash(el);
      } else if (data.t === 'play') {
        // ▶ PLAY THIS SCENE — in place, in the canvas: bring it into view, then
        // replay its entrance and let it come to rest. Reduced motion: a flash.
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce || typeof el.animate !== 'function') {
          flash(el);
          return;
        }
        el.animate(
          [
            { opacity: 0, transform: 'translateY(22px) scale(.985)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)' },
        );
      }
    };
    window.addEventListener('message', onMessage);
    cleanups.push(() => window.removeEventListener('message', onMessage));

    // Tell the parent the frame is ready, with the order it actually drew.
    window.parent?.postMessage(
      { source: 'setnayan-site', t: 'ready', order: drawnMakerOrder(document), bar: readMakerBar(document) },
      origin,
    );

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
