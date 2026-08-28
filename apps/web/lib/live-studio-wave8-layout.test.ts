/**
 * ⭐ WAVE 8 — CHROME-LESS, SCROLL-FREE CONTROLLER
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25 § 4g:
 * "we will achieve the exact look on our design prototype. scroll free
 * controller. nothing under and above it.")
 *
 * ── WHY THESE ARE SOURCE ASSERTIONS ──────────────────────────────────────────
 * Every claim § 4g makes is a claim about LAYOUT, and layout is exactly what a
 * unit test cannot execute: there is no browser here, no viewport, no computed
 * style. Rendering the page is not an option either — it is a server component
 * that reads Supabase, the service-role client and the live SKU catalog.
 *
 * So these lock the STRUCTURAL DECISIONS a future edit could silently undo, in
 * the same shape lib/live-studio-publish.test.ts already uses for its WIRING
 * tests (readFileSync + assert on the source). They are deliberately narrow: each
 * one names a specific regression that would ship a broken controller to an
 * operator running a ceremony they cannot re-run.
 *
 * What they do NOT and cannot check: actual pixel overflow at 360×640. That was
 * verified by hand against the layout budget (see the PR body) — this file's job
 * is to make sure the primitives that keep it fitting are still there.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => readFileSync(resolve(WEB, rel), 'utf8');

/**
 * Source with COMMENTS REMOVED.
 *
 * These files are heavily commented — deliberately, they carry the owner locks —
 * and several of those comments quote the very strings these tests forbid ("Unlock
 * to use" is named in a comment that exists to say it must never come back). A
 * naive substring check on the raw file reads its own documentation as a
 * violation, so anything asserting "this must NOT appear" runs against this.
 */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '') // block + JSX comments
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l)) // line comments + jsdoc continuations
    .join('\n');

const CONTROLLER = 'app/panood/control/[eventId]/page.tsx';
const LEGACY_STUB = 'app/dashboard/[eventId]/studio/live-studio-control/setup/page.tsx';

/* ══════════════════════════════════════════════════════════════════════════════
   1 · THE ESCAPE — chrome-less because it is not under /dashboard
   ══════════════════════════════════════════════════════════════════════════════ */

test('WAVE 8 — the controller file lives OUTSIDE the dashboard tree', () => {
  // This is the entire chrome-escape. `dashboard/[eventId]/layout.tsx` mounts the
  // SidebarShell top bar, CustomerBottomNav, CustomerNavFab and
  // CustomerSectionSubnav, and an App Router page cannot opt out of an ancestor
  // layout. Moving the file back under /dashboard silently restores all of it.
  assert.ok(existsSync(resolve(WEB, CONTROLLER)), `${CONTROLLER} is missing`);
  assert.ok(
    !existsSync(
      resolve(WEB, 'app/dashboard/[eventId]/studio/live-studio-control/setup/actions.ts'),
    ),
    'the controller implementation is back under /dashboard — the chrome came with it',
  );
});

test('WAVE 8 — it follows the /panood/program precedent, not a second mechanism', () => {
  // `/panood/program/[eventId]` is the existing chrome-less route and its header
  // records WHY the in-tree `fixed inset-0` alternative does not work here (the
  // shell's <main> carries a view-transition-name, which becomes the containing
  // block for fixed descendants). Same tree, same escape.
  assert.ok(existsSync(resolve(WEB, 'app/panood/program/[eventId]/page.tsx')));
  assert.ok(existsSync(resolve(WEB, 'app/panood/control/[eventId]/page.tsx')));
});

test('WAVE 8 — no route group or layout was added under /panood that could re-introduce chrome', () => {
  // A layout.tsx anywhere on the way down would wrap the controller again. The
  // root layout is the only ancestor it may have.
  for (const rel of ['app/panood', 'app/panood/control', 'app/panood/control/[eventId]']) {
    assert.ok(
      !existsSync(resolve(WEB, rel, 'layout.tsx')),
      `${rel}/layout.tsx exists — the controller is no longer chrome-less`,
    );
  }
});

test('WAVE 8 — the OLD dashboard URL still resolves, as a redirect only', () => {
  const stub = read(LEGACY_STUB);
  assert.match(stub, /redirect\(liveStudioControlPath\(eventId\)\)/);
  // Flag-dark exactly as the page it replaces: a direct hit while the flag is off
  // must behave as if the route does not exist, not redirect into a dark surface.
  assert.match(stub, /if \(!liveStudioRoamEnabled\(\)\) notFound\(\)/);
});

