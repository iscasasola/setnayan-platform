/**
 * the-first-screen-keeps-its-action.test.ts — ON A FIRST SCREEN, NOTHING SITS ON THE PAGE'S OWN CONTROLS.
 *
 * Measured on the live sample event's guest page (2026-10-11, a stranger on a phone):
 *
 *   G01 · 12 fresh visits at 375 × 812. In 5 the cookie banner sat ON the Welcome / Details bar (banner 679–800,
 *         bar 747–812, `--cb-lift: 0px`): a tap on Details pressed "Manage". In the other 7, lifted clear of the
 *         bar (614–735), it sat on "Get inside" (715–771) instead.
 *   G09 · "Get inside" has its place at y 715–771: entirely below a 375 × 667 screen, and under the bar at
 *         375 × 812 (32 of 56 px showing).
 *
 * Three boxes share the bottom of a phone — the page's bar, the cookie banner, the page's one action — and each was
 * placed without knowing of the others. The fix gives them ONE order, bottom up: the bar · the banner · the action.
 *
 * 🔑 THE PROPERTY, measured rather than read:
 *   (1) (2) the banner clears the bar, however late the bar arrives — `the-cookie-banner-clears-the-bar.test.ts`;
 *   (3) the three boxes never overlap: the dock's own CSS, read from `globals.css` and evaluated for every phone
 *       height × safe area × banner height tried here, puts the action above the banner and the bar, and the
 *       banner above the bar;
 *   (4) the page wears what (3) measured — the door is docked, the row draws no box, an open door returns to its
 *       place and is brought into view.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { bottomChromeLift, type ChromeBox } from '@/lib/bottom-chrome';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const BANNER = stripComments(read('app/_components/cookie-consent-banner.tsx'));
const CSS = read('app/globals.css');

const box = (top: number, bottom: number, width = 375): ChromeBox => ({ top, bottom, width, height: bottom - top });
const overlap = (a: { top: number; bottom: number }, b: { top: number; bottom: number }) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** Where the banner's own class puts it: `bottom-[calc(var(--cb-lift,0px)+max(0.75rem,env(safe-area-inset-bottom)))]`. */
function bannerBox(lift: number, height: number, vh: number, safe: number) {
  assert.match(BANNER, /bottom-\[calc\(var\(--cb-lift,0px\)\+max\(0\.75rem,env\(safe-area-inset-bottom\)\)\)\]/, 'the banner is positioned some other way — re-derive bannerBox()');
  const bottom = vh - (lift + Math.max(12, safe));
  return { top: bottom - height, bottom };
}

