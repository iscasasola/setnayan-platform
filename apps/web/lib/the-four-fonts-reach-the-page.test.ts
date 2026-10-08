/**
 * 🔤 THE COUPLE'S FOUR FONTS REACH THE PAGE — AND A PAGE WHOSE COUPLE CHOSE NONE IS BYTE FOR BYTE WHAT IT WAS.
 *
 * Owner, 2026-10-08, round 5: *"i think there are more than just 2 types of fonts to edit"* → Names · Headings ·
 * Text · Labels & buttons, with Fonts ▾ (a pairing) that fills all four. Controller's rulings the same night: the
 * stored shape is fonts only (`site_roles = { heading:{font}, body:{font}, highlight:{font} }`, Names stays
 * `site_font_key`); the names wear the Names font WHENEVER one is chosen; Headings follow Names while they have
 * none of their own. Measured on production that night: 0 of 16 events hold a `site_font_key` or a `site_roles`.
 *
 * 📌 THE FACT UNDER THIS (computed in a browser on the review copy's guest page): the masthead's names are
 * `font-pahina` — a fixed Fraunces — while the couple's one "Headings font" set `--font-display` · `--pahina-face`.
 * So that font moved ~200 headings and never the names; and Studio › Look's sample drew its names with the
 * headings' face — the SAMPLE was wrong.
 *
 *   (1) the stored shape — fonts only; everything else is dropped on read;
 *   (2) what each font does — the variables and the marks, and NOTHING when nothing is chosen;
 *   (3) THE GUEST PAGE'S OWN FUNCTION, run both ways: no font → no mark, no new variable, the same bag as a row
 *       that has no such columns at all; a font → its variable and its mark; Headings follow Names;
 *   (4) the names are marked on the three hero surfaces and nowhere else, ONE rule reaches them and only under
 *       the mark — and no rule moves the other `font-pahina` texts;
 *   (5) the sample screen draws its names as the hero does, and wears the scope's own marks;
 *   (6) drafted, free at Apply, compared as the page reads it;
 *   (7) the four rows and Fonts ▾ — rendered; one pick is one held write.
 *
 * NOT TESTED HERE: a browser computing the font (there is no CSS engine in this suite). (4) holds the rule's
 * words and its reach; the computed face is looked at on the review copy — see the changelog.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import ts from 'typescript';
import { stripComments } from './strip-comments';
import { HUB_FONT_BY_KEY, hubFontVars, type HubFontKey } from './hub-fonts';
import { hubButtonPage, resolveHubButtons } from './hub-buttons';
import { compositeOver } from './hub-legibility';
import { INVITE_THEMES, INVITE_THEME_IDS, type InviteThemeId } from './invite-themes';
import { ombreLook, ombreRamp, parseSiteBackground } from './ombre';
import { dressedTheme, paletteColourVars } from './theme-colours';
import { pageWordBase, pinPlateInk, pinWordInks, proSiteVarsFor } from '../app/[slug]/_lib/pro-site-vars';
import { SITE_FONT_ROLES, sanitizeSiteRoles } from './site-roles';
import { siteFontLook } from './site-role-look';
import { FONT_ROWS, FONT_ROW_LABEL, FONT_ROW_LEAD, fontChoiceOf, fontChoiceWrite, fontPairingOf, fontPairings } from './font-pairings';
import { HUB_DRAFT_LOOK_COLUMNS, emptyHubDraft, eventColumnChange, mergeHubDraft, planHubDraftApply, sanitizeHubDraftEventValue, type HubLiveState } from './hub-draft';
import { HUB_FREE_LOOK_EVENT_COLUMNS, HUB_LOOK_EVENT_COLUMNS } from './hub-look-pro';
import { lookSampleScope, type LookSampleRow } from './look-sample';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const E = 'app/dashboard/[eventId]/website/editor/_components';
const G = 'app/[slug]/_components';
const faceOf = (k: HubFontKey) => `var(${HUB_FONT_BY_KEY[k].cssVar}), ${HUB_FONT_BY_KEY[k].fallback}`;
const bare = (k: HubFontKey) => `var(${HUB_FONT_BY_KEY[k].cssVar})`;

/* ── (1) the stored shape ─────────────────────────────────────────────── */

