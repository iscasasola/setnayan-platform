/**
 * 🌫 ONE BACKDROP, ONE LOCK, EVERYWHERE — owner 2026-10-25, verbatim: *"there is an issue when a pop up shows and darken
 * on the background. the darken also moves and does not darken and blurr background. back should not move and will not
 * be scrollable or tappable until pop up is gone via tapping the darkened space or closing the popup. just implement it
 * across all"*.
 *
 * The property, held in the shared parts so every overlay inherits it:
 *   1 · `useModalA11y` (the hook EVERY sheet, dialog, side panel and viewer calls) holds the page still the iOS-safe
 *       way (`lockPageScroll`: body pinned at -scrollY, put back on the same pixel) and makes everything behind the
 *       pop-up inert (`isolateOverlay`) — never `body.style.overflow = 'hidden'` alone, which iOS scrolls straight past;
 *   2 · the shared `<Sheet>` draws THE backdrop (`OverlayBackdrop`: fixed to the screen, `.sn-popup-dark`, a drag moves
 *       nothing) and closes on Back (`useBackCloses`);
 *   3 · a hand-made `fixed inset-0` dimmer (`bg-black/…`, `bg-ink/…`, `backdrop-blur…`) may not appear in a new file,
 *       nor grow in an old one — `one-backdrop.baseline.txt` lists the ones still to move, and only ever shrinks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('1 · the one focus hook holds the page still (iOS-safe) and inert behind every modal pop-up', () => {
  const hook = stripComments(read('lib/use-modal-a11y.ts'));
  assert.match(hook, /lockPageScroll\(\)/, 'useModalA11y no longer locks the page');
  assert.match(hook, /isolateOverlay\(container\)/, 'the page behind a pop-up is tappable again');
  assert.match(hook, /unlockPageScroll\(\)/, 'the page is never released');
  assert.doesNotMatch(hook, /body\.style\.overflow\s*=/, "a bare overflow lock is back — iOS scrolls straight past it");

  const lock = stripComments(read('lib/overlay-lock.ts'));
  assert.match(lock, /b\.position = 'fixed'/, 'the body is not pinned — iOS still scrolls the page under the pop-up');
  assert.match(lock, /b\.top = `-\$\{saved\.scrollY\}px`/, 'the pinned body does not hold its scroll position');
  assert.match(lock, /window\.scrollTo\(\{ top: saved\.scrollY/, 'closing does not put the page back on the same pixel');
  assert.match(lock, /lockCount > 0/, 'the lock is not counted — closing an inner sheet would free the page under the outer one');
  assert.match(lock, /inertBehind\(container, isBackdrop, true\)/, 'nothing behind the pop-up is made inert');

});

test('2 · the shared Sheet draws THE backdrop and closes on Back; the backdrop is fixed, dark, blurred and still', () => {
  const sheet = stripComments(read('app/_components/sheet.tsx'));
  assert.match(sheet, /<OverlayBackdrop onClose=\{close\}/, 'the Sheet draws its own dimmer again');
  assert.match(sheet, /useBackCloses\(/, "the phone's Back no longer closes a sheet");
  assert.doesNotMatch(sheet, /sn-popup-dark absolute/, 'the Sheet backdrop is positioned in the page again');

  const bd = stripComments(read('app/_components/overlay-backdrop.tsx'));
  assert.match(bd, /sn-popup-dark fixed inset-0/, 'the backdrop is not fixed to the screen, or not the house dark');
  assert.match(bd, /touch-none/, 'a drag on the backdrop can move the page');
  assert.match(bd, /data-overlay-backdrop/, 'the isolation cannot tell the backdrop from the page');

  const css = read('app/globals.css');
  const rule = /\.sn-popup-dark \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(rule, /backdrop-filter:\s*blur\((\d+)px\)/, 'the popup dark no longer blurs');
  const px = Number(/blur\((\d+)px\)/.exec(rule)?.[1]);
  assert.ok(px >= 6 && px <= 8, `the popup blur is ${px}px — the house rule is 6–8`);
});

/** A dimming class on a full-screen fixed layer — a hand-made backdrop. */
const DIM = /bg-(?:black|ink)\/|bg-\[rgba?\(|backdrop-blur|\bsn-scrim\b/;
export function handMadeBackdrops(src: string): number {
  let n = 0;
  for (const m of stripComments(src).matchAll(/(["'`])((?:(?!\1)[\s\S]){0,600}?)\1/g)) {
    const cls = m[2]!;
    if (/\bfixed\b/.test(cls) && /\binset-0\b/.test(cls) && DIM.test(cls)) n += 1;
  }
  return n;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.tsx') && !p.includes('.test.')) out.push(p);
  }
  return out;
}

const SHARED = new Set(['app/_components/overlay-backdrop.tsx']);
const BASELINE = join(WEB, 'lib', 'one-backdrop.baseline.txt');

export function measureHandMade(): Map<string, number> {
  const found = new Map<string, number>();
  for (const f of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'components')).filter(() => existsSync(join(WEB, 'components')))]) {
    const rel = relative(WEB, f);
    if (SHARED.has(rel)) continue;
    const n = handMadeBackdrops(readFileSync(f, 'utf8'));
    if (n) found.set(rel, n);
  }
  return found;
}

test('3 · no NEW hand-made backdrop, and none grows — the baseline only shrinks', () => {
  const base = new Map(
    readFileSync(BASELINE, 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => {
        const [f, n] = l.split('\t');
        return [f!, Number(n)] as const;
      }),
  );
  const bad: string[] = [];
  for (const [f, n] of measureHandMade()) {
    const allowed = base.get(f) ?? 0;
    if (n > allowed) bad.push(`${f}: ${n} hand-made backdrop(s), baseline ${allowed} — use <OverlayBackdrop> (app/_components/overlay-backdrop.tsx)`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('the check sees the backdrop it was written for, and not a fixed bar', () => {
  assert.equal(handMadeBackdrops('<div className="fixed inset-0 z-50 bg-black/40" />'), 1);
  assert.equal(handMadeBackdrops('<div className={`fixed inset-0 ${dim ? "bg-ink/30 backdrop-blur-[1px]" : ""}`} />'), 1);
  assert.equal(handMadeBackdrops('<nav className="fixed inset-x-0 bottom-0 bg-cream/90" />'), 0);
});
