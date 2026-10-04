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
import { stripComments } from '@/lib/strip-comments';
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
import { hubThemePageTokens } from '@/lib/hub-theme-tokens';
import { themeFaceVar } from '@/lib/hub-theme-faces';

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

/** A host who holds the unlock — every event type is the same to the theme rule. */
const WEDDING = { ownsPro: true } as const;

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
    resolveInviteTheme({ saved: 'vintage', ownsPro: false }),
    'house',
    'a lapsed or never-bought Pro theme leaked through',
  );
  assert.equal(resolveInviteTheme({ saved: 'house', ownsPro: false }), 'house');
});

/* ── 🎨 EVERY EVENT TYPE, EVERY THEME — Pro stays Pro (owner 2026-10-01) ─────
   DECISION_LOG "PRO THEMES OPEN TO EVERY EVENT TYPE (STILL PRO)". The wedding-
   only fence (Q7 = A, 2026-09-11) is retired: a birthday, a hangout or a wake
   can pick any theme, and a Pro one still needs Event Hub Pro. The picker, the
   draft's server check and this resolver must all agree, so the last one is
   asserted against every shipped event type. */

test('a birthday / hangout / wake can pick and wear every Pro theme', () => {
  const pro = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].ready && INVITE_THEMES[id].tier === 'pro');
  assert.ok(pro.length >= 7, `only ${pro.length} Pro themes — the guard would pass on an empty set`);
  const offered = pickableInviteThemes().map((t) => t.id);
  for (const id of pro) {
    assert.ok(offered.includes(id), `${id} is not offered to a non-wedding`);
    // The rule takes no event type at all — one answer for every type.
    assert.equal(resolveInviteTheme({ saved: id, ownsPro: true }), id, `${id} fell back to House`);
  }
});

test('no theme path asks the wedding-only fence again', () => {
  // Reads the SOURCE: the picker, the guest-facing resolver, the invite panel and
  // the draft's server check each re-implemented the fence, so one surviving copy
  // would shut a birthday out of a theme the picker offered it.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const rel of [
    'lib/invite-themes.ts',
    'app/[slug]/_lib/hub-look.ts',
    'app/dashboard/[eventId]/guests/invite/_components/invite-panel.tsx',
    'app/dashboard/[eventId]/website/hub-draft-actions.ts',
  ]) {
    const code = stripComments(readFileSync(join(root, rel), 'utf8'));
    assert.doesNotMatch(code, /save_the_date_film|resolveWeddingOnlyParts/, `${rel} still asks the wedding-only fence`);
  }
  const launch = stripComments(readFileSync(join(root, 'app/dashboard/[eventId]/launch/page.tsx'), 'utf8'));
  assert.match(launch, /pickableInviteThemes\(\)/);
  assert.doesNotMatch(launch, /(?:resolveInviteTheme|pickableInviteThemes|themeMatchingFeel)\([^)]*mayShowStdFilm/);
});

test('ownership is still required — Pro stays Pro for every event type', () => {
  assert.equal(resolveInviteTheme({ saved: 'vintage', ownsPro: false }), 'house');
  assert.equal(resolveInviteTheme({ saved: 'vintage', ownsPro: true }), 'vintage');
});

test('the pre-selection keeps a saved Pro theme for any event type that owns Pro', () => {
  assert.equal(suggestedInviteTheme({ saved: 'vintage', moodFeelKey: 'timeless', ownsPro: true }), 'vintage');
  assert.equal(suggestedInviteTheme({ saved: 'vintage', moodFeelKey: 'timeless', ownsPro: false }), 'house');
});

