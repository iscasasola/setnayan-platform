/**
 * elements-are-roles.test.ts — STUDIO › LOOK › ELEMENTS IS BY ROLE, AND A ROLE'S
 * OWN FONT AND COLOUR REACH THE PAGE.
 *
 * Owner 2026-10-08 (DECISION_LOG "APPROVED — THE LOOK RESTUDY: BACKGROUND ·
 * ELEMENTS · MUSIC"; contract `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.2,
 * § 3.5, § 6 row 3), verbatim: *"colors here is not color of the background but
 * the colors of the different fonts, and buttons and highlights"* · *"fonts
 * will be multiple fonts like, details, button font, header font, etc."*
 *
 * Held here, each where it can be EXECUTED:
 *   (1) the shape holds only what had no home — one fact, one column;
 *   (2) nothing set → nothing emitted (a page nobody changed is byte-identical);
 *       something set → the variables and the marks the guest page reads;
 *   (3) the draft holds it, counts it, never asks Pro for it, names it at Apply;
 *   (4) the guest page's own look composition wears it LAST — over the palette,
 *       the couple's colours and an ombré — and the scope wears the marks;
 *   (5) Pairing ▾ is the shipped theme pairings, applied as a set — no new data;
 *   (6) the Studio draws Pairing ▾ and four role rows with an AA badge each;
 *       the Headings font and the Buttons control are the SHIPPED ones, placed
 *       in their role and never drawn twice;
 *   (7) the column: one ALTER, both grants, nothing to anon, the view rebuilt.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { SITE_ROLES, SITE_ROLE_FIELDS, sanitizeSiteRoles, withSiteRole } from './site-roles';
import {
  SITE_ROLE_AA,
  SITE_ROLE_LABEL,
  elementsWears,
  fontPairingOf,
  fontPairingWrite,
  fontPairings,
  siteRoleContrast,
  siteRoleMarks,
  siteRoleVars,
} from './site-role-look';
import { HUB_DRAFT_EVENT_LABEL, HUB_DRAFT_LOOK_COLUMNS, eventColumnChange, eventItemIsPro, sanitizeHubDraftEventValue } from './hub-draft';
import { HUB_FREE_LOOK_EVENT_COLUMNS, hubColumnKind } from './hub-look-pro';
import { HUB_DRAFT_EVENT_PLACE } from './hub-draft-change-lines';
import { HUB_FONT_BY_KEY } from './hub-fonts';
import { INVITE_THEMES, INVITE_THEME_IDS } from './invite-themes';
import { LOOK_PARTS, LOOK_ROW_OF, LOOK_SECTION_PARTS } from './maker-look-sections';

(globalThis as unknown as { React: unknown }).React = React;
/* The page's look and the Studio's rows reach server-only modules — stood in for, as the other render guards do. */
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const REPO = join(WEB, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const G = 'app/[slug]';

const FULL = { heading: { color: '#5B4A6B' }, body: { font: 'lora', color: '#2C2A29' }, button: { font: 'jost' }, highlight: { font: 'cormorantsc', color: '#A9834B' } };

/* ── (1) the shape ────────────────────────────────────────────────────── */

test('(1) the roles hold only what had no home — the Headings font and the Buttons fill keep their own columns', () => {
  assert.deepEqual([...SITE_ROLES], ['heading', 'body', 'button', 'highlight']);
  assert.deepEqual(SITE_ROLES.map((r) => SITE_ROLE_LABEL[r]), ['Headings', 'Details', 'Buttons', 'Highlights']);
  assert.deepEqual(SITE_ROLE_FIELDS, { heading: ['color'], body: ['font', 'color'], button: ['font'], highlight: ['font', 'color'] });
  // Kept exactly, hexes lower-cased.
  assert.deepEqual(sanitizeSiteRoles(FULL), {
    heading: { color: '#5b4a6b' },
    body: { font: 'lora', color: '#2c2a29' },
    button: { font: 'jost' },
    highlight: { font: 'cormorantsc', color: '#a9834b' },
  });
  // 🔑 One fact, one column: `heading.font` is `site_font_key`, `button.fill` is `site_button_color` — never stored twice.
  assert.equal(sanitizeSiteRoles({ heading: { font: 'lora' }, button: { fill: '#112233', label: '#ffffff', color: '#112233' } }), null, 'a fact with a column of its own is stored a second time');
  assert.deepEqual(sanitizeSiteRoles({ heading: { font: 'lora', color: '#112233' } }), { heading: { color: '#112233' } });
  // Nothing a couple could type reaches the page: a made-up role, a made-up font, a colour that is not a plain hex.
  assert.equal(sanitizeSiteRoles({ footer: { color: '#112233' }, body: { font: 'comic-sans', color: 'red; background:url(x)' } }), null);
  for (const junk of [null, undefined, 'x', 7, [], [FULL], {}, { body: {} }, { body: [] }]) assert.equal(sanitizeSiteRoles(junk), null, `${JSON.stringify(junk)} is kept`);
  // One field set, and handed back — an emptied role, and an emptied value, are never stored.
  const one = withSiteRole(null, 'body', 'color', '#112233');
  assert.deepEqual(one, { body: { color: '#112233' } });
  assert.deepEqual(withSiteRole(one, 'highlight', 'font', 'jost'), { body: { color: '#112233' }, highlight: { font: 'jost' } });
  assert.equal(withSiteRole(one, 'body', 'color', null), null, 'handing the last pick back leaves an empty object');
  assert.deepEqual(withSiteRole(sanitizeSiteRoles(FULL), 'body', 'font', null), { heading: { color: '#5b4a6b' }, body: { color: '#2c2a29' }, button: { font: 'jost' }, highlight: { font: 'cormorantsc', color: '#a9834b' } });
});

/* ── (2) the page variables ───────────────────────────────────────────── */

test('(2) nothing set → nothing emitted; a role set → the variables and the marks the page reads', () => {
  assert.deepEqual(siteRoleVars(null, { paper: '#ffffff' }), {}, 'a page nobody changed gets a variable');
  assert.equal(siteRoleMarks(null), null, 'a page nobody changed gets a mark');
  const roles = sanitizeSiteRoles(FULL);
  const vars = siteRoleVars(roles, { paper: '#ffffff' });
  const stack = (key: 'lora' | 'jost' | 'cormorantsc') => `var(${HUB_FONT_BY_KEY[key].cssVar}), ${HUB_FONT_BY_KEY[key].fallback}`;
  assert.deepEqual(vars, {
    '--font-body': stack('lora'),
    '--color-ink': '44 42 41',
    '--font-mono': stack('cormorantsc'),
    '--color-terracotta': '169 131 75',
    // The hover and pressed steps move AWAY from the paper — darker on a light page.
    '--color-terracotta-600': '149 115 66',
    '--color-terracotta-700': '128 100 57',
    '--hub-btn-font': stack('jost'),
    '--hub-heading': '#5b4a6b',
  });
  assert.equal(siteRoleMarks(roles), 'heading body button eyebrow');
  // …and lighter on a dark page.
  const dark = siteRoleVars({ highlight: { color: '#a9834b' } }, { paper: '#1e2229' });
  assert.equal(dark['--color-terracotta-600'], '179 146 97');
  // A colour alone needs no mark (its variable is one the page already reads); a font does.
  assert.equal(siteRoleMarks({ body: { color: '#112233' }, highlight: { color: '#112233' } }), null);
  assert.equal(siteRoleMarks({ highlight: { font: 'jost' } }), 'eyebrow');
  // Every value is built from a parsed hex or a catalogue key — never a string a couple typed.
  for (const v of Object.values(vars)) assert.match(v, /^(#[0-9a-f]{6}|\d{1,3} \d{1,3} \d{1,3}|var\(--[a-z0-9-]+\), [A-Za-z ,'-]+)$/, `not a safe value: ${v}`);
  // AA: body-size words 4.5, large words 3 — measured, never assumed.
  assert.deepEqual(SITE_ROLE_AA, { heading: 3, body: 4.5, button: 4.5, highlight: 3 });
  assert.equal(siteRoleContrast('body', '#2c2a29', '#ffffff').passes, true);
  assert.equal(siteRoleContrast('body', '#a9834b', '#ffffff').passes, false, 'gold body text on white is called readable');
  assert.equal(siteRoleContrast('highlight', '#a9834b', '#ffffff').passes, true, 'the same gold as a large eyebrow is called unreadable');
  assert.equal(siteRoleContrast('heading', '#f6f1e7', '#ffffff').passes, false);
});

/* ── (3) the draft ────────────────────────────────────────────────────── */

test('(3) the draft holds the roles, counts a real change once, never asks Pro, and names it "Look · Elements"', () => {
  assert.ok((HUB_DRAFT_LOOK_COLUMNS as readonly string[]).includes('site_roles'), 'the host canvas would not re-wear a drafted role');
  assert.deepEqual(sanitizeHubDraftEventValue('site_roles', FULL), sanitizeSiteRoles(FULL));
  assert.equal(sanitizeHubDraftEventValue('site_roles', null), null, 'every role cannot be handed back');
  assert.equal(sanitizeHubDraftEventValue('site_roles', { footer: { color: '#112233' } }), undefined, 'a value with nothing the page would wear is held');
  // Compared as the page reads it: key order, and nothing ≡ null ≡ {}.
  const a = { body: { font: 'lora', color: '#112233' }, heading: { color: '#445566' } };
  const b = { heading: { color: '#445566' }, body: { color: '#112233', font: 'lora' } };
  assert.equal(eventColumnChange('site_roles', a, b), 'none', 'the same roles in another key order count as a change');
  assert.equal(eventColumnChange('site_roles', null, {}), 'none');
  assert.equal(eventColumnChange('site_roles', null, a), 'add');
  assert.equal(eventColumnChange('site_roles', a, { ...a, heading: { color: '#000000' } }), 'change');
  assert.equal(eventColumnChange('site_roles', a, null), 'remove');
  // 🆓 Fonts and colours are free (owner 2026-10-05) — never held for Event Hub Pro at Apply.
  assert.ok((HUB_FREE_LOOK_EVENT_COLUMNS as readonly string[]).includes('site_roles'));
  assert.equal(hubColumnKind('site_roles'), 'free-look');
  for (const change of ['add', 'change'] as const) assert.equal(eventItemIsPro('site_roles', a, change, null), false, 'a role’s font or colour is asked Pro');
  assert.deepEqual(HUB_DRAFT_EVENT_PLACE.site_roles, { place: 'Look', what: 'Elements' });
  assert.equal(HUB_DRAFT_EVENT_LABEL.site_roles, 'Your fonts and colours by role');
});

/* ── (4) the guest page ───────────────────────────────────────────────── */

test('(4) the page’s own look wears a role LAST — and a page with no roles is exactly what it was', async () => {
  const { guestLookFrom } = await import(`../${G}/_lib/loaders`);
  const hub = { theme: 'house', accent: '#000000', monogram: '' };
  const base = { event_id: 'e', invite_theme: null, role_palette: { reception: ['#5B1A22', '#F7F2EC', '#C9A86A', '#FBFAF7', '#7A8B6F'] }, site_bg_color: null, site_button_color: null, site_art_direction: null, site_font_key: null, site_button_style: null };
  const plain = guestLookFrom(base as never, hub as never, true);
  // Byte identity: no column, NULL, {} and junk all paint the page it painted before the column existed.
  for (const site_roles of [undefined, null, {}, { footer: { color: '#112233' } }]) {
    const look = guestLookFrom({ ...base, ...(site_roles === undefined ? {} : { site_roles }) } as never, hub as never, true);
    assert.deepEqual(look.vars, plain.vars, `site_roles ${JSON.stringify(site_roles)} changed a page nobody changed`);
    assert.equal(look.roles, null);
  }
  const worn = guestLookFrom({ ...base, site_roles: FULL } as never, hub as never, true);
  assert.equal(worn.roles, 'heading body button eyebrow');
  assert.equal(worn.vars?.['--color-ink'], '44 42 41', 'the Details colour is not the page’s ink');
  assert.equal(worn.vars?.['--hub-heading'], '#5b4a6b');
  assert.equal(worn.vars?.['--color-terracotta'], '169 131 75');
  assert.match(worn.vars?.['--font-body'] ?? '', /^var\(--font-hub-lora\)/);
  // Everything the roles did NOT touch is the page's own, unchanged.
  for (const k of Object.keys(plain.vars ?? {})) {
    if (['--color-ink', '--color-ink-on-plate', '--hub-heading', '--color-terracotta', '--color-terracotta-600', '--color-terracotta-700'].includes(k)) continue;
    assert.equal(worn.vars?.[k], plain.vars?.[k], `${k} moved`);
  }
  // LAST — an ombré re-measures the page's ink, and the couple's Details colour is still what Details wear.
  const ombre = guestLookFrom({ ...base, site_bg_color: 'ombre:dawn:#1e2229', site_roles: { body: { color: '#abcdef' } } } as never, hub as never, true);
  assert.ok(ombre.ombre, 'anti-vacuity: the fixture is not an ombré');
  assert.equal(ombre.vars?.['--color-ink'], '171 205 239', 'the ombré’s ink overrode the couple’s Details colour');
  // The column is read where the page and the Maker read the look, and the scope wears the marks.
  assert.match(read(`${G}/_lib/loaders.ts`), /site_button_color, site_button_style, site_roles, site_font_key,/, 'the guest shell does not read the column');
  assert.match(read('app/dashboard/[eventId]/website/editor/page.tsx'), /site_button_color, site_button_style, site_roles, site_font_key,/, 'the Maker does not read the column');
  assert.match(read(`${G}/_components/host-draft-look.tsx`), /roles: look\?\.roles \?\? null,/);
  assert.match(read(`${G}/_components/guest-look-scope.tsx`), /data-hub-roles=\{worn && roles \? roles : undefined\}/);
  // The four rules for what no variable reaches — each ONLY under its mark.
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const block = css.slice(css.indexOf('LOOK › ELEMENTS — A ROLE'), css.indexOf('FOIL NAMES'));
  assert.ok(block.length > 800, 'anti-vacuity: the rules were not found');
  const rules = block.slice(block.indexOf('*/') + 2, block.lastIndexOf('/*'));
  for (const sel of rules.split('}').map((r) => r.split('{')[0]!.trim()).filter(Boolean)) {
    for (const one of sel.split(/,\s*\n/)) assert.match(one.trim(), /^\[data-hub-roles~='(body|eyebrow|button|heading)'\]/, `a rule reaches pages with no role set: ${one.trim().slice(0, 60)}`);
  }
  for (const mark of ['body', 'eyebrow', 'button', 'heading']) assert.ok(rules.includes(`[data-hub-roles~='${mark}']`), `no rule for the ${mark} mark`);
  assert.match(rules, /\[data-hub-roles~='heading'\] \[style\*='--color-ink'\] :is\(h1, h2, h3, \.font-display\)[^{]*\{\s*color: rgb\(var\(--color-ink\)\);/, 'inside a scene with its own ground the heading does not go back to that scene’s measured ink');
});

/* ── (5) pairings ─────────────────────────────────────────────────────── */

test('(5) Pairing ▾ is the shipped theme pairings, applied as a set — no new data', () => {
  for (const own of INVITE_THEME_IDS) {
    const list = fontPairings(own);
    const mine = list.find((p) => p.id === own);
    assert.deepEqual(mine && [mine.heading, mine.body, mine.labels], [null, null, null], `${own}: its own pairing overrides something`);
    for (const p of list) {
      assert.equal(p.name, INVITE_THEMES[p.id].name);
      assert.equal(p.faces, `${INVITE_THEMES[p.id].fonts.heading} & ${INVITE_THEMES[p.id].fonts.body}`);
      if (p.id === own) continue;
      // Worn EXACTLY: each role's key is the catalogue face of the theme's own family.
      assert.equal(HUB_FONT_BY_KEY[p.heading!].family, INVITE_THEMES[p.id].fonts.heading);
      assert.equal(HUB_FONT_BY_KEY[p.body!].family, INVITE_THEMES[p.id].fonts.body);
      assert.equal(HUB_FONT_BY_KEY[p.labels!].family, INVITE_THEMES[p.id].fonts.labels);
    }
  }
  // Classic's body face is not in the catalogue, so Classic is offered only as a page's OWN pairing.
  assert.equal(fontPairings('house').length, 10);
  assert.deepEqual(fontPairings('velvet').map((p) => p.id).includes('house'), false, 'a pairing that cannot be worn exactly is offered');
  assert.equal(fontPairings('velvet').length, 9);
  // What one pick writes: the Headings font in ITS column, every other font in the roles, every colour handed back.
  const luxe = fontPairings('house').find((p) => p.id === 'velvet')!;
  const w = fontPairingWrite(luxe);
  assert.equal(w.site_font_key, luxe.heading);
  assert.deepEqual(w.site_roles, { body: { font: luxe.body }, button: { font: luxe.body }, highlight: { font: luxe.labels } });
  assert.deepEqual(sanitizeSiteRoles(w.site_roles), w.site_roles, 'a pairing writes something the sanitiser would change');
  assert.deepEqual(fontPairingWrite(fontPairings('house')[0]!), { site_font_key: null, site_roles: null }, 'the page’s own pairing leaves an override behind');
  // Which pairing is on: its own while nothing is overridden; a theme's when the whole set matches; else none.
  assert.equal(fontPairingOf('house', { heading: null, roles: null }), 'house');
  assert.equal(fontPairingOf('house', { heading: null, roles: { body: { color: '#112233' } } }), 'house', 'a colour takes the page off its pairing');
  assert.equal(fontPairingOf('house', { heading: w.site_font_key, roles: w.site_roles }), 'velvet');
  assert.equal(fontPairingOf('house', { heading: w.site_font_key, roles: { ...w.site_roles, button: { font: 'jost' } } }), null, 'a mixed set is named as a theme’s pairing');
});

/* ── (6) the Studio ───────────────────────────────────────────────────── */

test('(6) the Studio draws Pairing ▾ and four role rows with an AA badge each; Font and Buttons are the shipped controls, drawn once', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerContext } = await import(`../${L}/maker-context`);
  const { StudioElements } = await import(`../${L}/studio-elements`);
  const { LookPanel } = await import(`../${L}/details-look-pages`);
  const stub = (name: string) => React.createElement('div', { 'data-stub': name });
  const wears = elementsWears({ theme: 'house', vars: null, buttonVars: null, tokens: { paper: '#ffffff', ink: '#2c2a29', accent: '#8a6a2f', cta: '#5b1a22' } });
  assert.deepEqual(wears, { paper: '#ffffff', ink: '#2c2a29', accent: '#8a6a2f', button: { fg: '#ffffff', bg: '#5b1a22' }, faces: { heading: 'cormorant', body: null, labels: 'cormorantsc' } });
  // Read off the page's OWN variables where the look sets them; an outline is measured over the page.
  const set = elementsWears({ theme: 'velvet', vars: { '--color-cream': '30 34 41', '--color-ink': '246 241 231', '--color-terracotta': '201 163 106', '--color-mulberry': '1 2 3' }, buttonVars: { '--hub-btn-fill': 'transparent', '--hub-btn-label': '#c9a36a' }, tokens: { paper: '#000000', ink: '#000000', accent: '#000000', cta: '#000000' } });
  assert.deepEqual([set.paper, set.ink, set.accent, set.button], ['#1e2229', '#f6f1e7', '#c9a36a', { fg: '#c9a36a', bg: '#1e2229' }]);
  const props = { eventId: 'E1', headingFont: null, themeId: 'house' as const, five: ['#5b1a22', '#f7f2ec', '#c9a86a', '#fbfaf7', '#7a8b6f'], wears, names: 'Maria & Jose' };
  const look = { background: null, page: null, video: null, roles: null, colours: stub('colours'), palette: null, font: stub('font-pick'), buttons: stub('buttons-look'), music: null };
  const paint = (roles: unknown) =>
    renderToStaticMarkup(
      React.createElement(MakerContext.Provider, { value: { stagesStudio: true, lookPages: { look } } as never }, React.createElement(StudioElements, { ...props, roles: sanitizeSiteRoles(roles) })),
    );
  const html = paint(null);
  // ONE dropdown for the pairing, then the four roles, in the owner's order.
  assert.equal((html.match(/data-role-pairing-pick/g) ?? []).length, 1);
  assert.match(html, /data-bg-row="pairing"/);
  assert.deepEqual([...html.matchAll(/data-role-row="([a-z]+)"/g)].map((m) => m[1]), ['heading', 'body', 'button', 'highlight']);
  for (const label of ['Headings', 'Details', 'Buttons', 'Highlights']) assert.match(html, new RegExp(`>${label}</span>`));
  // Each head: the role's sample ON the page colour, its badge, its swatch — and no Save anywhere.
  assert.equal((html.match(/data-role-aa="pass"/g) ?? []).length, 4, 'a readable default is flagged');
  assert.match(html, /data-role-sample="heading"[^>]*style="[^"]*font-family:var\(--font-editorial-display\)[^"]*color:#2c2a29;background-color:#ffffff[^"]*"[^>]*>Maria &amp; Jose</);
  assert.match(html, /data-role-sample="button"[^>]*style="[^"]*color:#ffffff;background-color:#5b1a22/);
  assert.doesNotMatch(html, /type="submit"|>Save</);
  // Rows open one at a time, in place — closed, nothing of a role's body is mounted.
  assert.doesNotMatch(html, /data-role-body=|data-stub=/, 'a role is open before it is tapped (or a shipped control is mounted while closed)');
  // A pick that does not read is SAID: amber on the row.
  const hard = paint({ body: { color: '#f6f1e7' }, highlight: { color: '#fbfaf7' } });
  assert.match(hard, /data-role-row="body"[\s\S]*?data-role-aa="fail"[^>]*title="Contrast 1\.[0-9]:1"[^>]*>AA ✗</);
  assert.equal((hard.match(/data-role-aa="fail"/g) ?? []).length, 2);
  assert.match(hard, /data-role-row="heading"[\s\S]*?data-role-aa="pass"/, 'a Details colour was measured as the Headings’');
  // The source: every pick is ONE draft save through the one door; the two shipped controls are the registered nodes.
  const src = read(`${L}/studio-elements.tsx`);
  assert.match(src, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(\{ events \}\)\);\s*return draft\(eventId, fd\);/);
  assert.match(src, /save\(\{ site_roles: next \}, \{ roles: next \}\);/);
  assert.match(src, /save\(\{ site_font_key: w\.site_font_key, site_roles: w\.site_roles \}, \{ roles: w\.site_roles, font: w\.site_font_key \}\);/, 'a pairing is more than one draft save');
  assert.match(src, /heading: \(\s*<>\s*\{look\?\.font \?\? null\}\s*\{colourRow\('heading'\)\}/, 'the Headings font is not the shipped typeface control');
  assert.match(src, /button: \(\s*<>\s*\{fontRow\('button', 'Font'\)\}\s*\{look\?\.buttons \?\? null\}/, 'the Buttons row does not reuse the shipped Buttons control');
  assert.equal((src.match(/<StudioColourField/g) ?? []).length, 1, 'a role’s colour does not open the one picker');
  assert.equal((src.match(/<FontPick/g) ?? []).length, 1, 'a role’s font is not the one font dropdown');
  // Look draws each control ONCE: in the Studio the role rows hold Font and Buttons; the shipped Maker has no role rows.
  assert.deepEqual(LOOK_SECTION_PARTS.elements, ['roles', 'colours', 'font', 'buttons']);
  assert.ok((LOOK_PARTS as readonly string[]).includes('roles') && LOOK_ROW_OF.roles === 'roles');
  const panel = (stagesStudio: boolean, roles: unknown) =>
    renderToStaticMarkup(
      React.createElement(
        MakerContext.Provider,
        { value: { stagesStudio, lookPages: { look: { ...look, roles } } } as never },
        React.createElement(LookPanel, { sections: ['elements'] }),
      ),
    );
  const studio = panel(true, stub('role-rows'));
  assert.deepEqual([...studio.matchAll(/data-look-part="([a-z]+)"/g)].map((m) => m[1]), ['roles', 'colours']);
  assert.doesNotMatch(studio, /data-stub="font-pick"|data-stub="buttons-look"/, 'Font or Buttons is drawn a second time under the role rows');
  const shipped = panel(false, stub('role-rows'));
  assert.deepEqual([...shipped.matchAll(/data-look-part="([a-z]+)"/g)].map((m) => m[1]), ['colours', 'font', 'buttons'], 'the shipped Maker gained the role rows or lost a control');
  // …and a Studio with no role rows registered keeps Font and Buttons — never dropped.
  assert.deepEqual([...panel(true, null).matchAll(/data-look-part="([a-z]+)"/g)].map((m) => m[1]), ['colours', 'font', 'buttons']);
  // The row is built ONCE by the editor page, through the one lazy Studio door (no door of its own).
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /key: 'roles',[\s\S]{0,400}<StudioTool\s+part="elements-roles"/);
  assert.match(page, /\{ \.\.\.\(drafted as Record<string, unknown>\), site_roles: null \} as unknown as EventShellRow,/, 'the defaults are measured WITH the roles on (a pick would become its own default)');
  assert.match(read(`${E}/editor-shell.tsx`), /const rolesNode = rows\[LOOK_ROW_OF\.roles\]\?\.node \?\? null;[\s\S]*?roles: rolesNode,/);
  assert.doesNotMatch(read(`${L}/details-lazy.tsx`), /studio-elements/, 'the role rows got a lazy door of their own (the Maker’s first load)');
});

/* ── (7) the column ───────────────────────────────────────────────────── */

test('(7) the column: one ALTER, both grants, nothing to anon, the view rebuilt, an accepted exposure line', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => /site_roles/.test(f));
  assert.equal(files.length, 1, 'the column has no migration, or two');
  const sql = readFileSync(join(dir, files[0]!), 'utf8').replace(/--[^\n]*/g, '');
  assert.equal((sql.match(/ADD COLUMN/g) ?? []).length, 1);
  assert.match(sql, /ALTER TABLE public\.events ADD COLUMN IF NOT EXISTS site_roles JSONB;/, 'not one plain nullable jsonb, with no default');
  assert.doesNotMatch(sql, /site_roles JSONB[^;]*(DEFAULT|NOT NULL)/i);
  assert.match(sql, /GRANT SELECT \(site_roles\) ON public\.events TO authenticated;/);
  assert.match(sql, /GRANT UPDATE \(site_roles\) ON public\.events TO authenticated;/);
  assert.doesNotMatch(sql, /GRANT[^;]*site_roles[^;]*anon/i, 'anon is granted the column');
  assert.ok(sql.indexOf('DROP VIEW IF EXISTS public.events_host;') > sql.indexOf('GRANT SELECT (site_roles)'), 'events_host is rebuilt before the grant it is computed from');
  assert.match(sql, /CREATE VIEW public\.events_host/);
  const baseline = readFileSync(join(REPO, 'supabase', 'security', 'exposure-surface.baseline.txt'), 'utf8');
  assert.match(baseline, /^col\tpublic\.events\.site_roles\tanon=- authenticated=SU$/m);
});
