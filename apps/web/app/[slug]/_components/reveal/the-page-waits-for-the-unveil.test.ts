/**
 * the-page-waits-for-the-unveil.test.ts — owner 2026-10-17, verbatim, on live `/cale-ice` with the veil closed:
 * *"website will not scroll until reveal starts/opens/ etc. i notice i can already scroll"*.
 *
 * THE PROPERTY: while the opening is closed the document is not a user scroller (wheel, trackpad, keys, touch);
 * the moment the unveil STARTS it is again, for the rest of the visit; and where no opening is held (none mounted,
 * reduced motion, the Maker's canvas, the ▶ preview) it never was locked.
 *
 * The hold script (`lib/hub-veil.ts` `VEIL_HOLD_SCRIPT`) is EXECUTED against a stand-in document, as
 * `the-veil-opens-on-a-tap.test.ts` does: the lock's rule is in the `<style>` it writes, its `touchmove` cancels a
 * pan outside the opening's box, and both are gone after one release and never come back. The browser half (a real
 * touch pan, a wheel, a key) is the walk in the PR body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { VEIL_HOLD_ATTR, VEIL_HOLD_SCRIPT, VEIL_STILL_PAGE_CSS } from '@/lib/hub-veil';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

type Ev = { target: unknown; cancelable: boolean; prevented: boolean; preventDefault(): void };
type L = { f: (e: Ev) => void; opts: unknown };

function standIn(opts: { reduce?: boolean } = {}) {
  const listeners: Record<string, L[]> = {};
  const head = {
    kids: [] as Array<{ parentNode: unknown; textContent: string; attrs: Record<string, string> }>,
    appendChild(el: { parentNode: unknown; textContent: string; attrs: Record<string, string> }) { head.kids.push(el); el.parentNode = head; },
    removeChild(el: { parentNode: unknown }) { head.kids = head.kids.filter((k) => k !== el); el.parentNode = null; },
  };
  const document = {
    head,
    documentElement: { setAttribute() {}, removeAttribute() {}, hasAttribute: () => false },
    createElement: () => {
      const el = { parentNode: null as unknown, textContent: '', attrs: {} as Record<string, string>, setAttribute(n: string, v: string) { el.attrs[n] = v; } };
      Object.defineProperty(el, 'isConnected', { get: () => el.parentNode !== null });
      return el;
    },
    addEventListener: (t: string, f: (e: Ev) => void, o: unknown) => void (listeners[t] ??= []).push({ f, opts: o }),
    removeEventListener: (t: string, f: (e: Ev) => void) => void (listeners[t] = (listeners[t] ?? []).filter((x) => x.f !== f)),
    querySelectorAll: () => [],
    getAnimations: () => [],
  };
  const window: Record<string, unknown> = {
    matchMedia: () => ({ matches: Boolean(opts.reduce) }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined,
    dispatchEvent: () => undefined,
  };
  const run = () => new Function('window', 'document', 'setTimeout', VEIL_HOLD_SCRIPT)(window, document, () => 0);
  const holdStyle = () => head.kids.find((k) => k.attrs[VEIL_HOLD_ATTR] === '');
  /** A pan: on the page, or on the opening's own box (`closest('[data-reveal-layer]…')` answers). */
  const pan = (onVeil = false): Ev => {
    const e: Ev = {
      target: { closest: (sel: string) => (onVeil && /data-reveal-layer/.test(sel) ? {} : null) },
      cancelable: true,
      prevented: false,
      preventDefault() { e.prevented = true; },
    };
    for (const l of listeners.touchmove ?? []) l.f(e);
    return e;
  };
  return { window, listeners, run, holdStyle, pan };
}

test('🧱 the lock’s rule: html and body are not user scrollers, no rubber band, no jump when it lets go', () => {
  assert.match(VEIL_STILL_PAGE_CSS, /html,body\{overflow:hidden !important;overscroll-behavior:none !important\}/);
  assert.match(VEIL_STILL_PAGE_CSS, /html\{scrollbar-gutter:stable\}/);
});

test('🧱 closed: the hold writes the lock, and a touch pan on the page is cancelled — the veil’s own swipe is not', () => {
  const s = standIn();
  s.run();
  const st = s.holdStyle();
  assert.ok(st, 'the hold did not write its style');
  assert.ok(st.textContent.includes(VEIL_STILL_PAGE_CSS), 'the hold’s style does not lock the page');
  const tm = s.listeners.touchmove ?? [];
  assert.equal(tm.length, 1, 'no touchmove guard — older iOS Safari scrolls a hidden body by touch');
  assert.deepEqual(tm[0]!.opts, { passive: false }, 'a passive touchmove cannot cancel the pan');
  assert.equal(s.pan().prevented, true, 'a touch pan on the page behind the closed veil was let through');
  assert.equal(s.pan(true).prevented, false, 'the veil’s own swipe up was cancelled');
});

test('🧱 the unveil lets go at once and for the visit — a second hold (client nav, the cover returning) adds nothing', () => {
  const s = standIn();
  s.run();
  (s.window.__veilRelease as () => void)();
  assert.equal(s.holdStyle(), undefined, 'the lock outlived the unveil');
  assert.equal((s.listeners.touchmove ?? []).length, 0, 'the touchmove guard outlived the unveil');
  s.run();
  assert.equal(s.holdStyle(), undefined, 'the page was locked again after the unveil');
  assert.equal((s.listeners.touchmove ?? []).length, 0);
});

test('♿ reduced motion: never locked (no opening there by the shipped rule)', () => {
  const s = standIn({ reduce: true });
  s.run();
  assert.equal(s.holdStyle(), undefined);
  assert.equal((s.listeners.touchmove ?? []).length, 0);
});

test('🧱 it lets go when the unveil STARTS, and is only ever written where a guest’s opening is mounted', () => {
  const hubVeil = code('lib/hub-veil.ts');
  assert.match(hubVeil, /export function unveilInGesture\(\): void \{\s*releaseVeilHold\(\);/, 'the unveil does not release the page first');
  const veil = code('app/[slug]/_components/reveal/veil-reveal.tsx');
  assert.match(veil, /const unveil = \(\) => \{\s*try \{ onUnveilRef\.current\?\.\(\); \}/, 'the veil’s tap / swipe no longer calls the unveil in the gesture');
  const overlay = code('app/[slug]/_components/reveal/reveal-overlay.tsx');
  assert.match(overlay, /onUnveil=\{\(\) => \{\s*unveilInGesture\(\);/, 'the overlay’s unveil does not release the page');
  // Written only where an opening is mounted; never on the Maker's canvas; never by the ▶ preview.
  const mount = code('app/[slug]/_components/reveal/reveal-mount.tsx');
  assert.match(mount, /\{mountOverlay \? \(\s*<script\s*[\s\S]*?dangerouslySetInnerHTML=\{\{ __html: VEIL_HOLD_SCRIPT \}\}/);
  assert.match(code('app/[slug]/_components/site-body.tsx'), /enabled=\{plan\.revealEnabled && !isMakerCanvas\}/, 'the Maker’s canvas would be locked');
  assert.match(overlay, /if \(!mounted \|\| preview\) return;\s*if \(!active \|\| gone\) \{\s*releaseVeilHold\(\);/, 'the ▶ preview or a stood-down opening would hold the page');
  assert.equal(/VEIL_HOLD_SCRIPT|ensureVeilHold/.test(code('app/[slug]/_components/reveal/cover-play-opening.tsx')), false, 'the ▶ preview writes the hold');
});
