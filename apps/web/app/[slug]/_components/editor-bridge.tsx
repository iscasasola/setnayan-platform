'use client';

import { useEffect } from 'react';
import {
  HUB_ELEMENT_EXCLUDED_WIDGETS,
  HUB_ELEMENT_LOOK_PROPS,
  HUB_ELEMENT_MOTION_PROPS,
  HUB_ELEMENT_RUN_KEYS,
  HUB_HERO_ELEMENT_KEYS,
  HUB_SCENE_ELEMENT_KEYS,
  HUB_SCENE_ELEMENT_SELECTOR,
  hubElementDeclarations,
  hubElementSceneCss,
  hubRunDeclarations,
  hubTextHash,
  hubTextSegments,
  isHubElementKey,
  sanitizeHubElements,
  type HubElementKey,
  type HubElementStyle,
  type HubElementStyles,
} from '@/lib/element-style';

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
 *   frame  → parent { source:'setnayan-site',   t:'edit',     key, el? }
 *   frame  → parent { source:'setnayan-site',   t:'select',   key, el, start, end, of, text }
 *   parent → frame  { source:'setnayan-editor', t:'playEl',   key, el }
 *   parent → frame  { source:'setnayan-editor', t:'elStyle',  key, el, elements, motion, replay }
 *   frame  → parent { source:'setnayan-site',   t:'ready',    order, bar }
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

/** Legacy row keys → the DOM ids the site already renders. */
const SECTION_IDS: Record<string, string> = {
  home: 'site-home',
  hero: 'site-home',
  details: 'site-details',
  // On the day the Event Bar's "Schedule" tab lands on the day's details.
  schedule: 'site-details',
  story: 'site-story',
  gallery: 'site-gallery',
  me: 'site-me',
  'f:entourage': 'site-entourage',
  'f:story': 'site-story',
};

/** The section a marker stands in front of: its next element that is not a marker. */
function sectionAfter(marker: Element): HTMLElement | null {
  const next = marker.nextElementSibling;
  if (!next || next.hasAttribute('data-maker-section')) return null;
  return next as HTMLElement;
}

/** The element a navigator key points at, or null when this stage draws none. */
export function findMakerSection(doc: Document, key: string): HTMLElement | null {
  const marker = doc.querySelector(`[data-maker-section="${CSS.escape(key)}"]`);
  if (marker) return sectionAfter(marker);
  const id = SECTION_IDS[key];
  if (!id) return null;
  const anchor = doc.getElementById(id);
  if (!anchor) return null;
  // A zero-height anchor marks a region; the region is its nearest section-ish ancestor.
  if (anchor.offsetHeight > 0) return anchor;
  return (anchor.closest('section, article, div[id]') as HTMLElement | null) ?? anchor;
}

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
  if (!key.startsWith('w:')) return 0;
  if (HUB_ELEMENT_EXCLUDED_WIDGETS.includes(key.slice(2))) return 0;
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
 * the same `data-el` part whose text can carry runs (the hero's words); the
 * offsets are counted in that part's `textContent`, the SAME string the guest
 * page cuts its spans from, and `of` fingerprints it so a run can never land on
 * different letters after the text changes. Null when there is no such
 * selection — the choice then styles the whole part.
 */
export function selectionInPart(
  sel: Selection | null,
): { part: HTMLElement; el: HubElementKey; start: number; end: number; of: string; text: string } | null {
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
  return { part, el, start, end: start + text.length, of: hubTextHash(whole), text };
}

/* ── ⚡ THE INSTANT PREVIEW — one choice laid on the canvas, no reload ──── */

/** The part of the DOM the preview writes through — a real document, or a test's. */
type PreviewDoc = Pick<Document, 'createElement' | 'createTextNode'>;

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
  for (const [p, v] of hubElementDeclarations(style)) {
    if (motion || LOOK_PROPS.includes(p)) part.style.setProperty(p, v);
  }
}

