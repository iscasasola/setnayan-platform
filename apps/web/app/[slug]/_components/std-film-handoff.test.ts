/**
 * The Save-the-Date handoff — the safety property, pinned as a source scan.
 *
 * ── WHAT THIS PROTECTS ──────────────────────────────────────────────────────
 * The cinematic opening is a PAID product. The way out of the film must not
 * exist until the film has actually finished, and "does not exist" has to mean
 * NOT MOUNTED — not hidden, not disabled, not `pointer-events-none`.
 *
 * Every beat node in save-the-date-film.tsx is mounted for the whole film and
 * merely faded, using `pointer-events-none` + `aria-hidden`. NEITHER removes an
 * element from the tab order. So a button written into the closing beat without
 * an `idx === closeIdx` guard is Tab-reachable from the first frame — under the
 * veil, before the music, the couple's clip or the gallery have played. Two
 * keystrokes would skip everything they bought. That flaw was caught in review
 * before it shipped; this test is what stops it coming back.
 *
 * ── WHY A SOURCE SCAN ───────────────────────────────────────────────────────
 * There is no DOM under `tsx --test` and the film needs WebGL, audio, timers
 * and a reveal event to reach its closing beat. So this asserts the WIRING,
 * which is the thing that regresses: someone edits the beat and drops the
 * guard. A behavioural test belongs in the e2e suite.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILM = readFileSync(join(HERE, 'save-the-date-film.tsx'), 'utf8');
const HANDOFF = readFileSync(join(HERE, 'std-film-handoff.tsx'), 'utf8');

test('handoff · the way out is MOUNTED on the closing beat, never merely hidden', () => {
  // The exact guard. Both halves matter: `canExit` keeps it out of the flag-off
  // path entirely, and `idx === closeIdx` keeps it out of the DOM until the
  // film is over.
  assert.match(
    FILM,
    /\{canExit && idx === closeIdx \?/,
    'the exit must be gated on BOTH canExit and the active closing beat',
  );

  // It must not have been "hidden" instead — the failure mode this file exists
  // for. A hidden button is still focusable.
  const exitBlock = FILM.slice(FILM.indexOf('{canExit && idx === closeIdx ?'));
  const exitButton = exitBlock.slice(0, exitBlock.indexOf('</button>'));
  // Only the BUTTON's own presentation matters. `aria-hidden` on a decorative
  // child (the ↓ glyph) is correct and must not trip this.
  const buttonTag = exitButton.slice(exitButton.indexOf('<button'));
  const classNames = [...buttonTag.matchAll(/className=\{?`?([^`"}]*)/g)]
    .map((m) => m[1] ?? '')
    .join(' ');
  for (const smell of ['pointer-events-none', 'opacity-0', 'invisible', 'sr-only', 'hidden']) {
    assert.ok(
      !classNames.includes(smell),
      `the exit button's own classes include "${smell}" — hiding a button does not remove ` +
        `it from the tab order. Gate it on the active beat instead.`,
    );
  }
  assert.ok(
    !/<button[^>]*\bhidden\b/.test(buttonTag) && !/<button[^>]*aria-hidden/.test(buttonTag),
    'the exit button is itself hidden from assistive tech or the layout — gate it, do not hide it',
  );
});

test('handoff · the dispatcher and the listener share one event name', () => {
  // A hand-typed string on each side would drift silently and the button would
  // simply stop working, with nothing failing.
  assert.match(FILM, /export const STD_FILM_EXIT_EVENT = 'std:film-exit';/);
  assert.match(HANDOFF, /import \{ STD_FILM_EXIT_EVENT \} from '\.\/save-the-date-film';/);
  assert.ok(
    !/'std:film-exit'/.test(HANDOFF),
    'the handoff hard-codes the event name instead of importing it — it will drift',
  );
});

test('handoff · leaving the film is reversible', () => {
  // Nothing the couple paid for may be spendable once. The way back is what
  // makes an in-place lift acceptable instead of a navigation.
  assert.match(HANDOFF, /Watch our film again/);
  assert.match(HANDOFF, /setShowFilm\(true\)/);
});

test('handoff · the site is always in the tree, so leaving costs no fetch', () => {
  // `children` must render unconditionally; only the film's visibility changes.
  // If someone makes the body conditional, going back and forth re-fetches.
  const body = HANDOFF.slice(HANDOFF.indexOf('return ('));
  assert.match(body, /\{children\}/);
  assert.ok(
    !/\{showFilm \? [^}]*children/.test(body),
    'the browsable body must not be gated on showFilm',
  );
});

test('handoff · EVERY save-the-date event mounts the wrapper — no flag gates the way out', () => {
  // ⚠ THIS TEST WAS INVERTED ON 2026-08-05, and the reason is the point.
  // It used to assert the opposite: that ONLY `plan.openBrowse` wrapped, and
  // that `canExit={plan.openBrowse}`. That gate was real, and on the one real
  // wedding site (`/cale-ice`, open-browse FALSE) it meant the film was the
  // ENTIRE guest experience — `stdFilmView()` alone renders no RSVP, no
  // details, no seat. They were not covered by the film; they were never
  // mounted. And because the exit carried the same flag, the way out shipped in
  // #4096 could not reach a real event either. Verified on the live page: the
  // whole served text was film beats plus "Add to calendar".
  //
  // The gate conflated two questions. "May this visitor browse the new open
  // site?" is what `openBrowse` decides. "May this visitor LEAVE a full-screen
  // takeover?" was never a flag's business.
  const SITE = readFileSync(join(HERE, 'site-body.tsx'), 'utf8');
  assert.match(
    SITE,
    /<StdFilmHandoff film=\{stdFilmView\(\)\}>\{normalBody\(\)\}<\/StdFilmHandoff>/,
    'the save-the-date body no longer mounts the handoff — a guest is walled in again',
  );
  assert.ok(
    !/plan\.openBrowse \? \(\s*<StdFilmHandoff/.test(SITE),
    'the handoff has been re-gated on openBrowse — that is the defect, not a config',
  );
  assert.ok(
    !/canExit=\{plan\.openBrowse\}/.test(SITE),
    'the film exit has been re-gated on openBrowse — it then cannot reach a real event',
  );
  // And the body must be the event's OWN body, so no site reshapes: this is why
  // the change does not touch the 2026-07-22 no-backfill verdict.
  assert.match(SITE, /\{normalBody\(\)\}<\/StdFilmHandoff>/);
});

// ── The way out must exist THROUGHOUT the film, not only at its end ──────────
// The closing-beat button above is the natural conclusion. It is not a way OUT:
// a visitor who lifted the veil and wanted the website had to sit through the
// whole film to reach it. The owner hit precisely that (2026-08-04) — "petals
// are still there… we have been pushing this edit for 3 days" — because the
// veil's retirement had shipped and there was still nothing to press.

test('handoff · a persistent exit is mounted once the film has STARTED', () => {
  assert.match(
    FILM,
    /\{canExit && started && !preview \?/,
    'the persistent exit must be gated on canExit AND started — `started` is what ' +
      'keeps it out of the DOM (and out of the tab order) under the veil, before ' +
      'the music, the clip and the gallery have played',
  );
});

test('handoff · the persistent exit is not merely hidden, and fires the exit event', () => {
  const block = FILM.slice(FILM.indexOf('{canExit && started && !preview ?'));
  const upToClose = block.slice(0, block.indexOf('</button>'));
  assert.ok(
    upToClose.includes(`new CustomEvent(STD_FILM_EXIT_EVENT)`),
    'the persistent exit must dispatch the shared exit event, not a re-typed string — ' +
      'a re-typed name is a listener that silently never fires',
  );
  const buttonTag = upToClose.slice(upToClose.indexOf('<button'));
  const classNames = [...buttonTag.matchAll(/className=\{?`?([^`"}]*)/g)]
    .map((m) => m[1] ?? '')
    .join(' ');
  for (const smell of ['pointer-events-none', 'opacity-0', 'invisible', 'sr-only', 'hidden']) {
    assert.ok(
      !classNames.includes(smell),
      `the persistent exit's own classes include "${smell}" — hiding a button does not ` +
        `remove it from the tab order, and here it would also make the door invisible.`,
    );
  }
});

test('handoff · the veil retires on the SAME event the exit fires', () => {
  // Two names typed by hand is how a door gets built that opens nothing.
  const OVERLAY = readFileSync(join(HERE, 'reveal', 'reveal-overlay.tsx'), 'utf8');
  assert.match(OVERLAY, /STD_FILM_EXIT_EVENT/, 'the veil must listen for the imported constant');
  assert.ok(
    !/addEventListener\(\s*'std:film-exit'/.test(OVERLAY),
    'the listener must use the imported constant, never a re-typed string literal',
  );
});

// ── The editorial phase is the same defect, in the other direction ───────────
// The Save-the-Date wall covered the site BEFORE the wedding. The editorial
// phase stripped it AFTER. Both were one flag answering two questions.

test('after the wedding, the site persists BELOW the editorial cover', () => {
  const SITE = readFileSync(join(HERE, 'site-body.tsx'), 'utf8');
  const editorial = SITE.slice(
    SITE.indexOf("plan.body === 'editorial' ? ("),
    SITE.indexOf("plan.body === 'save_the_date' ? ("),
  );
  assert.match(
    editorial,
    /\{normalBody\(\)\}/,
    'the editorial phase renders the cover alone again — it strips the guest gallery, ' +
      'the closing-access notice, and the five widget types a couple can switch on for ' +
      'after the wedding',
  );
  assert.ok(
    !/plan\.openBrowse \?/.test(editorial),
    'the editorial body has been re-gated on openBrowse — with that flag false, which is ' +
      'every real event, the whole site disappears after the wedding',
  );
});
