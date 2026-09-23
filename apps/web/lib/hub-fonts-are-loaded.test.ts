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
import { readFileSync } from 'node:fs';
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

test('⛔ every offered face is declared by app/layout.tsx', () => {
  const declared = new Set(
    [...LAYOUT.matchAll(/variable:\s*'(--font-[a-z-]+)'/g)].map((m) => m[1] as string),
  );
  assert.ok(declared.size >= 8, `precondition: layout.tsx declares faces (${declared.size})`);
  const missing = HUB_FONTS.filter((f) => !declared.has(f.cssVar)).map((f) => `${f.key} → ${f.cssVar}`);
  assert.deepEqual(missing, [], `offered but never loaded — these render as a silent fallback: ${missing.join(', ')}`);
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
  const loaders = readFileSync(
    join(__dirname, '..', 'app', '[slug]', '_lib', 'loaders.ts'),
    'utf8',
  );
  const at = loaders.indexOf('const proSiteVars = proWatermarkHidden');
  assert.ok(at > 0, 'the face rides the Pro-gated bag');
  const block = loaders.slice(at, at + 700);
  assert.match(block, /hubFontVars\(/, 'and the face is in it');
  assert.match(block, /buildCustomSiteColorVars\(/, 'beside the colours, under one check');
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
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
  const radios = inputs.filter((t) => t.includes('name="site_font_key"'));
  const valueOf = (tag: string) => /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? null;
  const offered = new Set(radios.map(valueOf));

  for (const f of HUB_FONTS) {
    assert.ok(offered.has(f.key), `${f.key} must be offered`);
  }
  assert.ok(offered.has(''), 'and a way back to the theme’s own face');
  // Each name is SET IN its face — the one control where the label is the preview.
  assert.match(html, /font-family:var\(--font-cinzel\)/, 'the label previews in its own face');
  // The saved choice comes back checked, and only it.
  const checked = radios.filter((t) => /\bchecked\b/.test(t)).map(valueOf);
  assert.deepEqual(checked, ['cinzel'], `exactly the saved face is checked, saw ${JSON.stringify(checked)}`);
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
  const m = /site_font_key IN \(([^)]*)\)/s.exec(sql);
  assert.ok(m, 'the CHECK exists');
  const inCheck = [...(m[1] ?? '').matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(inCheck, [...HUB_FONT_KEYS].sort(), 'the CHECK and lib/hub-fonts.ts must agree exactly');
});