function textNodesOf(node: Node, out: Text[]): Text[] {
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) out.push(c as Text);
    else if (c.nodeType === 1) textNodesOf(c, out);
  });
  return out;
}

/**
 * ✍ A HERO PART'S RUNS, re-cut in place. The old run spans are unwrapped back
 * into plain text, then every text node is cut by `hubTextSegments` at its own
 * offset in the part's WHOLE text (`textContent` — the string the server's
 * `whole` is, and the one the selection's offsets are counted in), and each run
 * piece becomes the same `<span data-el-run>` the guest page draws.
 */
export function applyHeroPartRuns(part: HTMLElement, style: HubElementStyle | null | undefined, doc: PreviewDoc): void {
  part.querySelectorAll('[data-el-run]').forEach((span) => {
    span.parentNode?.replaceChild(doc.createTextNode(span.textContent ?? ''), span);
  });
  part.normalize();
  const whole = part.textContent ?? '';
  let at = 0;
  for (const node of textNodesOf(part, [])) {
    const text = node.data;
    const segments = hubTextSegments(text, style, { text: whole, segmentStart: at });
    at += text.length;
    if (segments.length === 1 && !segments[0]!.run) continue;
    const parent = node.parentNode;
    if (!parent) continue;
    for (const seg of segments) {
      if (!seg.run) {
        parent.insertBefore(doc.createTextNode(seg.text), node);
        continue;
      }
      const span = doc.createElement('span');
      span.setAttribute('data-el-run', '');
      for (const [p, v] of hubRunDeclarations(seg.run)) span.style.setProperty(p, v);
      span.appendChild(doc.createTextNode(seg.text));
      parent.insertBefore(span, node);
    }
    parent.removeChild(node);
  }
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
  let tag = sceneStyleOf(section, widgetType);
  if (!tag) {
    if (!css) return null;
    tag = doc.createElement('style');
    tag.hidden = true;
    tag.setAttribute('data-hub-els', widgetType);
    section.parentNode?.insertBefore(tag, section.nextSibling);
  }
  tag.textContent = css;
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
    for (const part of parts) {
      applyHeroPartStyle(part, elements?.[el], motion);
      if (HUB_ELEMENT_RUN_KEYS.includes(el)) applyHeroPartRuns(part, elements?.[el], doc);
    }
    return parts;
  }
  if (!key.startsWith('w:')) return [];
  // A ▶ Play leaves an inline `-p` twin that would outrank the new motion.
  if (motion) for (const part of parts) part.style.removeProperty('animation-name');
  applySceneElementStyles(section, key.slice(2), elements, doc);
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
        // 🔤 A tap ON a part edits that part; anywhere else, the scene.
        const part = tappedElement(e.target, el);
        mark(part);
        // 📱 On a phone the element's sheet rises over the lower canvas, so the
        // part is brought up to where it stays in view while it is edited.
        try {
          if (part && (window.top?.innerWidth ?? 1024) < 1024) part.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
          /* a parent we cannot measure — the part stays where it was tapped */
        }
        window.parent?.postMessage(
          part
            ? { source: 'setnayan-site', t: 'edit', key, el: part.getAttribute('data-el') }
            : { source: 'setnayan-site', t: 'edit', key },
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
        const hit = selectionInPart(window.getSelection());
        const section = hit?.part.closest('[data-setnayan-editor-bound="1"]') as HTMLElement | null;
        const marker = section?.previousElementSibling;
        const key = marker?.getAttribute('data-maker-section') ?? null;
        window.parent?.postMessage(
          hit && key
            ? { source: 'setnayan-site', t: 'select', key, el: hit.el, start: hit.start, end: hit.end, of: hit.of, text: hit.text }
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
      if (!data || data.source !== 'setnayan-editor' || typeof data.key !== 'string') return;
      const el = findMakerSection(document, data.key);
      if (!el) return;
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