test('(1) `site_roles` is fonts only — three roles, a real font key each; colours, a button font and junk are dropped on read', () => {
  assert.deepEqual([...SITE_FONT_ROLES], ['heading', 'body', 'highlight']);
  const whole = { heading: { font: 'cinzel' }, body: { font: 'cormorant' }, highlight: { font: 'cormorantsc' } };
  assert.deepEqual(sanitizeSiteRoles(whole), whole);
  /* The shape the column was first drawn for (#6442, never shipped): its colours and its separate button font go. */
  assert.deepEqual(
    sanitizeSiteRoles({ heading: { color: '#112233', font: 'cinzel' }, body: { font: 'cormorant', color: '#000000' }, button: { font: 'playfair' }, highlight: { font: 'cormorantsc', color: '#aa0000' } }),
    whole,
  );
  assert.equal(sanitizeSiteRoles({ heading: { color: '#112233' }, button: { font: 'playfair' } }), null, 'a value with no font the page would wear is not null');
  for (const junk of [null, undefined, '', 'cinzel', [], {}, { heading: null }, { heading: 'cinzel' }, { heading: { font: 'not-a-font' } }, { heading: { font: ['cinzel'] } }, { names: { font: 'cinzel' } }]) {
    assert.equal(sanitizeSiteRoles(junk), null, `kept ${JSON.stringify(junk)}`);
  }
  assert.deepEqual(sanitizeSiteRoles({ body: { font: 'cormorant' }, heading: { font: 'nope' } }), { body: { font: 'cormorant' } }, 'one bad role took the good one with it');
  /* Tiny on purpose — it rides the draft library into the Maker's first load: no role look, no pairings, no themes. */
  const src = read('lib/site-roles.ts');
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['@/lib/hub-fonts'], 'the sanitiser grew a dependency the Maker’s first load would pay for');
  assert.deepEqual([...src.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]), ['SITE_FONT_ROLES', 'sanitizeSiteRoles'], 'the first-load file exports more than the list and its one sanitiser');
});

/* ── (2) what each font does ──────────────────────────────────────────── */

test('(2) each font sets its own variables and wears its own mark — and nothing chosen emits nothing at all', () => {
  assert.deepEqual(siteFontLook(null, null), { vars: {}, marks: null });
  assert.deepEqual(siteFontLook('', {}), { vars: {}, marks: null });
  assert.deepEqual(siteFontLook('not-a-font', { heading: { font: 'nope' } }), { vars: {}, marks: null });
  /* NAMES — its own variable and mark; it does NOT touch the headings' variables here (`hubFontVars` keeps doing that). */
  assert.deepEqual(siteFontLook('playfair', null), { vars: { '--hub-names-face': faceOf('playfair') }, marks: 'names' });
  /* HEADINGS — the two variables the headings read, written as `hubFontVars` writes them. No mark: no rule is needed. */
  assert.deepEqual(siteFontLook(null, { heading: { font: 'cinzel' } }), { vars: { '--font-display': bare('cinzel'), '--pahina-face': bare('cinzel') }, marks: null });
  assert.deepEqual(Object.keys(hubFontVars('cinzel')).sort(), ['--font-display', '--pahina-face'], 'anti-vacuity: the Names font no longer sets these two — re-read what Headings must take over');
  assert.deepEqual(siteFontLook(null, { heading: { font: 'cinzel' } }).vars, hubFontVars('cinzel'), 'a Headings font is not written the way the page already reads one');
  /* TEXT · LABELS & BUTTONS. */
  assert.deepEqual(siteFontLook(null, { body: { font: 'cormorant' } }), { vars: { '--font-body': faceOf('cormorant') }, marks: 'body' });
  assert.deepEqual(siteFontLook(null, { highlight: { font: 'cormorantsc' } }), { vars: { '--font-mono': faceOf('cormorantsc'), '--hub-role-button-font': faceOf('cormorantsc') }, marks: 'eyebrow button' });
  /* All four. */
  const all = siteFontLook('playfair', { heading: { font: 'cinzel' }, body: { font: 'cormorant' }, highlight: { font: 'cormorantsc' } });
  assert.equal(all.marks, 'names body eyebrow button');
  assert.deepEqual(Object.keys(all.vars).sort(), ['--font-body', '--font-display', '--font-mono', '--hub-names-face', '--hub-role-button-font', '--pahina-face']);
});