test('WAVE 8 — no other route lost its chrome (nothing else moved out of /dashboard)', () => {
  // The one thing worse than a chrome-full controller is a chrome-LESS dashboard.
  // `app/panood/control` is the only addition to the chrome-less tree; assert the
  // rest of /panood is exactly the set that was already there.
  const panood = readdirSync(resolve(WEB, 'app/panood'))
    .filter((n) => statSync(join(resolve(WEB, 'app/panood'), n)).isDirectory())
    .sort();
  assert.deepEqual(panood, ['cam', 'control', 'demo', 'program']);
});

/* ══════════════════════════════════════════════════════════════════════════════
   2 · THE VIEWPORT — 100dvh, safe areas, and nothing that scrolls the page
   ══════════════════════════════════════════════════════════════════════════════ */

test('WAVE 8 — the shell is fixed at 100dvh, NOT 100vh', () => {
  const src = read(CONTROLLER);
  assert.ok(src.includes("height: '100dvh'"), 'the shell must be sized in dvh');
  // The whole point: mobile browser chrome resizes the viewport mid-session, and
  // `vh` freezes at the largest size — clipping the transport row exactly when the
  // operator reaches for Go live.
  assert.ok(!/height:\s*'100vh'/.test(src), 'a 100vh height crept back in');
  assert.ok(!/\bh-screen\b/.test(src), 'h-screen is 100vh under another name');
  assert.match(src, /fixed inset-0[^"]*overflow-hidden/);
});

test('WAVE 8 — safe-area insets are honoured on all four sides', () => {
  const src = read(CONTROLLER);
  for (const side of ['top', 'bottom', 'left', 'right']) {
    assert.ok(
      src.includes(`env(safe-area-inset-${side})`),
      `safe-area-inset-${side} is not honoured — the tally or Go live can sit under system UI`,
    );
  }
});

test('WAVE 8 — the page body is locked, and the lock is cleaned up', () => {
  const lock = read('app/panood/control/[eventId]/_components/viewport-lock.tsx');
  assert.match(lock, /document\.documentElement/);
  assert.match(lock, /overflow = 'hidden'/);
  // Leaking the lock onto the next route would break every other page in the app.
  assert.match(lock, /return \(\) => \{/);
  assert.ok(lock.includes('prevHtml') && lock.includes('prevBody'), 'must restore prior values');
  assert.match(read(CONTROLLER), /<ViewportLock \/>/);
});

test('WAVE 8 — the camera-channel grid is the only vertical scroller in the operating loop', () => {
  const src = read(CONTROLLER);

  // The grid scroller, with min-h-0 — without it a flex child's automatic
  // min-height is its CONTENT, so the "scroller" grows the shell instead of
  // scrolling and the page overflows anyway.
  assert.match(src, /data-testid="lsc-channel-scroller"[\s\S]{0,200}min-h-0 flex-1[\s\S]{0,80}overflow-y-auto/);

  // Exactly TWO vertical scrollers are permitted in the whole file: this grid, and
  // the window-warning strip — which is capped in dvh and returns null in normal
  // operation. If this count grows, a new scroller appeared and § 4g slipped.
  const scrollers = code(CONTROLLER).match(/overflow-y-auto/g) ?? [];
  assert.equal(
    scrollers.length,
    2,
    `expected exactly 2 overflow-y-auto (grid + bounded window strip), found ${scrollers.length}`,
  );
  // The bounded window-warning strip: capped in dvh so it can never grow into
  // the transport row, and it yields the monitor's height too (globals.css
  // `[data-lsc-left]:has([data-lsc-window]:not(:empty))`).
  assert.match(src, /data-lsc-window\s*\n\s*className="max-h-\[18dvh\] shrink-0 overflow-y-auto overscroll-contain empty:hidden"/);
});

test('WAVE 8 — the monitor yields to a broadcast warning (measured: grid was 27px without it)', () => {
  const css = read('app/globals.css');
  // MEASURED at 360×640 with both Wave 7 warnings up: the grid fell to 27px. The
  // monitor gives the space back for as long as a warning shows. CSS has no
  // previous-sibling combinator, hence `:has()` on the column rather than a utility.
  assert.match(css, /\[data-lsc-left\]:has\(\[data-lsc-window\]:not\(:empty\)\) \[data-lsc-monitor\]/);
  const src = read(CONTROLLER);
  assert.match(src, /data-lsc-left/);
  assert.match(src, /data-lsc-monitor/);
  // `aspect-video` alone is a rigid 56.25% of the width. On a 360×640 phone that
  // is ~190px the monitor cannot give back, and everything below it is squeezed.
  // The dvh cap is what makes the picture yield before the controls do.
  assert.match(src, /aspect-video max-h-\[34dvh\][\s\S]{0,120}lg:max-h-\[46dvh\]/);
});

test('WAVE 8 — status banners float instead of pushing the layout', () => {
  const src = read(CONTROLLER);
  // ~20 possible banners; stacked in flow, ONE of them is enough to push the
  // transport row off a viewport that cannot scroll.
  assert.match(src, /pointer-events-none fixed inset-x-0[\s\S]{0,200}z-30/);
  assert.match(src, /<ToastLayer>/);
  const toast = read('app/panood/control/[eventId]/_components/toast-layer.tsx');
  // They have no dismiss of their own and live as long as the query string does,
  // so a floating layer MUST time out or it camps on the monitor forever.
  assert.match(toast, /setTimeout/);
});

/* ══════════════════════════════════════════════════════════════════════════════
   3 · THE DESKTOP BREAKPOINT — monitor left, grid right (the prototype's toggle)
   ══════════════════════════════════════════════════════════════════════════════ */

test('WAVE 8 — desktop is a real two-column grid, same components', () => {
  const src = read(CONTROLLER);
  // The prototype's Desktop arrangement: monitor + transport LEFT (1.55fr), the
  // camera-channel strip RIGHT (1fr). Same ratio the prototype uses.
  assert.match(src, /lg:grid lg:grid-cols-\[minmax\(0,1\.55fr\)_minmax\(0,1fr\)\]/);
  // The left column must not be able to scroll a fixed viewport either.
  assert.match(src, /lg:overflow-hidden/);
});

/* ══════════════════════════════════════════════════════════════════════════════
   4 · NOTHING FROM WAVES 1–7 WAS DROPPED TO MAKE IT FIT
   ══════════════════════════════════════════════════════════════════════════════ */

test('WAVE 8 — the whole operating loop is still on the fixed surface', () => {
  const src = read(CONTROLLER);
  const loop: [string, RegExp][] = [
    ['CH 1 monitor', /aria-label="Channel 1 — the controlled screen"/],
    ['transport', /<TransportRow/],
    ['guest-pick', /action=\{setGuestPick\}/],
    ['window strip (Wave 7)', /<BroadcastWindowStrip/],
    ['overlay icon row', /aria-label="Channel 1 overlays"/],
    ['channel grid', /<ChannelTileCard/],
    ['unlock bar', /lock\.unlockCtaLabel/],
    ['path to air (Wave 5)', /<ProgramBridgeHost/],
  ];
  for (const [name, re] of loop) assert.match(src, re, `${name} is missing from the controller`);
});

test('WAVE 8 — the ProgramBridgeHost is NOT inside the sheet (it would unmount mid-broadcast)', () => {
  const src = code(CONTROLLER);
  const bridge = src.indexOf('<ProgramBridgeHost');
  const sheetOpen = src.indexOf('<SetupSheet>');
  assert.ok(bridge > -1 && sheetOpen > -1);
  // It installs the window bridge in an effect and disposes it on unmount. Closing
  // the sheet would kill a host's live program output mid-ceremony.
  assert.ok(
    bridge < sheetOpen,
    'ProgramBridgeHost moved inside SetupSheet — closing the sheet would kill the path to air',
  );
});

test('WAVE 8 — no padlocks/dimming crept back onto the tiles (§ 4d is intact)', () => {
  // Comment-stripped: the file's own docs quote both forbidden strings in order to
  // record that they are forbidden.
  const src = code(CONTROLLER);
  assert.ok(!/grayscale/.test(src), 'a greyscale tile treatment is back — § 4d forbids dimming');
  assert.ok(
    !/Unlock to use/.test(src),
    '"Unlock to use" is the retired copy; § 4d locks "Unlock to broadcast"',
  );
  assert.match(src, /UNLOCK_TO_BROADCAST_LABEL/);
});

test('WAVE 8 — every setup section survived the move into the sheet', () => {
  const src = code(CONTROLLER);
  const sheet = src.slice(src.indexOf('<SetupSheet>'), src.indexOf('</SetupSheet>'));
  for (const id of ['connect', 'add-camera']) {
    assert.ok(sheet.includes(`id="${id}"`), `#${id} is no longer inside the setup sheet`);
  }
  for (const heading of [
    'Your YouTube channel',
    'Manage your channels',
    'What sits on the broadcast',
    'How guests watch',
  ]) {
    assert.ok(sheet.includes(heading), `"${heading}" was dropped, not moved`);
  }
});

test('WAVE 8 — the existing in-page anchors still have a destination', () => {
  const src = read(CONTROLLER);
  // `#connect` (transport's honest "connect first" link) and `#add-camera` (the
  // grid's + tile) used to rely on page scroll. They now open the sheet, so the
  // sheet must actually listen for them.
  assert.match(src, /connectHref="#connect"/);
  assert.match(src, /href="#add-camera"/);
  const sheet = read('app/panood/control/[eventId]/_components/setup-sheet.tsx');
  for (const anchor of ['connect', 'add-camera', 'setup']) {
    assert.ok(sheet.includes(`'${anchor}'`), `the sheet does not handle #${anchor}`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   5 · THE WAY OUT + ACCESSIBILITY
   ══════════════════════════════════════════════════════════════════════════════ */

test('WAVE 8 — removing the chrome did not strand the operator', () => {
  const src = read(CONTROLLER);
  // The sidebar, bottom nav and account plaque were every route back. The status
  // strip's exit link is now the only one, so it must be labelled and reachable.
  assert.match(src, /aria-label="Leave the controller — back to Live Studio"/);
  assert.match(src, /href=\{detailHref\}/);
});

test('WAVE 8 — keyboard focus stays visible on the controls the chrome-less surface owns', () => {
  const src = read(CONTROLLER);
  // The exit link and the Setup chip are new/re-styled here; both must show focus.
  const focusRings = src.match(/focus-visible:outline-terracotta/g) ?? [];
  assert.ok(focusRings.length >= 2, `expected visible focus on the new controls, found ${focusRings.length}`);
});

test('WAVE 8 — the setup sheet reuses the shared a11y primitive rather than hand-rolling a dialog', () => {
  const sheet = read('app/panood/control/[eventId]/_components/setup-sheet.tsx');
  assert.match(sheet, /from '@\/app\/_components\/sheet'/);
  // role=dialog / aria-modal / ESC / focus trap / focus restore / scroll lock all
  // come from <Sheet> → lib/use-modal-a11y.
  const primitive = read('app/_components/sheet.tsx');
  assert.match(primitive, /role="dialog"/);
  assert.match(primitive, /aria-modal="true"/);
  assert.match(primitive, /useModalA11y/);
});

test('WAVE 8 — reduced motion is respected by the one scroll animation added', () => {
  const sheet = read('app/panood/control/[eventId]/_components/setup-sheet.tsx');
  assert.match(sheet, /prefers-reduced-motion: reduce/);
  assert.match(sheet, /behavior: reduced \? 'auto' : 'smooth'/);
});

/* ══════════════════════════════════════════════════════════════════════════════
   6 · FLAG-DARK — nothing on a live surface changes with the flag off
   ══════════════════════════════════════════════════════════════════════════════ */

test('WAVE 8 — both the controller and its redirect stub 404 while the flag is off', () => {
  for (const rel of [CONTROLLER, LEGACY_STUB]) {
    assert.match(
      read(rel),
      /if \(!liveStudioRoamEnabled\(\)\) notFound\(\)/,
      `${rel} is reachable with the flag off`,
    );
  }
});

test('WAVE 8 — the shared <Sheet> `wide` prop is additive (existing callers unchanged)', () => {
  const primitive = read('app/_components/sheet.tsx');
  // A default of false is what makes this safe to add to a primitive other
  // surfaces already mount.
  assert.match(primitive, /wide = false/);
  // ⚠ THE BREAKPOINT IS DELIBERATELY NOT PINNED HERE ANY MORE, AND THIS IS NOT A
  // WEAKENING. This line read `sm:w-[min(34rem,92vw)]' : 'sm:w-[22rem]` and went
  // red on 2026-08-28 when the sheet's dock point moved from `sm:` to `lg:` —
  // a change about something else entirely (the drawer was docking at 640px
  // while the phone bottom bar stays on screen to 1023px, so the app rendered
  // phone chrome and a desktop drawer at once).
  //
  // 🔑 WHAT THIS TEST IS ABOUT IS THAT `wide` IS ADDITIVE: it defaults false, and
  // it chooses between two widths at ONE breakpoint. That is still asserted, on
  // both halves. The breakpoint itself is now pinned harder than a literal ever
  // did, by app/_components/sheet-agrees-with-the-nav.test.ts, which reads it out
  // of the sheet AND the bottom nav and fails when the two disagree.
  const ternary = /wide \? '([a-z0-9]+):w-\[min\(34rem,92vw\)\]' : '([a-z0-9]+):w-\[22rem\]'/.exec(
    primitive,
  );
  assert.ok(ternary, 'the wide/narrow width ternary is gone from the sheet primitive');
  assert.equal(
    ternary![1],
    ternary![2],
    'the wide and narrow drawer widths flip at DIFFERENT breakpoints — one of them is stranded',
  );
});

test('WAVE 8 — the window strip `compact` prop is additive and clamps rather than deletes', () => {
  const strip = read('app/panood/control/[eventId]/_components/broadcast-window-strip.tsx');
  assert.match(strip, /compact = false/);
  // line-clamp is a VISUAL clamp: the sentence stays in the DOM and for AT. The
  // headline and the "Add another day" button are never clamped.
  assert.match(strip, /line-clamp-2/);
  assert.match(strip, /\{action \? <span className="shrink-0">\{action\}<\/span> : null\}/);
});
