/**
 * 💾 LAST-SEEN DATA — TAKING THE SNAPSHOT (browser only; lazy-loaded with the
 * store). See `./store.ts` for the rules; this is the DOM half of rule 1
 * (never money) and rule 4 (only what the page showed).
 *
 * Works on a CLONE of the page's rendered DOM, so the live page is untouched.
 * The string it returns still goes through `guardSnapshotHtml` before it is
 * written — this step makes a snapshot pass that gate; the gate is what makes
 * a missed case fail closed.
 */

import { guardSnapshotHtml } from './store';

/**
 * Removed outright: anything executable or embedded, anything the page was not
 * SHOWING (hidden elements, closed dialogs, hidden form fields), anything
 * money, and fixed overlays (sheets, pinned bars) that would float over the
 * loading screen.
 */
const DROP = [
  'script',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'video',
  'audio',
  'dialog:not([open])',
  '[hidden]',
  'input[type="hidden"]',
  '[data-money]',
  '[data-last-seen-skip]',
  '.fixed',
].join(',');

/** Attributes that act, navigate, or carry a value the person typed. */
const STRIP_ATTRS = new Set(['href', 'action', 'formaction', 'srcdoc', 'ping', 'autofocus', 'name']);
/** Form controls lose what was typed or chosen in them. */
const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON']);
/** Past this many characters a "nearest figure" is a whole section, not a figure. */
const MAX_FIGURE_SCOPE_CHARS = 240;

const PESO = /₱|\bPHP\b/;

/**
 * Masks a peso figure even when React split it across elements
 * (`<span>₱</span><span>12,500</span>`): the nearest ancestor that holds a
 * digit loses every digit, and the sign itself goes.
 */
function maskMoneyText(root: Element): boolean {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (PESO.test(n.nodeValue ?? '')) hits.push(n as Text);
  }
  for (const text of hits) {
    let scope: Element | null = text.parentElement;
    while (scope && scope !== root && !/\d/.test(scope.textContent ?? '')) scope = scope.parentElement;
    const target = scope ?? text.parentElement ?? root;
    // A figure whose digits sit that far from its sign cannot be found safely —
    // keep no snapshot at all rather than a bare amount without its ₱.
    if ((target.textContent ?? '').length > MAX_FIGURE_SCOPE_CHARS) return false;
    const inner = doc.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    for (let t = inner.nextNode(); t; t = inner.nextNode()) {
      t.nodeValue = (t.nodeValue ?? '').replace(/₱|\bPHP\b/g, '').replace(/\d[\d,.]*\s?[KMB]?/g, '—');
    }
    text.nodeValue = (text.nodeValue ?? '').replace(/₱|\bPHP\b/g, '');
  }
  return true;
}

/** The page's rendered content, cleaned for keeping — or null if it may not be kept. */
export function snapshotFromRoot(root: Element): string | null {
  // Still streaming in — a later capture takes it once it has settled.
  if (root.querySelector('[aria-busy="true"]')) return null;
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll(DROP).forEach((el) => el.remove());
  for (const el of Array.from(clone.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || STRIP_ATTRS.has(name)) el.removeAttribute(attr.name);
    }
    if (FIELD_TAGS.has(el.tagName)) {
      el.removeAttribute('value');
      el.removeAttribute('checked');
      el.removeAttribute('selected');
    }
  }
  clone.querySelectorAll('textarea').forEach((el) => (el.textContent = ''));
  // Icons keep their box but not their drawing: a 200-row guest list repeats
  // the same few icons hundreds of times, and their paths are most of its size.
  // The real page, icons and all, replaces this within a moment.
  clone.querySelectorAll('svg.lucide').forEach((svg) => svg.replaceChildren());
  if (!maskMoneyText(clone)) return null;
  if (!clone.textContent?.trim()) return null;
  // Whitespace between tags carries nothing (string-side: re-parsing the
  // clone would start its images loading again).
  return guardSnapshotHtml(clone.innerHTML.replace(/>\s+</g, '> <'));
}