/* ── (3) the guest page's own function, both ways ─────────────────────── */

/** `guestLookFrom`, lifted out of the guest route's file as SOURCE and run with the very functions it imports. */
function guestLookFromSource(): (event: unknown, hub: { theme: InviteThemeId; accent: string; monogram: string }, proActive: boolean) => { vars: Record<string, string> | null; roles: string | null } {
  const loaders = raw('app/[slug]/_lib/loaders.ts');
  const start = loaders.indexOf('export function guestLookFrom(');
  assert.ok(start > 0, 'guestLookFrom is no longer in app/[slug]/_lib/loaders.ts — re-aim this guard');
  const source = loaders.slice(start, loaders.indexOf('\n}\n', start) + 2).replace('export function', 'function');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const deps = { paletteColourVars, proSiteVarsFor, parseSiteBackground, dressedTheme, ombreLook, ombreRamp, compositeOver, pinWordInks, pageWordBase, pinPlateInk, resolveHubButtons, hubButtonPage, siteFontLook };
  return new Function(...Object.keys(deps), `${js}\nreturn guestLookFrom;`)(...Object.values(deps));
}

const BOARD = { reception: ['#525252', '#C5A059', '#373B31', '#C9A9A6', '#E8D9BD'] };
const ROWS: Record<string, Record<string, unknown>> = {
  'nothing set': {},
  'a board': { role_palette: BOARD },
  'a dark page colour': { role_palette: BOARD, site_bg_color: '#1a1410' },
  'a blend, candlelight': { site_bg_color: 'ombre:dawn:#f6f1e7:#c5a059', site_art_direction: 'candlelight' },
  'a button shape': { role_palette: BOARD, site_button_style: 'pill-outline' },
};

test('(3) THE GUEST PAGE, NO FONT CHOSEN: no mark and no new variable — the very bag a row with no font columns gets', () => {
  const guest = guestLookFromSource();
  let seen = 0;
  for (const themeId of INVITE_THEME_IDS) {
    for (const [name, row] of Object.entries(ROWS)) {
      const hub = { theme: themeId, accent: '#000000', monogram: '' };
      /* The row as it is read today (the columns present, empty) … */
      const now = guest({ ...row, site_font_key: null, site_roles: null }, hub, false);
      /* … and a row that has never heard of the columns. */
      const before = guest(row, hub, false);
      assert.deepEqual(now, before, `${themeId} · ${name}: an event with no font chosen is not the page it was`);
      assert.equal(now.roles, null, `${themeId} · ${name}: a mark is worn with nothing chosen — the names rule could match`);
      for (const k of ['--hub-names-face', '--hub-role-button-font']) assert.equal(now.vars?.[k], undefined, `${themeId} · ${name}: ${k} is set with nothing chosen`);
      /* Junk in the columns is nothing chosen. */
      assert.deepEqual(guest({ ...row, site_font_key: 'not-a-font', site_roles: { heading: { color: '#112233' }, button: { font: 'playfair' } } }, hub, false), before);
      seen += 1;
    }
  }
  assert.equal(seen, INVITE_THEME_IDS.length * Object.keys(ROWS).length);
});