/* ── A CSS length, evaluated: px · rem · calc(a + b) · max(a, b) · var(--x, fallback) · env(x, fallback) ───────── */
function evalLength(expr: string, env: { vars: Record<string, string>; safe: number }): number {
  const s = expr.trim();
  const splitTop = (str: string, sep: string): string[] => {
    const out: string[] = []; let depth = 0; let cur = '';
    for (let i = 0; i < str.length; i++) {
      const c = str[i]!;
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (depth === 0 && str.startsWith(sep, i)) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };
  const call = /^([a-z-]+)\(([\s\S]*)\)$/.exec(s);
  if (call) {
    const [, name, inner] = call as unknown as [string, string, string];
    if (name === 'calc') { const terms = splitTop(inner, ' + '); return terms.reduce((sum, t) => sum + evalLength(t, env), 0); }
    if (name === 'max') return Math.max(...splitTop(inner, ',').map((t) => evalLength(t, env)));
    if (name === 'var') { const [key, ...fallback] = splitTop(inner, ','); const v = env.vars[key!]; return evalLength(v ?? fallback.join(','), env); }
    if (name === 'env') { const [key] = splitTop(inner, ','); assert.equal(key, 'safe-area-inset-bottom'); return env.safe; }
    assert.fail(`evalLength cannot read ${name}() — extend it, do not delete the test`);
  }
  const n = /^(-?[\d.]+)(px|rem)$/.exec(s);
  assert.ok(n, `evalLength cannot read "${s}"`);
  return Number(n![1]) * (n![2] === 'rem' ? 16 : 1);
}

/** The declarations of the FIRST top-level-or-layered rule for `selector`, outside any media query. */
function declarations(selector: string): Record<string, string> {
  const esc = selector.replace(/[.[\]]/g, (c) => `\\${c}`);
  const m = new RegExp(`^  ${esc} \\{([^}]*)\\}`, 'm').exec(CSS);
  assert.ok(m, `globals.css no longer has a ${selector} rule`);
  return Object.fromEntries([...m![1]!.matchAll(/([\w-]+):\s*([^;]+);/g)].map((d) => [d[1]!, d[2]!.trim()]));
}

test('(3) the bar, the banner and the one action never overlap — for every phone height, safe area and banner height', () => {
  const dock = declarations('.sn-door-dock');
  assert.equal(dock.position, 'sticky', 'the door no longer docks');
  assert.ok(dock.bottom && dock['--sn-door-rest'], 'the dock lost its offset');
  const DOOR = 56; // the door's own `min-h-[56px]`
  let tried = 0;
  for (const vh of [568, 667, 736, 812, 844, 932]) {
    for (const safe of [0, 20, 34]) {
      // The guest bar: a 3.5rem row + a spacer of at least 0.5rem (the safe area when it is more) + its 1px hairline.
      const bar = box(vh - (56 + Math.max(8, safe) + 1), vh);
      for (const bannerHeight of [0, 96, 121, 150, 190]) {
        tried++;
        const lift = bottomChromeLift([bar], vh);
        const banner = bannerHeight ? bannerBox(lift, bannerHeight, vh, safe) : null;
        // What the banner publishes while it is the full-width sheet: its top edge, from the bottom of the window.
        const vars: Record<string, string> = { '--sn-door-rest': dock['--sn-door-rest']!, ...(banner ? { '--cookie-banner-top': `${Math.round(vh - banner.top)}px` } : {}) };
        const off = evalLength(dock.bottom!, { vars, safe });
        const door = { top: vh - off - DOOR, bottom: vh - off };
        const where = `vh ${vh} · safe ${safe} · banner ${bannerHeight}`;
        assert.equal(overlap(door, bar), 0, `${where}: the action ${door.top}–${door.bottom} runs under the bar ${bar.top}–${bar.bottom}`);
        if (banner) {
          assert.equal(overlap(banner, bar), 0, `${where}: the banner sits on the bar`);
          assert.equal(overlap(door, banner), 0, `${where}: the banner ${banner.top}–${banner.bottom} sits on the action ${door.top}–${door.bottom}`);
          assert.ok(door.bottom <= banner.top, `${where}: the action is not above the banner`);
        }
        assert.ok(door.top >= 64, `${where}: the docked action climbed into the header`);
      }
    }
  }
  assert.equal(tried, 6 * 3 * 5);
  // The measured page: 375 × 812, the bar 747–812, the banner 121 px tall.
  const off = evalLength(dock.bottom!, { vars: { '--sn-door-rest': dock['--sn-door-rest']!, '--cookie-banner-top': '198px' }, safe: 0 });
  assert.deepEqual({ top: 812 - off - DOOR, bottom: 812 - off }, { top: 550, bottom: 606 }, 'the measured first visit: the action stands just above the banner (614–735)');
  assert.equal(evalLength(dock.bottom!, { vars: { '--sn-door-rest': dock['--sn-door-rest']! }, safe: 0 }), 76, 'a returning visitor: the action rests 76 px up, clear of the 65 px bar');
});

test('(4) the page wears it: the door docks, the row draws no box, and an open door returns to its place in view', () => {
  // The banner says where its top is — only as the full-width sheet — and takes the word back when it goes.
  assert.match(BANNER, /const BANNER_TOP_VAR = '--cookie-banner-top';/);
  assert.match(BANNER, /if \(r\.width >= window\.innerWidth - 1\) root\.style\.setProperty\(BANNER_TOP_VAR, `\$\{Math\.round\(window\.innerHeight - r\.top\)\}px`\);/);
  assert.ok((BANNER.match(/root\.style\.removeProperty\(BANNER_TOP_VAR\)/g) ?? []).length >= 2, 'the banner’s top outlives the banner');
  assert.match(declarations('.sn-door-dock').bottom!, /var\(--cookie-banner-top, 0px\)/, 'the dock no longer reads the banner’s top');

  // The door: the signed-out `<details>` itself, docked unless told not to (the Maker's canvas).
  const door = stripComments(read('app/[slug]/_components/get-inside.tsx'));
  assert.match(door, /<details className=\{`group mx-auto max-w-md\$\{dock \? ' sn-door-dock' : ''\}`\} data-get-inside="door">/);
  assert.match(door, /\{dock \? <DoorOpensInView \/> : null\}/);
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.match(body, /<div className="sn-door-row">[\s\S]{0,1600}<GetInside[\s\S]{0,200}dock=\{!isEditorCanvas\}/, 'the door’s row no longer lets it dock, or the canvas docks it');
  // A sticky box moves only inside its parent: the row must draw no box of its own.
  assert.equal(declarations('.sn-door-row').display, 'contents');
  // Opened, it is in its own place again (its choices are not drawn over the cover) and is scrolled into view.
  assert.equal(declarations('.sn-door-dock[open]').position, 'static');
  assert.match(declarations('.sn-door-dock')['scroll-margin-bottom'] ?? '', /var\(--sn-door-rest\)/);
  const view = stripComments(read('app/[slug]/_components/door-opens-in-view.tsx'));
  assert.match(view, /door\.addEventListener\('toggle', onToggle\)/);
  assert.match(view, /if \(!door\.open\) return;[\s\S]*door\.scrollIntoView\(\{ block: 'nearest'/);
  // From `xl` the bar is a side rail: the dock rests near the bottom edge.
  assert.match(CSS, /@media \(min-width: 1280px\) \{\s*\.sn-door-dock \{\s*--sn-door-rest: 1rem;/);
});
