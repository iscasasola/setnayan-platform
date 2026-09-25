/**
 * lib/invite-themes.test.ts — the ten Event Hub themes keep their promises.
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
  HUB_THEMES,
  INVITE_DOOR_IDS,
  INVITE_THEME_IDS,
  INVITE_THEMES,
  LEGACY_THEME_ALIASES,
  normalizeThemeId,
  pickableInviteThemes,
  resolveInviteTheme,
  suggestedInviteTheme,
} from '@/lib/invite-themes';
import { HUB_MOTION_PRESETS } from '@/lib/hub-canvas';
import { HUB_TRANSITIONS } from '@/lib/hub-scenes';
import { REVEAL_TEMPLATE_IDS } from '@/lib/reveal-config-pure';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', '..', 'supabase', 'migrations');

/**
 * The ids the database admits TODAY — read from the LAST migration that sets
 * `events_invite_theme_check`, in filename order (the order the pipeline and the
 * PGlite replay apply them). Reading one named file would keep checking a CHECK
 * that a later migration already replaced.
 */
function checkedThemeIds(): string[] {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  let last: string | null = null;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    if (/ADD CONSTRAINT events_invite_theme_check/.test(sql)) last = sql;
  }
  assert.ok(last, 'no migration sets events_invite_theme_check — the CHECK is gone');
  const m = last!.match(/invite_theme IN \(([^)]*)\)/);
  assert.ok(m, 'the CHECK constraint on invite_theme has no IN list');
  return (m![1] ?? '').split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
}

/** A wedding: holds the unlock and may carry the Save-the-Date film. */
const WEDDING = { ownsPro: true, mayShowStdFilm: true } as const;