test('(3b) THE GUEST PAGE, FONTS CHOSEN: the names wear the Names font; Headings follow Names until they have their own; Text and Labels & buttons reach their variables', () => {
  const guest = guestLookFromSource();
  for (const themeId of INVITE_THEME_IDS) {
    for (const [name, row] of Object.entries(ROWS)) {
      const hub = { theme: themeId, accent: '#000000', monogram: '' };
      const where = `${themeId} · ${name}`;
      const none = guest(row, hub, false);
      /* NAMES ONLY — for a free event too (fonts are free). */
      const names = guest({ ...row, site_font_key: 'playfair' }, hub, false);
      assert.equal(names.roles, 'names', `${where}: the names are not told to wear the Names font`);
      assert.equal(names.vars?.['--hub-names-face'], faceOf('playfair'));
      /* HEADINGS FOLLOW NAMES: the two display variables are the Names font's — exactly what a "Headings font" always set. */
      assert.equal(names.vars?.['--font-display'], bare('playfair'), `${where}: Headings do not follow Names`);
      assert.equal(names.vars?.['--pahina-face'], bare('playfair'));
      /* …and nothing else moved: every other variable is the page with no font. */
      const rest = (v: Record<string, string> | null) => Object.fromEntries(Object.entries(v ?? {}).filter(([k]) => !['--hub-names-face', '--font-display', '--pahina-face'].includes(k)));
      /* (A bag that holds anything has its plate ink pinned — `pinPlateInk`, as it always was once a font made the bag
         non-empty. That is the page's own rule, so it is applied to the comparison, not excused.) */
      const pinned = pinPlateInk({ ...(none.vars ?? {}), '--pahina-face': 'x' }, themeId);
      assert.deepEqual(rest(names.vars), rest(pinned), `${where}: a Names font changed something that is not a font`);
      /* HEADINGS OF THEIR OWN take the two variables; the names keep the Names font. */
      const both = guest({ ...row, site_font_key: 'playfair', site_roles: { heading: { font: 'cinzel' } } }, hub, false);
      assert.equal(both.vars?.['--font-display'], bare('cinzel'), `${where}: a Headings font lost to the Names font`);
      assert.equal(both.vars?.['--pahina-face'], bare('cinzel'));
      assert.equal(both.vars?.['--hub-names-face'], faceOf('playfair'), `${where}: the names took the Headings font`);
      assert.equal(both.roles, 'names');
      /* HEADINGS ALONE: the headings move; the names are NOT marked (they stay as the page draws them). */
      const heading = guest({ ...row, site_roles: { heading: { font: 'cinzel' } } }, hub, false);
      assert.equal(heading.roles, null, `${where}: the names are marked with no Names font chosen`);
      assert.equal(heading.vars?.['--font-display'], bare('cinzel'));
      /* TEXT · LABELS & BUTTONS. */
      const two = guest({ ...row, site_roles: { body: { font: 'cormorant' }, highlight: { font: 'cormorantsc' } } }, hub, false);
      assert.equal(two.roles, 'body eyebrow button');
      assert.equal(two.vars?.['--font-body'], faceOf('cormorant'));
      assert.equal(two.vars?.['--font-mono'], faceOf('cormorantsc'));
      assert.equal(two.vars?.['--hub-role-button-font'], faceOf('cormorantsc'));
      assert.equal(two.vars?.['--font-display'], none.vars?.['--font-display'], `${where}: Text or Labels moved the headings`);
    }
  }
  /* The guest page reads the column, and the scope wears the marks. */
  const select = /loadEventShell = cache[\s\S]*?\.select\(\s*'([^']+)'/.exec(raw('app/[slug]/_lib/loaders.ts'))?.[1] ?? '';
  assert.match(select, /\bsite_roles\b/, 'the guest loader never reads the fonts');
  assert.match(select, /\bsite_font_key\b/);
  assert.match(read(`${G}/host-draft-look.tsx`), /roles: look\?\.roles \?\? null,/);
  assert.match(read(`${G}/guest-look-scope.tsx`), /data-hub-roles=\{worn && roles \? roles : undefined\}/, 'the scope does not wear the marks — or wears them on a page that dresses itself');
});

/* ── (4) the names: three hero surfaces, one rule, nothing else moved ─── */

