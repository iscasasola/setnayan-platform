/**
 * scene-look-lay.ts — 🎨 THE PICTURE OF A SECTION, LAID OVER THE PAGE'S OWN (the bridge's half of
 * `lib/maker-scene-look.ts`: a style pick on the page at the tap, and its ↺).
 *
 * The page's own section is a node React rendered: it is never moved or removed here (React would find it gone and
 * `removeChild` would throw — measured 2026-10-08), only marked hidden. The picture is laid straight after it, so the
 * scene's own `<style data-hub-els>` (addressed as `:has(+ style)`) still follows a section, and every Maker lookup
 * (`sectionAfter`) finds the picture while it is laid — a colour picked over it is drawn ON it. The page's own
 * per-part looks (`[data-el]`'s inline style — what the bridge drew since the card was rendered) are carried onto it.
 * `takeScenePicturesOff` puts everything back; the bridge runs it in the commit that brings the server's render.
 */
import { SCENE_LOOK_COPY_ATTR, SCENE_LOOK_HIDDEN_ATTR } from './maker-section-find';

const RULE_ATTR = 'data-maker-look-rule';

/** Lay `html` (one section) over the section after the `key` marker. True when it is on the page. */
export function layScenePicture(doc: Document, key: string, html: string): boolean {
  const marker = doc.querySelector(`[data-maker-section="${CSS.escape(key)}"]`);
  if (!marker) return false;
  /* the page's own section: the marker's next element, past a picture already laid */
  let own = marker.nextElementSibling as HTMLElement | null;
  if (!own || own.hasAttribute('data-maker-section')) return false;
  const laid = own.nextElementSibling;
  if (own.hasAttribute(SCENE_LOOK_HIDDEN_ATTR) && laid?.getAttribute(SCENE_LOOK_COPY_ATTR) === key) laid.remove();
  const tpl = doc.createElement('template');
  tpl.innerHTML = html;
  const pic = tpl.content.firstElementChild as HTMLElement | null;
  if (!pic) return false;
  pic.querySelectorAll('script').forEach((s) => s.remove());
  pic.setAttribute(SCENE_LOOK_COPY_ATTR, key);
  /* what the bridge drew on the page's own parts since that card was drawn: carried over, part by part */
  const parts = new Map<string, HTMLElement[]>();
  own.querySelectorAll<HTMLElement>('[data-el]').forEach((e) => {
    const k = e.getAttribute('data-el')!;
    parts.set(k, [...(parts.get(k) ?? []), e]);
  });
  const seen = new Map<string, number>();
  pic.querySelectorAll<HTMLElement>('[data-el]').forEach((e) => {
    const k = e.getAttribute('data-el')!;
    const i = seen.get(k) ?? 0;
    seen.set(k, i + 1);
    const from = parts.get(k)?.[i];
    const style = from?.getAttribute('style');
    if (style) e.setAttribute('style', style);
  });
  if (!doc.head.querySelector(`style[${RULE_ATTR}]`)) {
    const rule = doc.createElement('style');
    rule.setAttribute(RULE_ATTR, '');
    rule.textContent = `[${SCENE_LOOK_HIDDEN_ATTR}]{display:none!important}`;
    doc.head.appendChild(rule);
  }
  own.setAttribute(SCENE_LOOK_HIDDEN_ATTR, '');
  own.insertAdjacentElement('afterend', pic);
  return true;
}

/** Every picture off, every section shown again — in the commit that draws the server's render. */
export function takeScenePicturesOff(doc: Document): void {
  doc.querySelectorAll(`[${SCENE_LOOK_COPY_ATTR}]`).forEach((e) => e.remove());
  doc.querySelectorAll(`[${SCENE_LOOK_HIDDEN_ATTR}]`).forEach((e) => e.removeAttribute(SCENE_LOOK_HIDDEN_ATTR));
}
