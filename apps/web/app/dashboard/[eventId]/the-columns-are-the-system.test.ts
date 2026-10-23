/**
 * GUARD — the couple dashboard's pages sit in the system's two columns.
 *
 * Owner 2026-10-19, DECISION_LOG "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)" · prototype
 * `couple_dashboard_desktop_tablet_2026-10-19.html` (§ decisions): *"Guests Map and Suppliers are the wide stage;
 * Home, Guests List/Setup, Budget and a Studio product are the reading column."* Reading = 48 rem (`max-w-3xl`),
 * wide = 64 rem (`max-w-5xl`). Pages are not redrawn — the cap is the only change, and Home already carried its own.
 *
 * Each page's OUTERMOST column is read and its cap compared with the page's kind. A page that loses its cap (or
 * takes the other one) runs a 160-character line on a desk, or squeezes a map into a reading column.
 *
 * 🖥 SUPERSEDED FOR HOME, GUESTS LIST AND SUPPLIERS FROM 1024 (owner 2026-10-23, "shouldn't home, guests and
 * suppliers maximize the width as well?" → yes; prototype `home_service_widgets_2026-10-23.html`): those three fill
 * the body (viewport − rail − 2 × 32, no cap) from `lg`; below 1024 they keep the 19 Oct caps. Budget, a Studio
 * product and the Guests Map are unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const READING = { tw: 'max-w-3xl', css: '48rem' };
const WIDE = { tw: 'max-w-5xl', css: '64rem' };

test('Home — its phone column, and no cap from lg (owner 2026-10-23)', () => {
  assert.match(read('_components/home-first-screen.tsx'), /data-home-column className="[^"]*\bmax-w-xl\b[^"]*\blg:max-w-none\b/);
});

test('Guests List and Setup read; the Map is the wide stage', () => {
  const css = read('guests/_components/guests-screen.module.css');
  const screen = /\n\.screen \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(screen, new RegExp(`max-width:\\s*${READING.css};`), 'below 1024 the List/Setup column is not the 48-rem reading column');
  assert.match(
    css,
    /@media \(min-width: 1024px\) \{\s*\.screen\[data-guests-screen\] \{\s*max-width: none;\s*\}/,
    'from 1024 the List/Setup column is still capped (owner 2026-10-23: full width)',
  );
  // People wears the same `.screen` (people-roster-view.tsx) and keeps its reading column: the uncap is the event
  // screen's alone, never the bare class.
  assert.doesNotMatch(css, /@media \(min-width: 1024px\) \{\s*\.screen \{[^}]*max-width:\s*none/, 'the uncap leaks onto every `.screen` — People too');
  const map = /\.screen\[data-guests-screen='map'\] \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(map, new RegExp(`max-width:\\s*${WIDE.css};`), 'the Map is not the 64-rem wide stage');
});

test('Budget reads', () => {
  const page = read('budget/page.tsx');
  const sections = [...page.matchAll(/<section className="sn-col([^"]*)"/g)];
  assert.ok(sections.length >= 1, 'the budget page lost its sn-col section');
  for (const m of sections) assert.match(m[1]!, new RegExp(`\\b${READING.tw}\\b`), `a budget column is not the reading column: "sn-col${m[1]}"`);
});

test('a Studio product (Papic) reads', () => {
  assert.match(read('studio/papic/page.tsx'), new RegExp(`<div className="mx-auto w-full ${READING.tw}">\\s*<section className="flex flex-col gap-7 pb-12">`));
});

test('Suppliers is the wide stage below 1024, and the whole body from 1024 (owner 2026-10-23)', () => {
  assert.match(
    read('vendors/_components/services-takeover.tsx'),
    new RegExp(`<section ref=\\{rootRef\\} data-budget-build-takeover="" data-suppliers-mode=\\{mode\\} className="mx-auto w-full ${WIDE.tw} lg:max-w-none">`),
  );
});