test('nothing repaints a live invite: unsaved, junk or unshipped all render as House', () => {
  for (const saved of [null, undefined, '', 'Capiz', 'Vintage', 'marble', 42]) {
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
  assert.ok(ready.length >= 10, `only ${ready.length} themes are ready — all ten shipped on 2026-09-25`);
  for (const saved of ready) {
    assert.equal(resolveInviteTheme({ saved, ...WEDDING }), saved, `${saved} shipped its skin and must render itself`);
  }
});

test('a Pro theme is shown only while the event holds Event Hub Pro', () => {
  assert.equal(resolveInviteTheme({ saved: 'vintage', ...WEDDING }), 'vintage');
  assert.equal(
    resolveInviteTheme({ saved: 'vintage', ownsPro: false, mayShowStdFilm: true }),
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
    resolveInviteTheme({ saved: 'vintage', ownsPro: true, mayShowStdFilm: false }),
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
  assert.equal(resolveInviteTheme({ saved: 'vintage', ownsPro: true, mayShowStdFilm: false }), 'house');
  assert.equal(resolveInviteTheme({ saved: 'vintage', ownsPro: false, mayShowStdFilm: true }), 'house');
  assert.equal(resolveInviteTheme({ saved: 'vintage', ownsPro: false, mayShowStdFilm: false }), 'house');
  assert.equal(resolveInviteTheme({ saved: 'vintage', ownsPro: true, mayShowStdFilm: true }), 'vintage');
});

test('the picker offers no Pro theme where no purchase could ever turn one on', () => {
  const offered = pickableInviteThemes({ mayShowStdFilm: false }).map((t) => t.id);
  assert.deepEqual(offered, ['house'], 'a birthday was offered a wedding-only theme');
  assert.ok(
    pickableInviteThemes({ mayShowStdFilm: true }).some((t) => t.id === 'vintage'),
    'and a wedding still gets the Pro themes — the fence is a fence, not a wall',
  );
});

test('the pre-selection follows the fence too, saved value included', () => {
  // A saved Pro theme used to be returned unconditionally. The radio would then
  // sit on a theme the door is NOT showing — the picker contradicting the door.
  assert.equal(
    suggestedInviteTheme({ saved: 'vintage', moodFeelKey: 'timeless', ownsPro: true, mayShowStdFilm: false }),
    'house',
  );
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'timeless', ownsPro: true, mayShowStdFilm: false }),
    'house',
  );
  assert.equal(
    suggestedInviteTheme({ saved: 'vintage', moodFeelKey: 'timeless', ownsPro: true, mayShowStdFilm: true }),
    'vintage',
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
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'timeless', ...WEDDING }), 'vintage');
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'timeless', ownsPro: false, mayShowStdFilm: true }),
    'house',
  );
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'glam', ...WEDDING }), 'velvet');
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'royalty', ...WEDDING }), 'regency');
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'boho', ...WEDDING }), 'whimsical');
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
  const inDb = checkedThemeIds();

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
  const unknown = inDb.filter(
    (id) => !(INVITE_THEME_IDS as readonly string[]).includes(id) && !(id in LEGACY_THEME_ALIASES),
  );
  assert.deepEqual(
    unknown,
    [],
    `the database admits ${unknown.join(', ')}, which no code can render or alias`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   THE TEN (Event Hub Maker Phase 3, 2026-09-25) — one registry, every field
   ══════════════════════════════════════════════════════════════════════════ */

const HEX = /^#[0-9a-f]{6}$/;

test('the registry is exactly the ten the owner named, in his order, and only Classic is free', () => {
  assert.deepEqual(
    HUB_THEMES.map((t) => t.name),
    ['Classic', 'Rustic', 'Modern', 'Cinderella', 'Luxe', 'Vintage', 'Whimsical', 'Regency', 'Great Gatsby', 'Cyber Neon'],
  );
  assert.equal(new Set(INVITE_THEME_IDS).size, 10, 'a theme id is listed twice');
  assert.deepEqual(HUB_THEMES.filter((t) => t.tier === 'free').map((t) => t.id), ['house']);
  // "Bridgerton" is a Netflix trademark — the public name is Regency (D3).
  assert.ok(!HUB_THEMES.some((t) => /bridgerton/i.test(t.name + t.blurb)), 'a trademarked name reached the picker');
});

test('every theme carries every field the Maker reads — a whole look, not a colour swap', () => {
  for (const t of HUB_THEMES) {
    for (const [k, v] of Object.entries(t.palette)) {
      assert.match(v, HEX, `${t.id}.palette.${k} = "${v}" is not a #rrggbb`);
    }
    assert.ok(t.fonts.heading && t.fonts.body && t.fonts.labels, `${t.id} is missing a face`);
    assert.ok(t.ornament.length > 0, `${t.id} has no ornament`);
    assert.ok((HUB_MOTION_PRESETS as readonly string[]).includes(t.motion), `${t.id} motion "${t.motion}" is not a preset`);
    assert.ok(t.transitions.pattern.length >= 1, `${t.id} presets no transitions`);
    for (const step of [...t.transitions.pattern, { mode: t.transitions.rest }]) {
      assert.ok((HUB_TRANSITIONS as readonly string[]).includes(step.mode), `${t.id} transition "${step.mode}" is not Scroll/Scrub/Auto`);
    }
    assert.ok(t.opening === 'none' || (REVEAL_TEMPLATE_IDS as readonly string[]).includes(t.opening), `${t.id} opening`);
    assert.ok(t.radius > 0, `${t.id} radius`);
    assert.ok((INVITE_DOOR_IDS as readonly string[]).includes(t.door), `${t.id} opens through no door`);
    assert.ok(
      [t.palette.lightInk, t.palette.darkInk].includes(t.palette.ink),
      `${t.id}: ink is neither of its two inks — the tone flip would drop it`,
    );
  }
});

test('Classic is plain colour: no loop, no still, no scrim, no reveal — and every Pro theme has all of them', () => {
  const classic = INVITE_THEMES.house;
  assert.equal(classic.media, null, 'owner: "classic has no photo or video"');
  assert.equal(classic.scrim, null);
  assert.equal(classic.opening, 'none', 'every reveal is Pro; Classic opens on nothing');
  assert.equal(classic.door, 'house');
  for (const t of HUB_THEMES.filter((x) => x.tier === 'pro')) {
    assert.ok(t.media, `${t.id} is Pro with no loop — owner: "all event hub themes use video"`);
    assert.match(t.media!.loop, /^r2:\/\/setnayan-media\/theme-backgrounds\/.+-loop\.mp4$/, `${t.id} loop is not on the public bucket`);
    assert.match(t.media!.poster, /^r2:\/\/setnayan-media\/theme-backgrounds\/.+-poster\.jpg$/, `${t.id} still is not on the public bucket`);
    assert.ok(t.scrim && t.scrim.opacity > 0 && t.scrim.opacity < 1, `${t.id} has no scrim over its loop`);
  }
});

test('foil shimmer is on by default in exactly Luxe and Great Gatsby', () => {
  assert.deepEqual(HUB_THEMES.filter((t) => t.foilNames).map((t) => t.name), ['Luxe', 'Great Gatsby']);
});

test("a retired id is READ as its alias and is never offered — the owner's own page is saved as capiz", () => {
  assert.equal(normalizeThemeId('capiz'), 'vintage');
  assert.equal(normalizeThemeId('minimalist'), 'galeriya');
  assert.equal(normalizeThemeId('fairytale'), 'cinderella');
  assert.equal(normalizeThemeId('custom'), 'house');
  assert.equal(normalizeThemeId('toString'), null, 'a prototype key is not an alias');
  // With the unlock, capiz renders as Vintage; without it, House — the Pro gate still applies.
  assert.equal(resolveInviteTheme({ saved: 'capiz', ...WEDDING }), 'vintage');
  assert.equal(resolveInviteTheme({ saved: 'capiz', ownsPro: false, mayShowStdFilm: true }), 'house');
  assert.equal(suggestedInviteTheme({ saved: 'capiz', moodFeelKey: null, ...WEDDING }), 'vintage');
  for (const legacy of Object.keys(LEGACY_THEME_ALIASES)) {
    assert.ok(!(INVITE_THEME_IDS as readonly string[]).includes(legacy), `${legacy} is both retired and live`);
    assert.ok(!pickableInviteThemes({ mayShowStdFilm: true }).some((t) => t.id === legacy), `${legacy} is offered`);
  }
});

test('the CHECK admits exactly the ten, plus only the retired ids a live row may still hold', () => {
  const inDb = checkedThemeIds();
  for (const id of INVITE_THEME_IDS) assert.ok(inDb.includes(id), `${id} would be refused by the database`);
  const extra = inDb.filter((id) => !(INVITE_THEME_IDS as readonly string[]).includes(id));
  assert.deepEqual(extra, ['capiz'], `the CHECK admits ${extra.join(', ')} — only capiz is still stored (measured 2026-09-25)`);
});

/* ── THE CSS PAINTS THE REGISTRY ─────────────────────────────────────────────
   The palette is written once, here, and the page reads it from globals.css
   (a stylesheet, so the couple's inline colours still win). A second copy is a
   second opinion unless something compares them — this does, channel by
   channel, for every token the page renders through. */
test("every Pro theme's page block in globals.css paints exactly its registry palette", () => {
  const css = readFileSync(join(HERE, '..', 'app', 'globals.css'), 'utf8');
  const ch = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  };
  let checked = 0;
  for (const t of HUB_THEMES) {
    const blocks = [...css.matchAll(new RegExp(`\\[data-hub-theme='${t.id}'\\] \\{([^}]*)\\}`, 'g'))].map((m) => m[1] ?? '');
    const body = blocks.find((b) => /--hub-canvas/.test(b));
    if (t.id === 'house') {
      assert.equal(blocks.length, 0, 'Classic is the page as it renders today — it owns no block');
      continue;
    }
    assert.ok(body, `${t.id} has no generated page block in globals.css`);
    const decl = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(body!)?.[1]?.trim();
    assert.equal(decl('--hub-canvas'), t.palette.canvas, `${t.id} --hub-canvas`);
    assert.equal(decl('--color-cream'), ch(t.palette.canvas), `${t.id} paper is not its canvas`);
    assert.equal(decl('--color-ink'), ch(t.palette.ink), `${t.id} ink`);
    assert.equal(decl('--color-paper-deep'), ch(t.palette.surface), `${t.id} plates`);
    assert.equal(decl('--color-gild'), ch(t.palette.accent), `${t.id} metal`);
    assert.equal(decl('--hub-radius'), `${t.radius}px`, `${t.id} radius`);
    checked += 1;
  }
  assert.equal(checked, 9, `checked ${checked} Pro themes, expected 9`);
});

test('no file outside the registry declares the theme list', () => {
  /*
    One registry means ONE list. A second array naming the new ids — a picker
    that hard-codes "the ten", a switch that lists them — is how one surface
    offers a theme another cannot render. Two of the new ids together are the
    fingerprint; neither word is common anywhere else in the product.
  */
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== '.next') walk(p);
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        const src = readFileSync(p, 'utf8');
        if (/'cinderella'/.test(src) && /'gatsby'/.test(src) && !p.endsWith(join('lib', 'invite-themes.ts'))) {
          offenders.push(p);
        }
      }
    }
  };
  walk(join(HERE, '..', 'app'));
  walk(join(HERE, '..', 'lib'));
  assert.deepEqual(offenders, [], `these files declare the theme list again: ${offenders.join(', ')}`);
});
