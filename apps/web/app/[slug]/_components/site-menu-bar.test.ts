/**
 * The camera slot in the live menu bar, and the veil's retirement.
 *
 * Both are owner rulings that a later tidy-up could silently reverse, and both
 * were caught by the owner looking at his phone rather than by any check —
 * twice in two days. These are the assertions that make the third time fail
 * loudly instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BAR = readFileSync(join(HERE, 'site-menu-bar.tsx'), 'utf8');
const SITE = readFileSync(join(HERE, 'site-body.tsx'), 'utf8');
const VEIL = readFileSync(join(HERE, 'reveal', 'reveal-overlay.tsx'), 'utf8');
const HANDOFF = readFileSync(join(HERE, 'std-film-handoff.tsx'), 'utf8');

test('menu bar · icon AND label on every slot — never icons alone', () => {
  // The owner's design, and the strongest convention in the PH market: the
  // labelled grid every GCash user already knows. The bar shipped as uppercase
  // mono TEXT with no icons at all, and he said so on sight.
  assert.match(BAR, /from 'lucide-react'/);
  // Every slot renders an icon component next to its label.
  for (const icon of ['Home', 'Info', 'BookOpen', 'Camera', 'Images', 'Radio', 'User']) {
    assert.ok(BAR.includes(icon), `the bar has no ${icon} icon`);
  }
  // …and the label still renders — icons alone would be a regression.
  assert.match(BAR, /\{slot\.label\}/);
  // The old mono-uppercase treatment must be gone.
  assert.ok(!BAR.includes('uppercase tracking-[0.12em]'), 'the old text-only bar chrome survives');
});

test('menu bar · labels can never wrap, whatever they say', () => {
  // A label that wraps grows its slot and tilts the entire bar.
  assert.match(BAR, /whitespace-nowrap/);
  assert.match(BAR, /overflow-hidden/);
  assert.match(BAR, /min-w-0/);
});

test('menu bar · a home-indicator strip keeps labels off the home bar', () => {
  assert.match(BAR, /safe-area-inset-bottom/);
});

test('menu bar · Watch has its OWN slot and never takes the gallery\'s', () => {
  // Owner: "papic button as well" — on the day a guest needs the camera AND the
  // gallery, so a broadcast may not displace either.
  // The slot now comes from the resolver, so the decision is pinned in TWO
  // places: the resolver emits a distinct `watch` key (never reusing gallery's),
  // and the bar has an icon for it.
  const NAV = readFileSync(join(HERE, '..', '_lib', 'site-nav.ts'), 'utf8');
  assert.match(NAV, /key: 'watch'/, 'the resolver no longer emits a watch slot');
  assert.ok(
    !/key: 'gallery'[^}]*Watch/.test(NAV),
    'the watch label has been attached to the gallery slot — it must have its own',
  );
  assert.match(BAR, /watch: Radio/, 'the bar has no icon for the watch slot');
});

test('menu bar · a closed camera is DRAWN and locked, never absent', () => {
  // Owner 2026-08-03: the host holds the switch, but the camera is part of what
  // the invitation promises. An absent slot says the wedding has no camera; a
  // dead button says the app is broken. Locked says neither.
  assert.match(BAR, /slot\.state === 'locked'/, 'the bar no longer renders a locked state');
  assert.match(BAR, /aria-disabled="true"/);
  // The locked branch must not be a link — a link would navigate.
  const locked = BAR.slice(BAR.indexOf('aria-disabled'));
  assert.ok(!locked.slice(0, 400).includes('<a'), 'the locked camera is still a link');
  // And it must carry the reason.
  assert.match(BAR, /title=\{slot\.lockedReason\}/);
});

test('menu bar · both trees offer the camera, and both lock it rather than hide it', () => {
  // Both trees resolve the nav, and each passes a camera destination.
  const resolves = SITE.match(/resolveSiteNav\(\{/g) ?? [];
  assert.equal(resolves.length, 2, 'expected BOTH the anonymous and guest trees to resolve the nav');
  const dests = SITE.match(/camera: /g) ?? [];
  assert.equal(dests.length, 2, 'a tree does not pass a camera destination');
  // The LOCK itself now lives in one place — the resolver — instead of being
  // re-typed per tree. That is the point of the move: one rule, not two copies
  // that can drift. A missing destination must LOCK, never hide.
  const NAV2 = readFileSync(join(HERE, '..', '_lib', 'site-nav.ts'), 'utf8');
  assert.match(NAV2, /key: 'camera'[\s\S]{0,200}state: 'locked'/,
    'the resolver hides the camera instead of locking it');
});

test('menu bar · the camera follows the HOST SWITCH, never the calendar', () => {
  // Owner 2026-08-03: "the papic service will always run but the host of the
  // event has the power to allow use and not allow use."
  //
  // ⚠ THE MISTAKE THIS PINS. The first mount gated the slot on `dayOfPhase ===
  // 'live'` / `isLive`, so on a wedding months away the camera resolved to null
  // and vanished — while the resolver in _lib/site-nav.ts had the rule RIGHT.
  // The correct rule was written and then not used. Neither half failed.
  const cameraBlocks = SITE.split('hostAllowsCamera:').slice(1).map((b) => b.slice(0, 320));
  assert.equal(cameraBlocks.length, 2, 'expected the camera gate in both trees');
  for (const block of cameraBlocks) {
    assert.ok(
      !/\bisLive\b/.test(block) && !/dayOfPhase === 'live'/.test(block),
      'the camera slot is gated on the calendar — the gate is the host switch',
    );
    assert.ok(/hostCameraOpen/.test(block), 'the camera slot does not consult the host switch');
  }
});

test('menu bar · the switch is read on EVERY day, not only the wedding day', () => {
  // If the loader only asks during the live window, the slot silently reverts to
  // "closed" on every other day and the fix above is undone from underneath.
  const L = readFileSync(join(HERE, '..', '_lib', 'loaders.ts'), 'utf8');
  assert.match(
    L,
    /const hostCameraOpen = await eventPapicGuestActive\(admin, event\.event_id\);/,
    'hostCameraOpen must be resolved unconditionally',
  );
  const line = L.slice(L.indexOf('const hostCameraOpen'));
  assert.ok(
    !line.slice(0, 200).includes("dayOfPhase === 'live'"),
    'the switch read is wrapped in a live-window check again',
  );
});

test('menu bar · Papic sits in the MIDDLE of the bar', () => {
  // The widest, easiest place for a thumb — on the day, shooting is what people
  // are actually doing.
  assert.match(BAR, /const mid = Math\.ceil\(rest\.length \/ 2\);/);
  assert.ok(
    BAR.indexOf('{before.map') < BAR.indexOf('{camera ?'),
    'the camera is not between the two halves of the tab list',
  );
  assert.ok(BAR.indexOf('{camera ?') < BAR.indexOf('{after.map'));
});

test('veil · retires when the visitor steps out to the site, and returns with the film', () => {
  // The veil was built to persist by owner ruling (2026-06-18/19) — right when
  // the film WAS the page. Once the site moved underneath it, that ruling
  // silently became a decision about the whole website.
  assert.match(VEIL, /addEventListener\(STD_FILM_EXIT_EVENT, retire\)/);
  assert.match(VEIL, /addEventListener\(STD_FILM_RETURN_EVENT, restore\)/);
  assert.match(VEIL, /const restore = \(\) => setGone\(false\)/);
});

test('veil · the event names are imported, never re-typed', () => {
  // A hand-copied name drifts silently and the veil simply stops standing down,
  // with nothing failing.
  assert.match(VEIL, /import \{ STD_FILM_EXIT_EVENT \} from '\.\.\/save-the-date-film';/);
  assert.match(VEIL, /import \{ STD_FILM_RETURN_EVENT \} from '\.\.\/std-film-handoff';/);
  assert.ok(!/'std:film-(exit|return)'/.test(VEIL), 'the veil hard-codes an event name');
  assert.match(HANDOFF, /export const STD_FILM_RETURN_EVENT = 'std:film-return';/);
});
