/**
 * hub-fonts-are-loaded.test.ts — EVERY FACE OFFERED IS A FACE THAT ARRIVES.
 *
 * 🔴 THE FAILURE THIS EXISTS FOR IS SILENT. A key naming a CSS variable that
 * `app/layout.tsx` does not declare produces no error anywhere: the browser
 * resolves `var(--font-nope)` to nothing, falls back down the stack, and the
 * couple who picked Cinzel is shown Georgia on their own wedding page. Nothing
 * is logged, no request fails, and the dashboard says Cinzel.
 *
 * So the list is checked against the file that actually loads the fonts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  HUB_FONTS,
  HUB_FONT_KEYS,
  hubFontPreviewStack,
  hubFontVars,
  sanitizeHubFontKey,
} from './hub-fonts';

const LAYOUT = readFileSync(join(__dirname, '..', 'app', 'layout.tsx'), 'utf8');
/*
  🪤 BOTH FILES, because the two vars this contract writes are consumed in
  different places. `--pahina-face` is read by a rule in `globals.css`;
  `--font-display` is read by `tailwind.config.ts`, which is what turns it into
  the `font-display` utility every heading on the site uses. The first version
  of the guard below read only the stylesheet and called `--font-display`
  unconsumed — a guard whose window faces one file cannot answer a question
  about two.
*/
const CONSUMERS =
  readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8') +
  readFileSync(join(__dirname, '..', 'tailwind.config.ts'), 'utf8');

/*
  THE TWO FILES THAT LOAD A FACE. `layout.tsx` carries the chrome faces and the
  first nine choices; `_fonts/choice-faces.ts` carries every other face we ship
  (2026-09-27, "use all our fonts on the dropdown"), none of them preloaded.
*/
const CHOICE = readFileSync(join(__dirname, '..', 'app', '_fonts', 'choice-faces.ts'), 'utf8');

/** `const <name> = localFont({ … variable: '--font-x' … })` → name → var, per file. */
function declaredFaces(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/const (\w+) = localFont\(\{([\s\S]*?)\n\}\);/g)) {
    const v = /variable:\s*'(--font-[a-z-]+)'/.exec(m[2] ?? '')?.[1];
    if (v) out.set(m[1] as string, v);
  }
  return out;
}