function tsxUnder(dir: string): string[] {
  return readdirSync(join(WEB, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? (d.name === 'node_modules' || d.name.startsWith('.') ? [] : tsxUnder(`${dir}/${d.name}`)) : /\.tsx$/.test(d.name) && !/\.test\./.test(d.name) ? [`${dir}/${d.name}`] : [],
  );
}

test('(4) the names are marked on the three hero surfaces and nowhere else; ONE rule reaches them, only under the mark; no rule moves the other font-pahina texts', () => {
  /* WHERE the mark is drawn — every file, counted. */
  const found: Record<string, number> = {};
  for (const f of tsxUnder('app')) {
    const text = raw(f);
    if (!text.includes('data-hub-names')) continue;
    const n = (stripComments(text).match(/data-hub-names/g) ?? []).length;
    if (n > 0) found[f] = n;
  }
  assert.deepEqual(found, {
    'app/[slug]/_components/pahina-masthead.tsx': 3, // the Event Hub's masthead — its three designs
    'app/[slug]/_components/private-landing.tsx': 1, // the private landing
    'app/_components/door/door-shell.tsx': 1, // the invitation's header — only when its title IS the names
    'app/dashboard/[eventId]/launch/_components/look-sample.tsx': 1, // Studio › Look's sample of the hero
  });
  /* The masthead: every names heading carries it, and it is ON a names heading each time. */
  const mast = read(`${G}/pahina-masthead.tsx`);
  const namesHeads = [...mast.matchAll(/<h1\s+\{\.\.\.el\('names'\)\}\s+([^>]*?)>/g)].map((m) => m[1]!);
  assert.equal(namesHeads.length, 3, 'the masthead’s names headings changed — each must carry the mark');
  for (const attrs of namesHeads) assert.ok(attrs.includes('data-hub-names=""'), `a names heading does not carry the mark: ${attrs.slice(0, 80)}`);
  assert.equal((mast.match(/\{\.\.\.el\('names'\)\}/g) ?? []).length, 3);
  /* Two of the three are `font-pahina` in the tag itself (the third takes its class by design) — the fixed face no font reached. */
  assert.ok(namesHeads.filter((a) => a.includes('font-pahina')).length >= 2);
  /* The private landing's big names; the invitation header only where the title is the couple's names. */
  assert.match(read(`${G}/private-landing.tsx`), /<h1 data-hub-names="" className="font-display[^"]*">\s*\{event\.display_name\}/);
  assert.match(read('app/_components/door/door-shell.tsx'), /<h1 \{\.\.\.\(titleIsNames \? \{ 'data-hub-names': '' \} : \{\}\)\}/);
  assert.match(read('app/_components/door/door-shell.tsx'), /titleIsNames = false,/, 'every door’s title is marked as names by default');
  assert.match(read('app/[slug]/invite/reply/page.tsx'), /title=\{\(event\.display_name as string \| null\) \|\| guestName\}\s*titleIsNames=\{Boolean\(event\.display_name\)\}/, 'a GUEST’s own name would wear the couple’s Names font');

  /* THE STYLESHEET: exactly one rule names the mark's target, and it is gated by the scope's own mark. */
  const css = stripComments(raw('app/globals.css'));
  const rules = [...css.matchAll(/([^{}]*\[data-hub-names\][^{}]*)\{([^}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!.trim().replace(/\s+/g, ' ')]);
  assert.deepEqual(rules, [["[data-hub-roles~='names'] [data-hub-names]", 'font-family: var(--hub-names-face);']], 'the names rule is not the ONE rule, or matches without the couple having chosen a Names font');
  /* Every rule keyed on the marks: these four, and none that reaches `font-pahina` (the ~100 other texts do not move). */
  const marked = [...css.matchAll(/([^{}]*\[data-hub-roles~='[a-z]+'\][^{}]*)\{([^}]*)\}/g)].map((m) => m[1]!.trim().replace(/\s+/g, ' '));
  assert.deepEqual(marked, [
    "[data-hub-roles~='names'] [data-hub-names]",
    "[data-hub-roles~='body']",
    "[data-hub-roles~='eyebrow'] .pahina-eyebrow",
    "[data-hub-roles~='button'] :is(.button-primary, .button-secondary, [data-rsvp-answer]), [data-hub-roles~='button'] [data-arrival-action] a.bg-mulberry",
  ]);
  assert.doesNotMatch(css, /data-hub-roles[^{}]*font-pahina|--font-pahina-display\s*:/, 'a rule or a variable now moves every font-pahina text — only the names may change');
  /* The marks the stylesheet keys on are exactly the marks the page can wear. */
  assert.deepEqual([...new Set(marked.flatMap((sel) => [...sel.matchAll(/data-hub-roles~='([a-z]+)'/g)].map((m) => m[1]!)))].sort(), 'names body eyebrow button'.split(' ').sort());
  /* The hooks those rules reach for still exist on the page. */
  for (const [hook, min] of [['pahina-eyebrow', 20], ['data-rsvp-answer', 2], ['data-arrival-action', 1], ['button-primary', 5]] as const) {
    assert.ok(tsxUnder('app/[slug]').filter((f) => raw(f).includes(hook)).length >= min, `the page no longer draws ${hook} — a font rule reaches for nothing`);
  }
});

/* ── (5) the sample screen agrees with the page ───────────────────────── */

test('(5) the sample draws its names as the hero does — font-pahina + the mark — and wears the scope’s own marks; its look IS the guest page’s', () => {
  const sample = read('app/dashboard/[eventId]/launch/_components/look-sample.tsx');
  assert.match(sample, /<p data-look-sample-names="" data-hub-names="" className="font-pahina /, 'the sample’s names are not drawn as the masthead draws them (it used to wear the headings’ face — a font the page never used for names)');
  assert.doesNotMatch(sample, /data-look-sample-names=""[^>]*font-display/);
  assert.match(sample, /data-hub-roles=\{scope\.roles \?\? undefined\}/);
  /* The fonts come from the scope's own variables — never spread a second time (that put Names back over Headings). */
  assert.doesNotMatch(sample, /hubFontVars/, 'the sample spreads the Names font over the scope again');
  assert.match(sample, /site_roles: now\.roles \?\? null,/);
  /* The section heading on the sample is a heading: it follows `--font-display`. */
  assert.match(sample, /data-look-sample-style="heading" className="font-display /);
  /* …and the scope it wears is the guest page's, fonts included (the sweep in the-look-sample-is-the-guest-look holds every look). */
  const guest = guestLookFromSource();
  for (const themeId of INVITE_THEME_IDS) {
    for (const fonts of [{ site_font_key: null, site_roles: null }, { site_font_key: 'playfair', site_roles: null }, { site_font_key: 'playfair', site_roles: { heading: { font: 'cinzel' }, body: { font: 'cormorant' }, highlight: { font: 'cormorantsc' } } }, { site_font_key: null, site_roles: { heading: { font: 'cinzel' } } }]) {
      const row: LookSampleRow = { role_palette: BOARD, site_bg_color: null, site_button_color: null, site_button_style: null, site_art_direction: null, ...fonts } as LookSampleRow;
      const s = lookSampleScope(row, themeId);
      const g = guest(row, { theme: themeId, accent: '#000000', monogram: '' }, true);
      assert.deepEqual({ vars: s.vars, roles: s.roles }, { vars: g.vars, roles: g.roles }, `${themeId} · ${JSON.stringify(fonts)}: the sample and the guest page wear different fonts`);
    }
  }
});

/* ── (6) drafted, free, compared as the page reads it ─────────────────── */

test('(6) the fonts are drafted, free at Apply, and a change is counted as the page reads it', () => {
  assert.ok((HUB_DRAFT_LOOK_COLUMNS as readonly string[]).includes('site_roles'), 'the host canvas would not re-wear drafted fonts');
  assert.ok((HUB_FREE_LOOK_EVENT_COLUMNS as readonly string[]).includes('site_roles'));
  assert.ok(!(HUB_LOOK_EVENT_COLUMNS as readonly string[]).includes('site_roles'), 'a font became Pro');
  const whole = { heading: { font: 'cinzel' }, body: { font: 'cormorant' } };
  assert.deepEqual(sanitizeHubDraftEventValue('site_roles', { ...whole, button: { font: 'playfair' }, body: { font: 'cormorant', color: '#000' } }), whole);
  assert.equal(sanitizeHubDraftEventValue('site_roles', { heading: { color: '#112233' } }), undefined, 'junk is held in the draft');
  assert.equal(sanitizeHubDraftEventValue('site_roles', null), null, 'handing every font back cannot be drafted');
  /* A change is a change of what the page would wear: key order, `{}` and the dropped fields are not one. */
  assert.equal(eventColumnChange('site_roles', null, {}), 'none');
  assert.equal(eventColumnChange('site_roles', null, { heading: { color: '#112233' } }), 'none');
  assert.equal(eventColumnChange('site_roles', { heading: { font: 'cinzel' }, body: { font: 'cormorant' } }, { body: { font: 'cormorant' }, heading: { font: 'cinzel' } }), 'none');
  assert.notEqual(eventColumnChange('site_roles', null, whole), 'none');
  assert.notEqual(eventColumnChange('site_roles', whole, null), 'none');
  assert.notEqual(eventColumnChange('site_roles', whole, { ...whole, heading: { font: 'playfair' } }), 'none');
  const d = mergeHubDraft(emptyHubDraft(), { events: { site_font_key: 'playfair', site_roles: whole } });
  assert.deepEqual(d.events.site_roles, whole);
  const LIVE = { events: {}, widgets: {} } as unknown as HubLiveState;
  assert.equal(planHubDraftApply(d, LIVE, false).refused.length, 0, 'Apply held a free couple’s fonts');
});

/* ── (7) the four rows and Fonts ▾ ────────────────────────────────────── */

test('(7) four rows and Fonts ▾ — each a dropdown; a pairing fills all four; Headings equal to Names is not stored twice; one pick is one held write', async () => {
  assert.deepEqual([...FONT_ROWS].map((r) => FONT_ROW_LABEL[r]), ['Names', 'Headings', 'Text', 'Labels & buttons']);
  assert.deepEqual([...FONT_ROWS].map((r) => FONT_ROW_LEAD[r]), ['Event Hub font', 'Same as Names', 'Event Hub font', 'Event Hub font']);
  /* What is stored ↔ the four rows, both ways. */
  const stored = { heading: { font: 'cinzel' }, body: { font: 'cormorant' }, highlight: { font: 'cormorantsc' } };
  const four = fontChoiceOf('playfair', stored);
  assert.deepEqual(four, { names: 'playfair', heading: 'cinzel', body: 'cormorant', highlight: 'cormorantsc' });
  assert.deepEqual(fontChoiceWrite(four), { site_font_key: 'playfair', site_roles: stored });
  assert.deepEqual(fontChoiceWrite({ names: null, heading: null, body: null, highlight: null }), { site_font_key: null, site_roles: null }, 'nothing chosen is stored as something');
  /* Headings = Names IS "follows Names": not stored a second time. */
  assert.deepEqual(fontChoiceWrite({ names: 'playfair', heading: 'playfair', body: null, highlight: null }), { site_font_key: 'playfair', site_roles: null });
  /* PAIRINGS: the page's own = everything handed back; another theme's fills Names (+ Headings, by following), Text and Labels. */
  for (const own of INVITE_THEME_IDS) {
    const list = fontPairings(own);
    const mine = list.find((p) => p.id === own)!;
    assert.deepEqual(fontChoiceWrite(mine.choice), { site_font_key: null, site_roles: null }, `${own}: its own pairing writes something`);
    assert.equal(fontPairingOf(own, { names: null, heading: null, body: null, highlight: null }), own);
    assert.ok(list.length >= 2, `${own}: no pairing to pick but its own`);
    for (const p of list) {
      if (p.id === own) continue;
      const t = INVITE_THEMES[p.id];
      assert.equal(HUB_FONT_BY_KEY[p.choice.names!].family, t.fonts.heading, `${p.id}: Names is not the pairing’s heading face`);
      assert.equal(p.choice.heading, null, 'a pairing stores a Headings font equal to its Names');
      assert.equal(HUB_FONT_BY_KEY[p.choice.body!].family, t.fonts.body);
      assert.equal(HUB_FONT_BY_KEY[p.choice.highlight!].family, t.fonts.labels);
      assert.equal(fontPairingOf(own, p.choice), p.id, `${p.id}: a picked pairing is not read back as itself`);
      /* One row changed alone → "Your own mix". */
      assert.equal(fontPairingOf(own, { ...p.choice, body: p.choice.body === 'cinzel' ? 'playfair' : 'cinzel' }), null);
    }
  }

  /* THE ROWS, RENDERED. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FontsLookRows } = await import(`../${E}/fonts-look-rows`);
  const html = renderToStaticMarkup(React.createElement(FontsLookRows, { eventId: 'E1', themeId: 'house', fontKey: 'playfair', roles: { body: { font: 'cormorant' } } }));
  const rows = [...html.matchAll(/data-bg-row="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['fonts-pairing', 'font-names', 'font-heading', 'font-body', 'font-highlight'], 'not Fonts ▾ and the four rows, in order');
  assert.equal((html.match(/aria-haspopup="listbox"/g) ?? []).length, 5, 'a row is not the one dropdown');
  for (const label of ['Fonts', 'Names', 'Headings', 'Text', 'Labels &amp; buttons']) assert.ok(html.includes(`>${label}<`) || html.includes(`${label}</`), `the row "${label}" is not named`);
  const row = (data: string) => html.slice(html.indexOf(`data-bg-row="${data}"`), html.indexOf('data-bg-row="', html.indexOf(`data-bg-row="${data}"`) + 20) >>> 0 || undefined);
  assert.ok(row('font-names').includes(HUB_FONT_BY_KEY.playfair.label), 'Names does not show the stored font');
  assert.ok(row('font-heading').includes('Same as Names'), 'Headings with no font of its own does not say it follows Names');
  assert.ok(row('font-body').includes(HUB_FONT_BY_KEY.cormorant.label));
  assert.ok(row('font-highlight').includes('Event Hub font'));
  assert.ok(row('fonts-pairing').includes('Your own mix'), 'a mix that is no pairing is named as one');
  assert.doesNotMatch(html, /type="submit"|>Save<|<form/, 'the font rows carry a form or a Save button');
  /* With nothing chosen the pairing reads the page's own theme. */
  const none = renderToStaticMarkup(React.createElement(FontsLookRows, { eventId: 'E1', themeId: 'house', fontKey: null, roles: null }));
  assert.ok(none.slice(none.indexOf('data-bg-row="fonts-pairing"'), none.indexOf('data-bg-row="font-names"')).includes(INVITE_THEMES.house.name));

  /* ONE WRITE, HELD, THROUGH THE DRAFT DOOR — reached only from a pick; the sample is told at the tap and put back on a refusal. */
  const src = read(`${E}/fonts-look-rows.tsx`);
  assert.equal(src.split('draftAction(eventId, fd)').length - 1, 1, 'the rows write from more than one place');
  assert.match(src, /const r = await makerRedrawSave\(\(\) => draftAction\(eventId, fd\), requestMakerRefresh\);/, 'a font pick is not one held write');
  assert.match(src, /fd\.set\('patch', JSON\.stringify\(\{ events: write \}\)\);/);
  assert.match(src, /if \(JSON\.stringify\(write\) === JSON\.stringify\(fontChoiceWrite\(choice\)\)\) return;/, 'a pick that changes nothing still writes');
  assert.doesNotMatch(src, /router\.refresh|useRouter|setInterval|setTimeout|fetch\(/);
  assert.match(src, /setChoice\(next\);\s*setError\(null\);\s*show\(next\);/, 'the sample is not told at the tap');
  assert.match(src, /setChoice\(saved\.current\);\s*show\(saved\.current\);\s*setError\(/, 'a refused font stays on the rows or the sample');
  assert.equal([...src.matchAll(/\bcommit\(/g)].length, 2, 'commit is called from something other than a pairing pick and a row pick');
  assert.match(src, /if \(picked\) commit\(picked\.choice\);/);
  assert.match(src, /onPick=\{\(key\) => commit\(\{ \.\.\.choice, \[row\]: key \}\)\}/);
  for (const m of src.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n {2}\}, \[/g)) assert.doesNotMatch(m[1]!, /commit\(|show\(|draftAction|makerRedrawSave/, 'opening the rows writes or previews');
  /* The Studio's Font part draws them; the shipped Maker keeps its one Typeface row. */
  assert.match(read(`${E}/pro-panels.tsx`), /if \(part === 'font' && maker\?\.stagesStudio === true\) \{\s*return <FontsLookRows /);
  assert.match(read('app/dashboard/[eventId]/website/editor/page.tsx'), /siteRoles=\{\(drafted as \{ site_roles\?: unknown \}\)\.site_roles \?\? null\}/);
});
