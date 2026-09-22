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
  for (const saved of [null, undefined, '', 'Capiz', 'marble', 42]) {
    assert.equal(resolveInviteTheme({ saved, ...WEDDING }), 'house', `${String(saved)} must render as House`);
  }
  /*
   * THE UNSHIPPED CASE IS NOW DERIVED, NOT NAMED. This loop used to carry the
   * literal 'abaca' as its unshipped theme; Abaca shipped on 2026-09-14 and all
   * five skins are live, so there is no unready id left to name. Naming one
   * again would be a check that only works until that theme ships, which is
   * exactly how this line went red.
   *
   * 🔑 AND AN EMPTY UNREADY SET IS NOT A HOLE — it is the other half of the
   * same rule, asserted right below it: every READY theme must render ITSELF.
   * Between them, every id in the union is checked, whichever side it is on,
   * and a sixth theme added tomorrow is covered the day it appears.
   */
  const unready = INVITE_THEME_IDS.filter((id) => !INVITE_THEMES[id].ready);
  for (const saved of unready) {
    assert.equal(resolveInviteTheme({ saved, ...WEDDING }), 'house', `${saved} has no skin and must render as House`);
  }
  const ready = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].ready);
  assert.equal(ready.length + unready.length, INVITE_THEME_IDS.length, 'a theme is in neither set');
  // POSITIVE CONTROL: without this the loops above are satisfied by "everything
  // is House", which is what an accidentally-unready app would look like.
  assert.ok(ready.length >= 5, `only ${ready.length} themes have skins — all five shipped by 2026-09-14`);
  for (const saved of ready) {
    assert.equal(resolveInviteTheme({ saved, ...WEDDING }), saved, `${saved} shipped its skin and must render itself`);
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

test('exactly one theme is free, and it is the house one', () => {
  /*
    🪤 THIS PINNED `length === 5` AND WENT RED WHEN THE SET GREW to nine
    (owner, 2026-09-22: Minimalist · Fairytale · Vintage · Custom). The count
    was never the rule — a number in a test rots exactly the way a number in a
    document does. The RULE is the owner's, 2026-09-10: "Generic is the Free.
    The other 4 will be the Event Hub Pro service" — i.e. ONE free theme, and
    every other one is Pro, however many there are.
  */
  const free = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].tier === 'free');
  assert.deepEqual(free, ['house'], 'the free theme is not house, or there is more than one');
  const pro = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].tier === 'pro');
  assert.equal(
    free.length + pro.length,
    INVITE_THEME_IDS.length,
    'a theme is neither free nor pro — every one must be sold or given',
  );
  assert.ok(pro.length >= 1, 'no Pro theme left — the Event Hub PRO unlock sells nothing here');
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
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'glam', ...WEDDING }), 'velvet');
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'glam', ownsPro: false, mayShowStdFilm: true }),
    'house',
  );
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'modern', ...WEDDING }), 'galeriya');
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'modern', ownsPro: false, mayShowStdFilm: true }),
    'house',
  );
  // 'rustic' is Abaca's feel, and Abaca shipped its skin on 2026-09-14 — the
  // last of the four. This line read `'house'` for as long as it had none.
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'rustic', ...WEDDING }), 'abaca');
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'rustic', ownsPro: false, mayShowStdFilm: true }),
    'house',
  );
  // The "an unshipped skin is never suggested" half, kept executable now that no
  // theme is unshipped: whatever an unready theme's feel is, it must not be the
  // answer to that feel.
  for (const id of INVITE_THEME_IDS.filter((t) => !INVITE_THEMES[t].ready)) {
    for (const feel of INVITE_THEMES[id].feels) {
      assert.notEqual(
        suggestedInviteTheme({ saved: null, moodFeelKey: feel, ...WEDDING }),
        id,
        `${id} has no skin and is still being pre-selected for "${feel}"`,
      );
    }
  }
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

test('every theme a couple can actually SAVE exists in the database', () => {
  const dir = join(HERE, '..', '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_the_invite_link_wears_a_theme.sql'));
  assert.ok(file, 'the migration that adds events.invite_theme is gone or renamed');
  const sql = readFileSync(join(dir, file), 'utf8');
  const m = sql.match(/invite_theme IN \(([^)]*)\)/);
  assert.ok(m, 'the CHECK constraint on invite_theme is gone');
  const inDb = (m[1] ?? '').split(',').map((s) => s.trim().replace(/^'|'$/g, ''));

  /*
    🔑 THE INVARIANT IS "SAVEABLE", NOT "REGISTERED" — and getting that wrong is
    what made this test red on a change that could not break anything.

    A theme with `ready: false` is never offered and never rendered
    (`themeIsAvailable`), so a couple CANNOT save one, so the database does not
    need to know it yet. Registering a theme before its skin exists is the
    documented path — the `ready` docblock says shipping a skin later "needs no
    data change" — and demanding a migration for a theme nobody can choose
    would make that path impossible.

    So: every READY theme must be in the CHECK (or a real save is refused), and
    the CHECK may name nothing the registry has never heard of (or the column
    admits a value no code can render).
  */
  const saveable = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].ready);
  const missing = saveable.filter((id) => !inDb.includes(id));
  assert.deepEqual(
    missing,
    [],
    `${missing.join(', ')} is offered to couples but would be REFUSED by the database — ` +
      'widen the CHECK in the same PR that flips `ready`',
  );
  const unknown = inDb.filter((id) => !(INVITE_THEME_IDS as readonly string[]).includes(id));
  assert.deepEqual(
    unknown,
    [],
    `the database admits ${unknown.join(', ')}, which no code can render`,
  );
});