test('⛔ every offered face is declared by app/layout.tsx or app/_fonts/choice-faces.ts — AND applied', () => {
  const layoutFaces = declaredFaces(LAYOUT);
  const choiceFaces = declaredFaces(CHOICE);
  assert.ok(layoutFaces.size >= 8, `precondition: layout.tsx declares faces (${layoutFaces.size})`);
  assert.ok(choiceFaces.size >= 20, `precondition: choice-faces.ts declares faces (${choiceFaces.size})`);

  /*
    🔑 DECLARED IS NOT ENOUGH. A `localFont` whose `.variable` class is on no
    element defines its custom property nowhere — `var(--font-hub-jost)` would
    resolve to nothing on every page, exactly the silent fallback this file
    exists for. So: a layout face's `.variable` must be in the <html> class, and
    a choice face must be in HUB_CHOICE_FACES_CLASS, which must be in it too.
  */
  const htmlClass = /<html[\s\S]*?className=\{`([^`]*)`\}/.exec(LAYOUT)?.[1] ?? '';
  assert.ok(htmlClass.length > 0, 'precondition: the <html> className is found');
  const applied = new Set<string>();
  for (const [name, v] of layoutFaces) if (htmlClass.includes(`\${${name}.variable}`)) applied.add(v);
  assert.match(htmlClass, /\$\{HUB_CHOICE_FACES_CLASS\}/, 'the choice faces ride the <html> class');
  assert.match(LAYOUT, /import \{ HUB_CHOICE_FACES_CLASS \} from '\.\/_fonts\/choice-faces';/);
  const classList = /export const HUB_CHOICE_FACES_CLASS = \[([\s\S]*?)\]/.exec(CHOICE)?.[1] ?? '';
  for (const [name, v] of choiceFaces) {
    assert.match(classList, new RegExp(`\\b${name},`), `${name} is declared but not in HUB_CHOICE_FACES_CLASS`);
    applied.add(v);
  }

  const missing = HUB_FONTS.filter((f) => !applied.has(f.cssVar)).map((f) => `${f.key} → ${f.cssVar}`);
  assert.deepEqual(missing, [], `offered but never loaded — these render as a silent fallback: ${missing.join(', ')}`);
});

test('📱 no new face is preloaded — a guest page downloads only what it sets', () => {
  /*
    99% of guests are on phones. A preloaded face is a download in every page's
    <head> whether or not a letter is set in it. Every face in choice-faces.ts
    must say `preload: false` (and `display: 'swap'`, so text paints at once).
  */
  const calls = [...CHOICE.matchAll(/localFont\(\{([\s\S]*?)\n\}\);/g)].map((m) => m[1] ?? '');
  assert.ok(calls.length >= 20, `precondition: choice faces found (${calls.length})`);
  const preloading = calls
    .map((body) => /variable:\s*'([^']+)'/.exec(body)?.[1] ?? '?')
    .filter((_, i) => !/\bpreload:\s*false\b/.test(calls[i] ?? ''));
  assert.deepEqual(preloading, [], `these faces would be preloaded on every page: ${preloading.join(', ')}`);
  for (const body of calls) assert.match(body, /display:\s*'swap'/);

  // Every face past the original nine and the two chrome sans faces is a
  // `--font-hub-*` from THIS file — none was slipped into layout.tsx, where
  // it would be preloaded.
  const layoutVars = new Set(declaredFaces(LAYOUT).values());
  const ORIGINAL = new Set(['cormorant', 'fraunces', 'playfair', 'caslon', 'vidaloka', 'cinzel', 'script', 'tangerine', 'luxurious', 'manrope', 'hanken']);
  for (const f of HUB_FONTS) {
    if (ORIGINAL.has(f.key)) {
      assert.ok(layoutVars.has(f.cssVar), `${f.key} is a face layout.tsx already loads`);
    } else {
      assert.match(f.cssVar, /^--font-hub-[a-z]+$/, `${f.key} must come from choice-faces.ts`);
      assert.ok(!layoutVars.has(f.cssVar), `${f.key} must not be declared (and preloaded) by layout.tsx`);
    }
  }
});

/*
  ── EVERY FAMILY WE SHIP IS OFFERED ────────────────────────────────────────
  Owner, 2026-09-27: "remember to use all our fonts on the dropdown". The
  shelves below are every place the repo keeps a font file; each family found
  there must be in HUB_FONTS unless it is named in EXCLUDED with its reason.
  (The EMS single-line faces in assets/cipher-fonts are `.svg` pen-plotter
  outlines, not a web font format, and so are not scanned at all.)
*/
const EXCLUDED: Record<string, string> = {
  'DM Mono': 'a monospaced UI face (eyebrows, label chips) — reads as code, not wedding text',
  'Space Mono': 'a monospaced UI face (the app chrome) — reads as code, not wedding text',
  Cormorant:
    'the base cut of Cormorant Garamond, already offered as "Cormorant"; a second line with the same name and near-identical letters would be two names for one look',
  /*
    ✅ THE TEN THEME FACES (2026-10-04) are no longer excluded: owner "Yes to
    both" — Lora · Libre Baskerville · Crimson Pro · Josefin Sans · Kaushan
    Script · Alex Brush · Parisienne · Cookie · Mrs Saint Delafield · Monoton are
    in HUB_FONTS, the site_font_key CHECK accepts them (migration 20271263752844),
    and the Most-used tie they create is ordered by theme count, then the
    owner's named order (`hub-fonts-most-used.test.ts`).
  */
};

async function shippedFamilies(): Promise<Map<string, string>> {
  const web = join(__dirname, '..');
  const out = new Map<string, string>(); // family → where it was found
  // app/_fonts/<family-dir>/…woff2 — the dir IS the family (see fetch-brand-fonts.mjs).
  for (const e of readdirSync(join(web, 'app', '_fonts'), { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const files = readdirSync(join(web, 'app', '_fonts', e.name)).filter((f) => f.endsWith('.woff2'));
    if (files.length > 0) out.set(`dir:${e.name}`, `app/_fonts/${e.name}`);
  }
  // Every .ttf/.otf elsewhere — the family is read from the font's own name table.
  const ot = (await import('opentype.js')) as unknown as {
    parse?: (b: ArrayBuffer) => unknown;
    default?: { parse: (b: ArrayBuffer) => unknown };
  };
  const parse = (ot.parse ?? ot.default?.parse) as (b: ArrayBuffer) => {
    names: Record<string, Record<string, { en?: string }>>;
  };
  for (const dir of ['public/monogram-studio/fonts', 'assets/cipher-fonts', 'lib/social/fonts']) {
    for (const f of readdirSync(join(web, dir))) {
      if (!/\.(ttf|otf)$/i.test(f)) continue;
      const b = readFileSync(join(web, dir, f));
      const font = parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
      const n = font.names.windows ?? font.names.macintosh ?? font.names.unicode ?? {};
      const family = (n.preferredFamily?.en ?? n.fontFamily?.en ?? '').trim();
      assert.ok(family, `${dir}/${f} has a family name`);
      out.set(family, `${dir}/${f}`);
    }
  }
  return out;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

test('⭐ every font family the repo ships is in the dropdown — only the named exclusions are not', async () => {
  const shipped = await shippedFamilies();
  assert.ok(shipped.size >= 30, `precondition: the shelves were read (${shipped.size} families)`);
  const offered = new Set(HUB_FONTS.map((f) => squash(f.family)));
  const excluded = new Set(Object.keys(EXCLUDED).map(squash));
  const missing: string[] = [];
  for (const [family, where] of shipped) {
    const k = squash(family.replace(/^dir:/, ''));
    if (!offered.has(k) && !excluded.has(k)) missing.push(`${family.replace(/^dir:/, '')} (${where})`);
  }
  assert.deepEqual(missing, [], `we ship these and the dropdown does not offer them: ${missing.join(', ')}`);
  // An exclusion must still exist — a stale one hides nothing and reads as a decision.
  const shippedKeys = new Set([...shipped.keys()].map((f) => squash(f.replace(/^dir:/, ''))));
  for (const name of Object.keys(EXCLUDED)) {
    assert.ok(shippedKeys.has(squash(name)), `EXCLUDED names ${name}, which the repo no longer ships`);
    assert.ok(!offered.has(squash(name)), `${name} is both excluded and offered`);
  }
});

test('⭐ the dropdown: Recently used · Most used · All fonts — every face, each once', async () => {
  const { HUB_FONTS_MOST_USED, HUB_FONT_GROUPS } = await import('./hub-fonts');
  const { hubFontShelves } = await import('./hub-font-shelves');
  const list = hubFontShelves();
  assert.equal(list.length, HUB_FONTS.length, 'every face appears');
  assert.equal(new Set(list.map((f) => f.key)).size, list.length, 'and none appears twice');
  // With nothing picked yet, the measured five lead.
  assert.deepEqual(
    list.slice(0, 5).map((f) => [f.key, f.shelf]),
    HUB_FONTS_MOST_USED.map((k) => [k, 'Most used']),
  );
  // "All fonts" keeps the catalogue's kinds together, in their order.
  const kinds = [...new Set(list.slice(5).map((f) => f.group))];
  assert.deepEqual(kinds, [...HUB_FONT_GROUPS]);
  for (const f of list.slice(5)) assert.equal(f.shelf, 'All fonts', `${f.key} sits on All fonts`);
});

test('⛔ the hook it writes is the one globals.css reads', () => {
  // Setting a var nothing consumes is a choice that moves no pixels.
  const vars = hubFontVars('cinzel');
  for (const name of Object.keys(vars)) {
    assert.ok(
      CONSUMERS.includes(`var(${name}`),
      `${name} is written by the contract and read by no rule`,
    );
  }
  assert.match(vars['--pahina-face'] ?? '', /var\(--font-cinzel\)/);
});

test('⛔ an unset face contributes NOTHING — markup identical to before', () => {
  for (const junk of [null, undefined, '', 'Cormorant', 'comic-sans', 7, {}, []]) {
    assert.deepEqual(hubFontVars(junk), {}, `${JSON.stringify(junk)} must not set a face`);
  }
  // Non-vacuity: a real key does set one.
  assert.notDeepEqual(hubFontVars('playfair'), {});
});

test('⛔ a stored value is dropped, never repaired into the nearest face', () => {
  assert.equal(sanitizeHubFontKey('Cormorant'), null, 'capitalisation is not corrected');
  assert.equal(sanitizeHubFontKey(' playfair '), null, 'nor is whitespace');
  assert.equal(sanitizeHubFontKey('playfair'), 'playfair');
});

test('⭐ every key has a distinct face, a label and a preview stack', () => {
  assert.equal(HUB_FONTS.length, HUB_FONT_KEYS.length);
  const vars = new Set(HUB_FONTS.map((f) => f.cssVar));
  assert.equal(vars.size, HUB_FONTS.length, 'two keys pointing at one face is two names for one thing');
  for (const f of HUB_FONTS) {
    assert.ok(f.label.length > 0 && f.note.length > 0, `${f.key} needs a label and a note`);
    const stack = hubFontPreviewStack(f.key);
    assert.match(stack, /^var\(--font-[a-z-]+\), .+/, `${f.key} previews in its own face with a fallback`);
    assert.doesNotMatch(stack, /undefined/);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   THE CHOICE REACHES THE PAGE — and is gated like the rest of the look
   ══════════════════════════════════════════════════════════════════════════ */

test('⛔ the face is Pro-gated, in the SAME place the colours are', () => {
  // A second gate would be a second opinion about who owns the look, and the
  // two would drift the moment an unlock lapsed.
  //
  // 🪤 owner 2026-09-25 bg-colour fix moved `proSiteVarsFor` out of
  // `loaders.ts` into its own pure `_lib/pro-site-vars.ts` (so its math is
  // directly unit-testable without `loaders.ts`'s request-scoped import
  // graph) and made the BACKGROUND colour free; 2026-09-28 freed the button
  // colour too — only the face still rides the Pro gate. The anchor moves with the code it
  // anchors; the PROPERTY it checks does not change.
  const proSiteVars = readFileSync(
    join(__dirname, '..', 'app', '[slug]', '_lib', 'pro-site-vars.ts'),
    'utf8',
  );
  const at = proSiteVars.indexOf('if (proWatermarkHidden) {');
  assert.ok(at > 0, 'the face rides the Pro-gated bag');
  const block = proSiteVars.slice(at, at + 400);
  assert.match(block, /hubFontVars\(/, 'and the face is in it');
  // 💎 2026-09-28: the button colour left this block — it is free now (the
  // free-vs-Pro redraw) and paints beside the background, for every event.
  assert.doesNotMatch(block.slice(0, block.indexOf('}') + 1), /site_button_color/, 'the free button colour is back behind Pro');

  // ONE gate, not two: exactly one `if (proWatermarkHidden)` in the module,
  // so a future edit that grows a second Pro guard — two opinions about who
  // owns the look — cannot pass unnoticed.
  const gates = [...proSiteVars.matchAll(/if \(proWatermarkHidden\)/g)].length;
  assert.equal(gates, 1, `there is ${gates} Pro gates in pro-site-vars.ts, expected exactly one`);

  const loaders = readFileSync(
    join(__dirname, '..', 'app', '[slug]', '_lib', 'loaders.ts'),
    'utf8',
  );
  assert.match(loaders, /site_font_key/, 'the column is actually selected');
});

test('⛔ the editor offers every face, and a way back to the theme', async () => {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  /*
    🪤 A `'use client'` MODULE LANDS UNDER `.default` HERE. Under `tsx`, a
    dynamic import of this file returns `{ default: { ColorsPanel, … } }`, not
    the named exports — while `sections-panel.tsx`, which carries no
    `'use client'`, returns them at the top level. Destructuring the named
    export therefore yielded `undefined`, and React's only complaint was
    "Element type is invalid", which reads like a missing export rather than an
    interop shape. Take whichever one is there.
  */
  const mod = (await import(
    '../app/dashboard/[eventId]/website/editor/_components/pro-panels'
  )) as unknown as Record<string, unknown> & { default?: Record<string, unknown> };
  const ColorsPanel = (mod.ColorsPanel ?? mod.default?.ColorsPanel) as React.FunctionComponent<
    Record<string, unknown>
  >;
  assert.ok(ColorsPanel, 'the panel is exported under one shape or the other');
  const html = renderToStaticMarkup(
    React.createElement(ColorsPanel, {
      action: () => {},
      eventId: 'E1',
      rowKey: 'colors',
      bgColor: null,
      buttonColor: null,
      artDirection: 'daylight' as const,
      fontKey: 'cinzel',
    }),
  );
  /*
    🪤 THE TAGS ARE PARSED, NOT PATTERN-MATCHED FOR ADJACENCY. The first version
    looked for `name="site_font_key" value="<key>"` as one string — and React
    emits `checked=""` BETWEEN those two attributes for the selected radio. So
    it passed for the eight faces nobody had chosen and failed for the one that
    was, which reads as "the face is missing" when it is the only one present.
    Attribute order is the renderer's business, not this guard's.
  */
  /*
    🔤 THE RADIO GRID BECAME THE ONE FONT DROPDOWN (owner 2026-09-29: "the font
    across all event hub editor. can be one style"). The choice posts from ONE
    hidden `site_font_key`; the faces are the one shelf list (`hubFontShelves`,
    every face — `hub-font-shelves.test.ts`), opened on tap, so a static render
    shows the button, set in the saved face.
  */
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
  const fields = inputs.filter((t) => t.includes('name="site_font_key"'));
  const valueOf = (tag: string) => /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? null;
  assert.deepEqual(fields.map(valueOf), ['cinzel'], 'one field, posting exactly the saved face');
  assert.match(html, /data-site-font=""/, 'the Typeface control is the font dropdown');
  // Each name is SET IN its face — the button shows the saved one in it.
  assert.match(html, /font-family:var\(--font-cinzel\)/, 'the label previews in its own face');
  // The source: the panel hands the dropdown a way back to the theme, and no list of its own.
  const panel = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'pro-panels.tsx'),
    'utf8',
  );
  const pick = /<FontPick\s[\s\S]*?\/>/.exec(panel)?.[0] ?? '';
  assert.match(pick, /name="site_font_key"/);
  assert.match(pick, /lead="The theme’s own"/, 'and a way back to the theme’s own face');
  assert.doesNotMatch(pick, /\boptions=/);
  // The theme's own posts '' — the action's "clear".
  const none = renderToStaticMarkup(
    React.createElement(ColorsPanel, { action: () => {}, eventId: 'E1', rowKey: 'colors', bgColor: null, buttonColor: null, artDirection: 'daylight' as const, fontKey: null }),
  );
  const noneFields = [...none.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]).filter((t) => t.includes('name="site_font_key"'));
  assert.deepEqual(noneFields.map(valueOf), [''], 'no face chosen posts "" (the theme’s own)');
});

test('⛔ the writer clears with "" and leaves an ABSENT field alone', () => {
  const actions = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'colors', 'actions.ts'),
    'utf8',
  );
  assert.match(actions, /fontRaw === '' \? null : sanitizeHubFontKey\(fontRaw\)/, 'empty clears, junk drops');
  assert.match(
    actions,
    /font !== undefined \? \{ site_font_key: font \} : \{\}/,
    'an absent field leaves the saved face alone — a save from a surface without this control must not reset it',
  );
});

test('🔒 the column is granted and the CHECK names exactly the offered faces', () => {
  const sql = readFileSync(
    join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20271242571950_the_couple_chooses_their_own_face.sql'),
    'utf8',
  );
  assert.match(sql, /GRANT SELECT \(site_font_key\) ON public\.events TO authenticated;/);
  assert.match(sql, /GRANT UPDATE \(site_font_key\) ON public\.events TO authenticated;/);
  assert.doesNotMatch(sql, /TO anon/, 'the guest site reads events through the admin client');
  // 🔑 The CHECK and the offered list must be the same set, or a face the couple
  // can pick is refused by the database — or one the app cannot render is stored.
  //
  // 🪤 THE LATEST MIGRATION THAT STATES THE CHECK IS THE ONE IN FORCE. Reading
  // the first one forever would pass while a later one narrowed it (or fail
  // while a later one correctly widened it — 2026-09-27, every font we ship).
  const dir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const stating = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /ADD CONSTRAINT events_site_font_key_check/.test(readFileSync(join(dir, f), 'utf8')));
  assert.ok(stating.length >= 2, `precondition: the original and the widening both state the CHECK (${stating.join(', ')})`);
  const latest = readFileSync(join(dir, stating[stating.length - 1] as string), 'utf8');
  const m = /site_font_key IN \(([^)]*)\)/s.exec(latest);
  assert.ok(m, 'the CHECK exists');
  const inCheck = [...(m[1] ?? '').matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(inCheck, [...HUB_FONT_KEYS].sort(), 'the CHECK and lib/hub-fonts.ts must agree exactly');
});
