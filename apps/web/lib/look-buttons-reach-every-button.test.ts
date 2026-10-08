/**
 * look-buttons-reach-every-button.test.ts — LOOK › BUTTONS KEEPS ITS PROMISES.
 *
 * Owner, 2026-10-04 (DECISION_LOG "LOOK › BUTTONS — THE HOST STYLES THE EVENT
 * HUB'S BUTTONS"): *"yes we have buttons because the buttons for reply your
 * answer, or other buttons that may be part of the event hub."* → *"create
 * them."* — and *"Realtime effects for seeing what will change but always need
 * to press apply to publish to the actual event hub"*.
 *
 * Each test names something a host or a guest would feel if it broke:
 *   (1) the database admits exactly the values the app writes;
 *   (2) a host's choice REACHES the Reply button: column → loader → scope →
 *       the rule that paints `a.bg-mulberry` under `[data-arrival-action]`;
 *   (3) no combination the Maker offers — and nothing the page renders — puts a
 *       label under WCAG AA, on every theme, over a sweep of colours;
 *   (4) opening Look writes nothing: the one write sits behind a pick;
 *   (5) it is drafted, free at Apply, and the canvas re-wears it from the draft.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import {
  HUB_BUTTON_FILLS,
  HUB_BUTTON_SHAPES,
  HUB_BUTTON_STYLE_VALUES,
  buttonLabelOn,
  encodeHubButtonStyle,
  hubButtonColourOffers,
  hubButtonOutlineOffered,
  hubButtonPage,
  parseHubButtonStyle,
  resolveHubButtons,
  type HubButtonPage,
} from './hub-buttons';
import { AA_BODY, contrastRatio } from './hub-legibility';
import { HUB_THEMES, INVITE_THEMES } from './invite-themes';
import {
  HUB_DRAFT_LOOK_COLUMNS,
  emptyHubDraft,
  mergeHubDraft,
  planHubDraftApply,
  sanitizeHubDraftEventValue,
  type HubLiveState,
} from './hub-draft';
import { HUB_FREE_LOOK_EVENT_COLUMNS, HUB_LOOK_EVENT_COLUMNS } from './hub-look-pro';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

/* ── (1) the CHECK ────────────────────────────────────────────────────────── */

test('(1) the database admits exactly the shape-fill values the app writes, and never theme-theme', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  let last: string | null = null;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    if (/ADD CONSTRAINT events_site_button_style_check/.test(sql)) last = sql;
  }
  assert.ok(last, 'no migration sets events_site_button_style_check');
  const list = /site_button_style IN \(([^)]*)\)/.exec(last!)?.[1] ?? '';
  const db = list.split(',').map((s) => s.trim().replace(/^'|'$/g, '')).sort();
  assert.deepEqual(db, [...HUB_BUTTON_STYLE_VALUES].sort());
  assert.equal(db.length, HUB_BUTTON_SHAPES.length * HUB_BUTTON_FILLS.length - 1);
  assert.ok(!db.includes('theme-theme'), '"both the theme’s" is NULL, never a stored value');
  // Round trip: what the Maker encodes, the page parses back.
  for (const v of HUB_BUTTON_STYLE_VALUES) assert.equal(encodeHubButtonStyle(parseHubButtonStyle(v)), v);
  assert.equal(encodeHubButtonStyle({ shape: 'theme', fill: 'theme' }), null);
});

/* ── (2) the chain to the Reply button ────────────────────────────────────── */

