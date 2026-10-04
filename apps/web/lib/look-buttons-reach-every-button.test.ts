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
  assert.match(from, /page: hubButtonPage\(theme, painted\)/, 'the buttons are not measured against the painted page');
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
  const commit = src.slice(src.indexOf('const commit = '), src.indexOf('const pickColour'));
  assert.ok(commit.includes('hubDraftAction('), 'the write is not inside commit');
  assert.match(commit, /if \(before\.shape === next\.shape && before\.fill === next\.fill && before\.colour === next\.colour\) return;/, 'a pick that changes nothing still writes');
  // `commit` is reached only from the dropdowns' onPick.
  const callers = [...src.matchAll(/commit\(/g)].length;
  const fromPicks = [...src.matchAll(/onPick=\{\(k\) => commit\(/g)].length + (src.match(/const pickColour = [\s\S]*?commit\(/) ? 1 : 0);
  assert.equal(callers, fromPicks, 'commit is called from something other than a pick');
  assert.match(src, /onPick=\{pickColour\}/);
  // No effect writes, previews or posts: the one effect only follows the props.
  for (const m of src.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n {2}\}, \[/g)) {
    assert.doesNotMatch(m[1]!, /commit\(|preview\(|hubDraftAction|postMessage|makerSave/, 'an effect writes or previews on open');
  }
  assert.ok([...src.matchAll(/useEffect\(/g)].length >= 1, 'anti-vacuity: the props effect was not found');
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