test('the free themes are Classic, Modern and Cyber Neon — every other one is Pro', () => {
  /*
    🪤 THIS PINNED `length === 5` AND WENT RED WHEN THE SET GREW to nine
    (owner, 2026-09-22: Minimalist · Fairytale · Vintage · Custom). The count
    was never the rule — a number in a test rots exactly the way a number in a
    document does. The RULE was the owner's, 2026-09-10: "Generic is the Free.
    The other 4 will be the Event Hub Pro service" — ONE free theme. On
    2026-09-29 he redrew it, verbatim: *"Okay use modern and cyber FREE"* — so
    the free set is Classic, Modern and Cyber Neon, and every other one is Pro,
    however many there are.
  */
  const free = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].tier === 'free');
  assert.deepEqual(free, ['house', 'galeriya', 'cyber'], 'the free themes are not Classic, Modern and Cyber Neon');
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
    suggestedInviteTheme({ saved: null, moodFeelKey: 'timeless', ownsPro: false }),
    'house',
  );
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'glam', ...WEDDING }), 'velvet');
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'royalty', ...WEDDING }), 'regency');
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'boho', ...WEDDING }), 'whimsical');
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'glam', ownsPro: false }),
    'house',
  );
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'modern', ...WEDDING }), 'galeriya');
  // Modern is FREE (owner 2026-09-29): a couple without Pro is suggested it too.
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'modern', ownsPro: false }),
    'galeriya',
  );
  // 'rustic' is Abaca's feel, and Abaca shipped its skin on 2026-09-14 — the
  // last of the four. This line read `'house'` for as long as it had none.
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'rustic', ...WEDDING }), 'abaca');
  assert.equal(
    suggestedInviteTheme({ saved: null, moodFeelKey: 'rustic', ownsPro: false }),
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
    pickableInviteThemes().map((t) => t.id),
    INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].ready),
  );
  assert.ok(
    pickableInviteThemes().some((t) => t.id === 'house'),
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

test('the registry is exactly the ten the owner named, in the one order, and Classic, Modern and Cyber Neon are free', () => {
  // Owner 2026-09-29: "arrange the themes to have the free as the first 3 and
  // the rest will be based on size also" — the ORDER is held (and explained)
  // by lib/theme-order.test.ts; here, that the ten are exactly his ten.
  assert.deepEqual(
    HUB_THEMES.map((t) => t.name),
    ['Classic', 'Modern', 'Cyber Neon', 'Luxe', 'Vintage', 'Regency', 'Rustic', 'Cinderella', 'Great Gatsby', 'Whimsical'],
  );
  assert.equal(new Set(INVITE_THEME_IDS).size, 10, 'a theme id is listed twice');
  assert.deepEqual(HUB_THEMES.filter((t) => t.tier === 'free').map((t) => t.id), ['house', 'galeriya', 'cyber']);
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

test('Classic is plain colour: no loop, no still, no scrim, no reveal — and every other theme has all of them', () => {
  const classic = INVITE_THEMES.house;
  assert.equal(classic.media, null, 'owner: "classic has no photo or video"');
  assert.equal(classic.scrim, null);
  assert.equal(classic.opening, 'none', 'every reveal is Pro; Classic opens on nothing');
  assert.equal(classic.door, 'house');
  // Every theme but Classic — free or Pro (Modern and Cyber Neon are free since
  // 2026-09-29 and keep their loops; the owner chose them FOR their light loops).
  for (const t of HUB_THEMES.filter((x) => x.id !== 'house')) {
    assert.ok(t.media, `${t.id} has no loop — owner: "all event hub themes use video"`);
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
  assert.equal(resolveInviteTheme({ saved: 'capiz', ownsPro: false }), 'house');
  assert.equal(suggestedInviteTheme({ saved: 'capiz', moodFeelKey: null, ...WEDDING }), 'vintage');
  for (const legacy of Object.keys(LEGACY_THEME_ALIASES)) {
    assert.ok(!(INVITE_THEME_IDS as readonly string[]).includes(legacy), `${legacy} is both retired and live`);
    assert.ok(!pickableInviteThemes().some((t) => t.id === legacy), `${legacy} is offered`);
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
    // The page tokens are DERIVED from the palette by one rule (a theme never
    // makes a word harder to read than House does) — re-derive, never re-type.
    const k = hubThemePageTokens(t);
    assert.equal(decl('--color-ink'), ch(k.ink), `${t.id} ink`);
    assert.equal(decl('--color-ink-on-plate'), ch(k.ink), `${t.id} plate ink`);
    assert.equal(decl('--color-paper-deep'), ch(t.palette.surface), `${t.id} plates`);
    assert.equal(decl('--color-gild'), ch(k.gild), `${t.id} metal`);
    assert.equal(decl('--color-terracotta'), ch(k.eyebrow), `${t.id} eyebrow`);
    assert.equal(decl('--color-mulberry'), ch(k.cta), `${t.id} button`);
    assert.equal(decl('--hub-radius'), `${t.radius}px`, `${t.id} radius`);
    checked += 1;
  }
  assert.equal(checked, 9, `checked ${checked} Pro themes, expected 9`);
});

/* ── B5 · EVERY THEME'S FACES REACH EVERY ROLE (2026-10-04) ────────────────
   INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md § B5: each theme names four
   faces, and the page blocks wired only the heading (and five themes' labels) —
   every paragraph, RSVP question and button was set in the app's Hanken Grotesk.
   Each block must now carry the body face (and point `--font-sans` and the
   inherited `font-family` at it), the script face and the labels face, through
   the ONE family → variable table (`lib/hub-theme-faces.ts`), and every variable
   must be one `<html>` already declares — or the "face" is the fallback stack
   with no error anywhere. */
test("every theme block wires its body, script and labels faces — not only its heading", () => {
  const css = readFileSync(join(HERE, '..', 'app', 'globals.css'), 'utf8');
  const loaders = ['layout.tsx', join('_fonts', 'choice-faces.ts')]
    .map((f) => readFileSync(join(HERE, '..', 'app', f), 'utf8'))
    .join('\n');
  const declared = (v: string) => new RegExp(`variable:\\s*'${v}'`).test(loaders);
  let checked = 0;
  for (const t of HUB_THEMES) {
    if (t.id === 'house') continue;
    const blocks = [...css.matchAll(new RegExp(`\\[data-hub-theme='${t.id}'\\] \\{([^}]*)\\}`, 'g'))].map((m) => m[1] ?? '');
    const body = stripComments(blocks.find((b) => /--hub-canvas/.test(b)) ?? '');
    assert.ok(body, `${t.id} has no page block`);
    const decl = (name: string) => new RegExp(`(?:^|[\\s;])${name}:\\s*([^;]+);`).exec(body)?.[1]?.trim();
    const v = (family: string) => `var(${themeFaceVar(family)})`;
    assert.equal(decl('--font-body'), v(t.fonts.body), `${t.id}: the body face (${t.fonts.body}) is not wired`);
    assert.equal(decl('--font-sans'), 'var(--font-body)', `${t.id}: font-sans text is not set in the body face`);
    assert.match(decl('font-family') ?? '', /^var\(--font-body\),/, `${t.id}: text that names no face does not inherit the body face`);
    const script = t.fonts.script ? v(t.fonts.script) : decl('--font-display');
    assert.equal(decl('--font-theme-script'), script, `${t.id}: the script face (${t.fonts.script ?? 'none — the heading'}) is not wired`);
    assert.ok(decl('--font-mono'), `${t.id}: the labels face (${t.fonts.labels}) is not wired`);
    // 🔑 Never redefine Great Vibes' own variable: a host's Great Vibes would become the theme's script.
    assert.equal(decl('--font-script'), undefined, `${t.id} redefines --font-script — a host's chosen Great Vibes would change face`);
    for (const role of ['--font-body', '--font-theme-script', '--font-mono']) {
      const name = /^var\((--[a-z0-9-]+)\)$/.exec(decl(role) ?? '')?.[1];
      assert.ok(name && (declared(name) || /--font-(velvet|galeriya|cinderella|whimsical|regency|gatsby|cyber)-/.test(name)), `${t.id} ${role} names ${name}, which nothing declares`);
    }
    checked += 1;
  }
  assert.equal(checked, 9, `checked ${checked} themes, expected the nine with a block`);
  // Tailwind's font-script reads the theme's script first, Great Vibes otherwise.
  const tw = readFileSync(join(HERE, '..', 'tailwind.config.ts'), 'utf8');
  assert.match(tw, /script: \['var\(--font-theme-script, var\(--font-script\)\)', 'cursive'\]/);
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