test('(2) a Buttons choice reaches the rendered Reply button’s CSS', async () => {
  // a · the loader reads the column and resolves it with the page as it paints.
  const loaders = read('app/[slug]/_lib/loaders.ts');
  const select = /loadEventShell = cache[\s\S]*?\.select\(\s*'([^']+)'/.exec(loaders)?.[1] ?? '';
  assert.match(select, /\bsite_button_style\b/, 'the guest loader never reads the choice');
  assert.match(select, /\bsite_button_color\b/);
  const from = loaders.slice(loaders.indexOf('export function guestLookFrom'));
  assert.match(from, /resolveHubButtons\(\{\s*style: event\.site_button_style,\s*colour: event\.site_button_color,/);
  // 🎨 …on the theme as the Mood Board dresses it (`dressedTheme`, 2026-10-05).
  assert.match(from, /page: hubButtonPage\(dressed, painted\)/, 'the buttons are not measured against the painted page');
  assert.match(from, /vars: painted,\s*buttons,/, 'the look leaves the loader without its buttons');

  // b · the one translation hands the scope both attributes and the custom properties.
  const scopeProps = read('app/[slug]/_components/host-draft-look.tsx');
  assert.match(scopeProps, /buttons: look\?\.buttons \? \{ shape: look\.buttons\.shape, paint: look\.buttons\.paint \} : null/);
  assert.match(scopeProps, /\.\.\.\(buttonVars \?\? \{\}\)/, 'the button properties never reach the inline style');

  // c · the scope, RENDERED, wears them — for a Pill + Outline in a palette colour on Luxe.
  const theme = INVITE_THEMES.velvet;
  const page = hubButtonPage(theme, null);
  const look = resolveHubButtons({ style: 'pill-outline', colour: '#e3a86f', theme, page });
  assert.ok(look, 'a chosen style resolved to nothing');
  assert.equal(look!.shape, 'pill');
  assert.equal(look!.paint, 'outline');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = (await import('../app/[slug]/_components/guest-look-scope')) as unknown as Record<string, unknown> & { default?: Record<string, unknown> };
  const GuestLookScope = (mod.GuestLookScope ?? mod.default?.GuestLookScope) as React.FunctionComponent<Record<string, unknown>>;
  const html = renderToStaticMarkup(
    React.createElement(
      GuestLookScope,
      { theme: 'velvet', art: null, fontClassName: '', style: { ...look!.vars }, buttons: { shape: look!.shape, paint: look!.paint } },
      React.createElement('div', { 'data-arrival-action': 'reply' }, React.createElement('a', { className: 'bg-mulberry text-cream', href: '#r' }, 'Reply to the invitation')),
    ),
  );
  assert.match(html, /data-hub-btn-shape="pill"/, 'the shape attribute is not worn');
  assert.match(html, /data-hub-btn-paint="outline"/, 'the paint attribute is not worn');
  assert.match(html, /--hub-btn-radius:999px/, 'the pill radius is not on the scope');
  assert.match(html, /--hub-btn-border:#e3a86f/, 'the colour is not on the scope');
  assert.ok(html.indexOf('Reply to the invitation') > html.indexOf('data-hub-btn-shape'), 'the Reply button is not inside the scope');

  // d · the stylesheet paints the Reply button (and every shared button) from them.
  const css = raw('app/globals.css');
  const rule = (selector: RegExp, decl: RegExp, what: string) => {
    const hit = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => selector.test(m[1]!) && decl.test(m[2]!));
    assert.ok(hit, what);
  };
  rule(/\[data-hub-btn-shape\] \[data-arrival-action\] a\.bg-mulberry/, /border-radius:\s*var\(--hub-btn-radius\)/, 'no rule rounds the Reply button');
  rule(/\[data-hub-btn-paint\] \[data-arrival-action\] a\.bg-mulberry/, /background-color:\s*var\(--hub-btn-fill\)[\s\S]*color:\s*var\(--hub-btn-label\)/, 'no rule paints the Reply button');
  rule(/\[data-hub-btn-shape\] \.button-primary/, /border-radius:\s*var\(--hub-btn-radius\)/, 'no rule rounds .button-primary');
  rule(/\[data-hub-btn-paint\] \.button-primary/, /border:\s*1\.5px solid var\(--hub-btn-border\)/, 'no rule draws the outline');
  rule(/\[data-hub-btn-paint\] \[data-rsvp-answer\]:has\(:checked\)/, /background-color:\s*var\(--hub-btn-solid\)/, 'a picked RSVP answer does not follow the buttons');
  // Every custom property the rules read is one the resolver writes.
  const read_ = new Set([...css.matchAll(/var\((--hub-btn-[a-z-]+)\)/g)].map((m) => m[1]!));
  const solid = resolveHubButtons({ style: 'rounded-solid', colour: '#3a4a1c', theme: INVITE_THEMES.galeriya, page: hubButtonPage(INVITE_THEMES.galeriya, null) })!;
  for (const name of read_) {
    assert.ok(name === '--hub-btn-radius' || name in solid.vars, `the stylesheet reads ${name}, which the resolver never writes`);
  }

  // e · the real Reply button and the RSVP's own buttons carry those hooks.
  assert.match(raw('app/[slug]/_components/arrival-action.tsx'), /data-arrival-action=\{action\.kind\}[\s\S]*?<Link[\s\S]*?className="[^"]*\bbg-mulberry\b/);
  const rsvp = raw('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(rsvp, /<SubmitButton className="button-primary[^"]*" pendingLabel="Sending…">\s*Send my reply/, 'the RSVP’s send button is not a shared button');
  assert.match(rsvp, /data-rsvp-answer=""\s*className="flex min-h-12/, 'the RSVP answers carry no hook');
  assert.match(raw('app/[slug]/_components/rsvp-styles.tsx'), /data-rsvp-answer=\{stamp \? undefined : ''\}/);
});

/* ── (3) legibility, swept ────────────────────────────────────────────────── */

/** A 6×6×6 sweep of the colour cube plus every theme colour — 216+ fills. */
function sweep(): string[] {
  const steps = ['00', '33', '66', '99', 'cc', 'ff'];
  const out: string[] = [];
  for (const r of steps) for (const g of steps) for (const b of steps) out.push(`#${r}${g}${b}`);
  for (const t of HUB_THEMES) out.push(...Object.values(t.palette));
  return out;
}

test('(3) no combination the Maker offers, and nothing the page renders, puts a label under AA', () => {
  const colours = sweep();
  // Grounds the page may paint: the theme's own, and a couple's own paper (dark and light).
  const pages = (theme: (typeof HUB_THEMES)[number]): HubButtonPage[] => [
    hubButtonPage(theme, null),
    hubButtonPage(theme, { '--color-cream': '17 17 17', '--color-paper-deep': '40 40 40' }),
    hubButtonPage(theme, { '--color-cream': '250 250 245' }),
  ];
  let rendered = 0;
  let outlines = 0;
  for (const theme of HUB_THEMES) {
    for (const page of pages(theme)) {
      for (const fill of HUB_BUTTON_FILLS) {
        // What the Maker OFFERS: every offered colour must hold in that fill.
        const offers = hubButtonColourOffers({ theme, palette: colours, saved: null, fill, page });
        for (const o of offers) {
          const label = buttonLabelOn(theme, o.hex);
          assert.ok(label && contrastRatio(label, o.hex) >= AA_BODY, `${theme.id}: offered ${o.hex} with an unreadable label`);
          if (fill === 'outline') {
            for (const g of page.grounds) assert.ok(contrastRatio(o.hex, g) >= AA_BODY, `${theme.id}: offered ${o.hex} as an Outline on ${g}`);
          }
        }
        // What the page RENDERS, for EVERY colour (offered or not — a stored value may predate a palette change).
        for (const colour of [null, ...colours]) {
          for (const shape of HUB_BUTTON_SHAPES) {
            const look = resolveHubButtons({ style: encodeHubButtonStyle({ shape, fill }), colour, theme, page });
            if (!look?.paint) continue;
            const v = look.vars;
            rendered += 1;
            assert.ok(contrastRatio(v['--hub-btn-solid-label']!, v['--hub-btn-solid']!) >= AA_BODY, `${theme.id} ${shape}-${fill} ${colour}: the picked-answer label fails AA`);
            assert.ok(contrastRatio(v['--hub-btn-solid-label']!, v['--hub-btn-solid']!) <= contrastRatio(v['--hub-btn-solid-label']!, look.paint === 'solid' ? v['--hub-btn-hover']! : v['--hub-btn-solid']!) + 1e-9, `${theme.id}: the hover walks the label closer`);
            if (look.paint === 'solid') {
              assert.ok(contrastRatio(v['--hub-btn-label']!, v['--hub-btn-fill']!) >= AA_BODY, `${theme.id} ${shape}-${fill} ${colour}: a solid label fails AA`);
            } else {
              outlines += 1;
              for (const g of page.grounds) {
                assert.ok(contrastRatio(v['--hub-btn-label']!, g) >= AA_BODY, `${theme.id} ${shape}-outline ${colour}: an outline label fails AA on ${g}`);
              }
            }
            // Outline is offered for a colour exactly when the page draws it as an Outline.
            if (fill === 'outline' && colour && look.vars['--hub-btn-solid'] === colour) {
              assert.equal(hubButtonOutlineOffered({ colour, page }), look.paint === 'outline', `${theme.id} ${colour}: Outline offered ≠ Outline drawn`);
            }
          }
        }
      }
    }
  }
  // Anti-vacuity: the sweep exercised both paints, thousands of times.
  assert.ok(rendered > 10_000, `only ${rendered} renders checked`);
  assert.ok(outlines > 1_000, `only ${outlines} outlines checked — the sweep never drew one`);
});

test('(3) nothing chosen is nothing worn — the page renders exactly as before', () => {
  for (const theme of HUB_THEMES) {
    assert.equal(resolveHubButtons({ style: null, colour: null, theme, page: hubButtonPage(theme, null) }), null);
    assert.equal(resolveHubButtons({ style: 'theme-theme', colour: 'not a colour', theme, page: hubButtonPage(theme, null) }), null);
  }
});

/* ── (4) opening Look writes nothing ──────────────────────────────────────── */

test('(4) opening Look writes nothing — the one write sits behind a pick that changed something', () => {
  const src = read('app/dashboard/[eventId]/website/editor/_components/buttons-look-row.tsx');
  // Exactly one write, inside `commit`.
  assert.equal(src.split('hubDraftAction(').length - 1, 1, 'Buttons writes from more than one place');
  const commit = src.slice(src.indexOf('const commit = '), src.indexOf('const sample = '));
  assert.ok(commit.includes('hubDraftAction('), 'the write is not inside commit');
  assert.match(commit, /if \(before\.shape === next\.shape && before\.fill === next\.fill && before\.colour === next\.colour\) return;/, 'a pick that changes nothing still writes');
  // `commit` is reached only from a tap on a shape's card — and a tap on the card that is already ringed (a stored
  // shape, or the theme's own corner as it READS) reaches nothing: the reading is never turned into a write.
  const callers = [...src.matchAll(/commit\(/g)].length;
  const fromTaps = [...src.matchAll(/onClick=\{\(\) => \(on \? undefined : commit\(\{ \.\.\.choice, shape, colour: null \}\)\)\}/g)].length;
  assert.equal(callers, fromTaps, 'commit is called from something other than a tap on a shape that is not the ringed one');
  assert.equal(fromTaps, 1, 'Look › Buttons writes from more than its one row of shapes');
  // No effect writes, previews or posts: the one effect only follows the props.
  const effects = [...src.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n {2}\}(?:, \[|\);)/g)];
  for (const m of effects) {
    assert.doesNotMatch(m[1]!, /commit\(|preview\(|hubDraftAction|postMessage|makerSave|tellLookSample/, 'an effect writes or previews on open');
  }
  // Two effects: the one that follows the props, and the one that centres the ringed card (it scrolls its own row — nothing else).
  assert.equal([...src.matchAll(/useEffect\(/g)].length, effects.length, 'an effect of a shape this guard does not read');
  assert.equal(effects.length, 2, 'anti-vacuity: the row’s two effects were not both found');
});

/* ── (5) drafted, free, re-worn from the draft ────────────────────────────── */

test('(5) the choice is drafted, free at Apply, and the host canvas re-wears it from the draft', () => {
  assert.ok((HUB_DRAFT_LOOK_COLUMNS as readonly string[]).includes('site_button_style'), 'the canvas would not re-wear a drafted choice');
  assert.ok((HUB_FREE_LOOK_EVENT_COLUMNS as readonly string[]).includes('site_button_style'));
  assert.ok(!(HUB_LOOK_EVENT_COLUMNS as readonly string[]).includes('site_button_style'), 'a button shape became Pro');
  assert.equal(sanitizeHubDraftEventValue('site_button_style', 'pill-outline'), 'pill-outline');
  assert.equal(sanitizeHubDraftEventValue('site_button_style', 'theme-theme'), null);
  assert.equal(sanitizeHubDraftEventValue('site_button_style', null), null);
  assert.equal(sanitizeHubDraftEventValue('site_button_style', 'Pill Outline'), undefined, 'junk is repaired instead of dropped');
  const d = mergeHubDraft(emptyHubDraft(), { events: { site_button_style: 'square-solid', site_button_color: '#3a4a1c' } });
  assert.equal(d.events.site_button_style, 'square-solid');
  const LIVE = { events: {}, widgets: {} } as unknown as HubLiveState;
  assert.equal(planHubDraftApply(d, LIVE, false).refused.length, 0, 'Apply held a free couple’s buttons');
  // The Maker saves through the one draft action, held (the bridge drew it), asking for the Apply count.
  const row = read('app/dashboard/[eventId]/website/editor/_components/buttons-look-row.tsx');
  assert.match(row, /site_button_style: encodeHubButtonStyle\(next\), site_button_color: next\.colour/);
  assert.match(row, /fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\)/);
  assert.match(row, /\{ held: true \}/);
  assert.match(row, /t: 'buttons'/);
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /data\.t === 'buttons'\) \{\s*const preview = sanitizeButtonsPreview\(data\);\s*if \(preview\) applyButtonsPreview\(document, preview\);/);
});

/* ── (6) three shapes, drawn as the button itself ─────────────────────────── */

test('(6) Look › Buttons is the Reply button in THREE shapes — no "Default"; the theme’s own corner is read and ringed, never written; the colour is the palette’s', async () => {
  // Owner 2026-10-08, round 5: "do not need to show default button just show the 3 button styles" · round 3:
  // "button color will be taken from their 5 palette" · round 2: "Pick Button Shape (color is on the palette already…)".
  const { renderToStaticMarkup } = await import('react-dom/server');
  {
    // The row imports the draft action (a server module) — only its MARKUP is rendered here, nothing is called.
    const Mod = require('node:module');
    const load = Mod._load;
    Mod._load = function (request: string, ...rest: unknown[]) {
      if (request === 'server-only' || request === 'client-only') return {};
      return load.call(this, request, ...rest);
    };
  }
  const { ButtonsLookRow } = await import('../app/dashboard/[eventId]/website/editor/_components/buttons-look-row');
  const { HUB_BUTTON_SHAPES_OFFERED, hubButtonShapeOfRadius, hubButtonShapeRead } = await import('./hub-button-shapes');
  const rowOf = (theme: (typeof HUB_THEMES)[number], style: string | null, colour: string | null) =>
    renderToStaticMarkup(React.createElement(ButtonsLookRow, { eventId: 'E1', theme, page: hubButtonPage(theme, null), style, colour }));
  const cards = (html: string) =>
    [...html.matchAll(/<button type="button" aria-pressed="(true|false)" data-buttons-shape="([a-z]+)"[\s\S]*?<span data-buttons-sample="[a-z]+"[^>]*style="([^"]*)"[^>]*>([^<]*)<\/span>[\s\S]*?<span data-buttons-shape-name=""[^>]*>([^<]*)<\/span><\/button>/g)].map(
      (m) => ({ on: m[1] === 'true', shape: m[2]!, css: m[3]!, words: m[4]!, name: m[5]! }),
    );

  /* The reading, by the numbers — written out, not derived: 0 is Square, a pill is Pill, anything between is Rounded. */
  assert.deepEqual([0, 1, 2, 4, 6, 8, 12, 23, 24, 48, 999].map(hubButtonShapeOfRadius), ['square', 'rounded', 'rounded', 'rounded', 'rounded', 'rounded', 'rounded', 'rounded', 'pill', 'pill', 'pill']);
  /* Every shipped theme's own corner, as the note lists them. */
  const READS: Record<string, [number, string]> = {
    house: [4, 'rounded'], abaca: [6, 'rounded'], vintage: [2, 'rounded'], gatsby: [4, 'rounded'], cyber: [8, 'rounded'],
    galeriya: [999, 'pill'], cinderella: [999, 'pill'], velvet: [999, 'pill'], whimsical: [999, 'pill'], regency: [999, 'pill'],
  };
  assert.deepEqual(HUB_THEMES.map((t) => t.id).sort(), Object.keys(READS).sort(), 'a theme was added or removed — say what its own button reads as');
  assert.deepEqual([...HUB_BUTTON_SHAPES_OFFERED], ['square', 'rounded', 'pill']);

  for (const theme of HUB_THEMES) {
    const [radius, reads] = READS[theme.id]!;
    assert.equal(theme.radius, radius, `${theme.id}: its corner moved`);
    const page = hubButtonPage(theme, null);
    /* NOTHING CHOSEN: three cards, in order, each the real button with the one word "Reply" and its name under it. */
    const html = rowOf(theme, null, null);
    const three = cards(html);
    assert.deepEqual(three.map((c) => c.shape), ['square', 'rounded', 'pill'], `${theme.id}: not the three shapes, in order`);
    assert.deepEqual(three.map((c) => c.name), ['Square', 'Rounded', 'Pill']);
    assert.ok(three.every((c) => c.words === 'Reply'), 'a card is not the Reply button');
    assert.equal((html.match(/data-buttons-shape="/g) ?? []).length, 3);
    assert.doesNotMatch(html, /Default|Theme’s|data-buttons-shape="theme"|aria-haspopup/, `${theme.id}: a "Default" choice, or a dropdown, is still in Look › Buttons`);
    /* The theme's own corner is READ as one of the three and ringed — and that card is drawn with the theme's REAL corner. */
    assert.deepEqual(three.filter((c) => c.on).map((c) => c.shape), [reads], `${theme.id}: the wrong card is ringed for a ${radius}px corner`);
    assert.equal(hubButtonShapeRead('theme', theme), reads);
    for (const c of three) {
      const want = c.shape === reads ? `${radius}px` : { square: '0px', rounded: '12px', pill: '999px' }[c.shape];
      assert.ok(c.css.includes(`border-radius:${want}`), `${theme.id} · ${c.shape}: drawn with the wrong corner (${c.css})`);
      /* THE PALETTE'S COLOUR: the page's own button fill, its paper as the label — nothing of the row's own. */
      assert.ok(c.css.includes(`background-color:${page.fill}`) && c.css.includes(`color:${page.grounds[0]}`), `${theme.id} · ${c.shape}: not the page's own button colour (${c.css})`);
    }
    /* A STORED shape is ringed, with its own corner — and the other two are untouched by it. */
    for (const stored of ['square', 'rounded', 'pill'] as const) {
      const now = cards(rowOf(theme, `${stored}-theme`, null));
      assert.deepEqual(now.filter((c) => c.on).map((c) => c.shape), [stored]);
      assert.ok(now.find((c) => c.shape === stored)!.css.includes(`border-radius:${{ square: '0px', rounded: '12px', pill: '999px' }[stored]}`));
    }
    /* A colour stored before this makes NO difference to what the row draws — the buttons are the palette's. */
    assert.equal(rowOf(theme, 'pill-solid', '#3a4a1c'), rowOf(theme, 'pill-solid', null), `${theme.id}: a stored colour of the couple's own still paints the row`);
    assert.equal(rowOf(theme, null, '#3a4a1c'), rowOf(theme, null, null));
  }
  /* The picked card wears the app's accent ring and name; the others wear neither. */
  const house = rowOf(INVITE_THEMES.house, 'square-theme', null);
  assert.equal((house.match(/ring-\[3px\] ring-sn-accent/g) ?? []).length, 1);
  assert.equal((house.match(/font-semibold text-sn-accent/g) ?? []).length, 1);

  const src = read('app/dashboard/[eventId]/website/editor/_components/buttons-look-row.tsx');
  assert.doesNotMatch(src, /HUB_BUTTON_FILLS|hubButtonColourOffers|pickColour|label="Fill"|label="Colour"|PickMenu|HUB_BUTTON_SHAPES\b/, 'a Fill, a Colour or the four-way Shape ▾ is still built');
  /* The stored FILL half is read and carried by a Shape pick; a stored COLOUR is handed back to the palette by it. */
  assert.match(src, /type Choice = \{ shape: HubButtonShape; fill: HubButtonFill; colour: string \| null \};/);
  assert.match(src, /const fromProps = \(\): Choice => \(\{ \.\.\.parseHubButtonStyle\(style\), colour: colour \? colour\.toLowerCase\(\) : null \}\);/, 'the stored fill and colour are not read');
  assert.match(src, /commit\(\{ \.\.\.choice, shape, colour: null \}\)/, 'a Shape pick drops the stored fill, or keeps a colour of the row’s own');
  assert.match(src, /site_button_style: encodeHubButtonStyle\(next\), site_button_color: next\.colour/);
  /* …and a stored fill is still DRAWN (an outline stays an outline in every card), and still resolved by the page. */
  /* An outline is drawn only where it reads on the page — asked of every theme, in the palette's own colour. */
  let outlines = 0;
  for (const theme of HUB_THEMES) {
    const page = hubButtonPage(theme, null);
    const outline = resolveHubButtons({ style: 'pill-outline', colour: null, theme, page });
    const now = cards(rowOf(theme, 'pill-outline', null));
    if (outline?.paint === 'outline') {
      outlines += 1;
      assert.ok(now.every((c) => c.css.includes(`border:1.5px solid ${outline.vars['--hub-btn-border']}`) && c.css.includes('background-color:transparent')), `${theme.id}: a stored outline is not drawn on the three cards`);
      assert.notEqual(rowOf(theme, 'pill-outline', null), rowOf(theme, 'pill-solid', null));
    } else {
      /* Where an outline would not read the page paints it solid — and so do the cards. */
      assert.ok(now.every((c) => !c.css.includes('background-color:transparent')), `${theme.id}: the cards draw an outline the page refuses`);
    }
  }
  assert.ok(outlines > 0, 'anti-vacuity: no theme draws an outline in the palette’s colour — the stored fill is not being exercised');
  const theme = INVITE_THEMES.house;
  const page = hubButtonPage(theme, null);
  for (const fill of HUB_BUTTON_FILLS) assert.ok(resolveHubButtons({ style: `pill-${fill}`, colour: '#3a4a1c', theme, page }) !== undefined);
});
