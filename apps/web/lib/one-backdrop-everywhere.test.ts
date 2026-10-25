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

/*
 * 🩹 A TAP ON THE DARK MUST REACH SOMETHING — owner on his iPhone, 2026-10-25, the People › Invite sheet: *"I cannot tap
 * out the screen"*. Test 1 holds that the page lock makes everything beside the pop-up inert; it never held that the
 * pop-up's OWN close layer survives that walk — and it did not: `GuestPopup`, the Maker sheet, the calendar and ⓘ
 * pop-ups and ~15 hand-made sheets draw their close button `absolute inset-0` inside their fixed root, beside the panel,
 * and `isolateOverlay(panel)` made it `inert` (measured in Playwright WebKit/iPhone and Chromium/Pixel: the tap landed on
 * the root, onClose never ran). Two holds, so neither half can drift back:
 *   4 · the walk keeps the backdrop — marked, full-screen fixed, or a full-screen BUTTON in any position;
 *   5 · a dark that takes no tap (`sn-popup-dark pointer-events-none`) is not drawn over a separate close layer — the
 *       dark IS the close button (`<OverlayBackdrop>`), except the Maker sheet, whose dark carries a hole round the live
 *       preview the button must not have, and whose button therefore wears `data-overlay-backdrop`.
 */
test('4 · the page lock keeps the pop-up’s own close layer live — a tap on the dark always reaches it', async () => {
  const { keepsBesidePopup } = await import('./overlay-lock');
  const vp = { viewportWidth: 390, viewportHeight: 844 };
  const full = { width: 390, height: 844 };
  // The shared backdrop: marked.
  assert.equal(keepsBesidePopup({ marked: true, tag: 'BUTTON', position: 'fixed', ...full, ...vp }), true);
  // A full-screen fixed layer (a hand-made fixed dimmer, a pop-up's root).
  assert.equal(keepsBesidePopup({ marked: false, tag: 'DIV', position: 'fixed', ...full, ...vp }), true);
  // THE ONE THAT BROKE: an `absolute inset-0` close button inside the pop-up's fixed root.
  assert.equal(keepsBesidePopup({ marked: false, tag: 'BUTTON', position: 'absolute', ...full, ...vp }), true, 'a full-screen close button beside the panel is made inert — a tap on the dark closes nothing');
  assert.equal(keepsBesidePopup({ marked: false, tag: 'button', position: 'absolute', ...full, ...vp }), true);
  // …and nothing else is let off: page content stays out of reach.
  assert.equal(keepsBesidePopup({ marked: false, tag: 'DIV', position: 'absolute', ...full, ...vp }), false, 'a full-screen page layer stays live behind a pop-up');
  assert.equal(keepsBesidePopup({ marked: false, tag: 'BUTTON', position: 'static', ...full, ...vp }), false);
  assert.equal(keepsBesidePopup({ marked: false, tag: 'BUTTON', position: 'absolute', width: 44, height: 44, ...vp }), false, 'a small button behind the pop-up stays live');
  assert.equal(keepsBesidePopup({ marked: false, tag: 'NAV', position: 'fixed', width: 390, height: 64, ...vp }), false, 'the bottom bar stays live behind a pop-up');
  // The DOM reader asks exactly this — nothing of its own beside it.
  const lock = stripComments(read('lib/overlay-lock.ts'));
  const reader = lock.slice(lock.indexOf('function isBackdrop('), lock.indexOf('export function isolateOverlay('));
  assert.match(reader, /if \(el\.hasAttribute\('data-overlay-backdrop'\)\) return true;/);
  assert.match(reader, /return keepsBesidePopup\(\{/, 'the page lock decides which layer stays live somewhere else');
  assert.doesNotMatch(reader, /position !== 'fixed'\) return false/, 'the fixed-only rule is back — an absolute close button goes inert');
});

test('5 · a dark that takes no tap is never drawn over a separate close layer — the dark IS the close button', () => {
  const DARK_NO_TAP = /sn-popup-dark pointer-events-none/;
  /* The two that may: the Maker sheet (the dark carries the preview hole; its button is marked) and "a scene of your
     own" (the dark sits under the picker's own close button INSIDE the pop-up's container, which the walk never touches). */
  const MAY = new Map<string, RegExp>([
    ['app/dashboard/[eventId]/launch/_components/stages-studio-parts.tsx', /<button type="button" aria-label="Close" data-overlay-backdrop="" data-maker-sheet-scrim="" onClick=\{onClose\}/],
    ['app/dashboard/[eventId]/launch/_components/add-part-sheet.tsx', /usePopupBehind\(\{ root, panel: root, onClose \}\);/],
  ]);
  const bad: string[] = [];
  let seen = 0;
  for (const f of walk(join(WEB, 'app'))) {
    const rel = relative(WEB, f);
    const src = stripComments(readFileSync(f, 'utf8'));
    if (!DARK_NO_TAP.test(src)) continue;
    seen += 1;
    const why = MAY.get(rel);
    if (!why) bad.push(`${rel}: a dark that takes no tap over a separate close layer — draw <OverlayBackdrop onClose> (the dark IS the button)`);
    else if (!why.test(src)) bad.push(`${rel}: its exception no longer holds (${why})`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
  assert.equal(seen, MAY.size, 'anti-vacuity: the two allowed darks were not both found');
  /* The pop-ups that used the old pair now draw the one backdrop. */
  for (const rel of [
    'app/dashboard/[eventId]/guests/_components/guest-popup.tsx',
    'app/dashboard/[eventId]/studio/mood-board/_components/colour-picker-sheet.tsx',
    'app/dashboard/[eventId]/vendors/_components/lock-milestone.tsx',
    'app/_components/calendar.tsx',
    'app/_components/explain.tsx',
  ]) {
    assert.match(stripComments(read(rel)), /<OverlayBackdrop onClose=\{onClose\} \/>/, `${rel}: the dark is not the close button`);
  }
});
