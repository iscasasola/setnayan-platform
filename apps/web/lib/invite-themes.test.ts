/**
 * lib/invite-themes.test.ts — the five invite themes keep their promises.
 *
 * Each test names a promise a couple or a guest would feel if it broke: a live
 * invite repainted without anyone choosing, a Pro theme shown to an event that
 * does not hold Event Hub Pro, a feel with no theme to suggest, a theme the app
 * offers that the database refuses to store.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEL_OPTIONS } from '@/lib/match-criteria';
import {
  INVITE_THEME_IDS,
  INVITE_THEMES,
  pickableInviteThemes,
  resolveInviteTheme,
  suggestedInviteTheme,
} from '@/lib/invite-themes';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A wedding: holds the unlock and may carry the Save-the-Date film. */
const WEDDING = { ownsPro: true, mayShowStdFilm: true } as const;

test('nothing repaints a live invite: unsaved, junk or unshipped all render as House', () => {
  for (const saved of [null, undefined, '', 'Capiz', 'marble', 42, 'velvet', 'galeriya', 'abaca']) {
    assert.equal(resolveInviteTheme({ saved, ...WEDDING }), 'house', `${String(saved)} must render as House`);
  }
});

test('a Pro theme is shown only while the event holds Event Hub Pro', () => {
  assert.equal(resolveInviteTheme({ saved: 'capiz', ...WEDDING }), 'capiz');
  assert.equal(
    resolveInviteTheme({ saved: 'capiz', ownsPro: false, mayShowStdFilm: true }),
    'house',
    'a lapsed or never-bought Pro theme leaked through',
  );
  assert.equal(resolveInviteTheme({ saved: 'house', ownsPro: false, mayShowStdFilm: true }), 'house');
});

/* ── 🔒 WEDDINGS ONLY (owner Q7 = A, 2026-09-11) ──────────────────────────────
   The four Pro themes belong only where the event type may show the Save-the-
   Date film. Three separate surfaces have to agree about that — the picker (what
   is offered), `setInviteTheme` (what may be saved) and this resolver (what a
   guest is actually shown) — and only the last one protects a value that is
   ALREADY in the database. A couple who picked Capiz as a wedding and then had
   the type changed must get House, with no write in between, exactly as a lapsed
   unlock does. */

test('a Pro theme never opens on a celebration that cannot carry the Save-the-Date film', () => {
  assert.equal(
    resolveInviteTheme({ saved: 'capiz', ownsPro: true, mayShowStdFilm: false }),
    'house',
    'a birthday that owns Event Hub Pro was shown a wedding-only invite theme',
  );
  // …and the free door is unaffected: House is for every celebration.
  assert.equal(
    resolveInviteTheme({ saved: 'house', ownsPro: false, mayShowStdFilm: false }),
    'house',
  );
});

test('the fence is not optional — ownership alone can never open a Pro theme', () => {
  /*
    🛡 THE TWO CONDITIONS ARE TESTED APART. One query, many predicates: a test
    that only ever passed `{ownsPro: true, mayShowStdFilm: true}` and
    `{false, false}` would stay green if either half were deleted. Each row below
    is the one the OTHER predicate alone would wrongly admit.
  */
  assert.equal(resolveInviteTheme({ saved: 'capiz', ownsPro: true, mayShowStdFilm: false }), 'house');
  assert.equal(resolveInviteTheme({ saved: 'capiz', ownsPro: false, mayShowStdFilm: true }), 'house');
  assert.equal(resolveInviteTheme({ saved: 'capiz', ownsPro: false, mayShowStdFilm: false }), 'house');
  assert.equal(resolveInviteTheme({ saved: 'capiz', ownsPro: true, mayShowStdFilm: true }), 'capiz');
});

test('the picker offers no Pro theme where no purchase could ever turn one on', () => {
  const offered = pickableInviteThemes({ mayShowStdFilm: false }).map((t) => t.id);
  assert.deepEqual(offered, ['house'], 'a birthday was offered a wedding-only theme');
  assert.ok(
    pickableInviteThemes({ mayShowStdFilm: true }).some((t) => t.id === 'capiz'),
    'and a wedding still gets the Pro themes — the fence is a fence, not a wall',
  );
});

test('the pre-selection follows the fence too, saved value included', () => {
  // A saved Pro theme used to be returned unconditionally. The radio would then
  // sit on a theme the door is NOT showing — the picker contradicting the door.
  assert.equal(
    suggestedInviteTheme({ saved: 'capiz', moodFeelKey: 'timeless', ownsPro: true, mayShowStdFilm: false }),
    'house',
  );
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'timeless', ownsPro: true, mayShowStdFilm: false }),
    'house',
  );
  assert.equal(
    suggestedInviteTheme({ saved: 'capiz', moodFeelKey: 'timeless', ownsPro: true, mayShowStdFilm: true }),
    'capiz',
  );
});

test('House is the one free theme, and the other four are Pro', () => {
  const free = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].tier === 'free');
  assert.deepEqual(free, ['house'], 'the owner ruled "Generic is the Free"; the other four are Event Hub Pro');
  assert.equal(INVITE_THEME_IDS.length, 5);
});

test('every onboarding feel is suggested exactly one theme — no couple is suggested nothing', () => {
  for (const { value } of FEEL_OPTIONS) {
    const homes = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].feels.includes(value));
    assert.equal(homes.length, 1, `feel "${value}" belongs to ${homes.length} themes`);
  }
});

test('the picker pre-selects from the feel, but only a theme the couple can actually use', () => {
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'timeless', ...WEDDING }), 'capiz');
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'timeless', ownsPro: false, mayShowStdFilm: true }),
    'house',
  );
  // An unshipped skin is never suggested, even to a Pro couple whose feel points at it.
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'glam', ...WEDDING }), 'house');
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: null, ...WEDDING }), 'house');
  // A saved choice always wins over the feel.
  assert.equal(suggestedInviteTheme({ saved: 'house', moodFeelKey: 'timeless', ...WEDDING }), 'house');
});

test('the picker offers only shipped skins', () => {
  assert.deepEqual(
    pickableInviteThemes({ mayShowStdFilm: true }).map((t) => t.id),
    INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].ready),
  );
  assert.ok(
    pickableInviteThemes({ mayShowStdFilm: true }).some((t) => t.id === 'house'),
    'House must always be pickable',
  );
});

test('the app and the database agree on the five names', () => {
  const dir = join(HERE, '..', '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_the_invite_link_wears_a_theme.sql'));
  assert.ok(file, 'the migration that adds events.invite_theme is gone or renamed');
  const sql = readFileSync(join(dir, file), 'utf8');
  const m = sql.match(/invite_theme IN \(([^)]*)\)/);
  assert.ok(m, 'the CHECK constraint on invite_theme is gone');
  const inDb = (m[1] ?? '').split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  assert.deepEqual(
    [...inDb].sort(),
    [...INVITE_THEME_IDS].sort(),
    'a theme the app offers would be refused by the database, or the reverse',
  );
});
