/**
 * features-page-rows-keep-their-status.test.ts — NO ROW ON /features LOSES ITS STATUS (Build 6 Lane M part 3).
 *
 * The /features story (v3, owner-approved 11 Nov) shows every FEATURE_REGISTER row for hosts, guests, suppliers and
 * coordinators, live and planned. Its promise is the status: a planned row wears "Coming" and names its lane or
 * ruling; a live row does not. The way that rots is quiet — a row deleted in a copy edit, a "coming" flipped to
 * "live" because it read better, a chip dropped in a restyle. Each is a page claiming something the app does not do.
 *
 * So, held here:
 *   1 · every row's status is PINNED below. Adding, removing or flipping a row fails until the pin is edited in the
 *       same commit — say there what shipped (a flip to live) or why it left (a removal).
 *   2 · every planned row names its lane or ruling; every row with no register id names the ruling it came from.
 *   3 · every row is on the page, and the register coverage stays whole: A 73 · B 16 · C 42 · D 6, with each row
 *       left off named in EXCLUDED (or shown inside another row, A40 in the Event Hub row).
 *   4 · the PAINTED page agrees: a coming row draws the "Coming" chip and a live row never does.
 *   5 · the house words: no "vendor", "website", "site", "celebration", no typed peso; plan prices only by code.
 *
 * MUTATION (each seen red once, 2026-11-11): flip `a42` to 'live' → 1 fails · delete `chats` → 1 and 3 fail ·
 * drop a42's `plan` → 2 fails · remove the chip from `Row` (`_Story.tsx`) or `RowSheet` → 4 fails · write "₱500" in a line or a price word → 5 fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVENT_PLANS,
  EXCLUDED,
  FEATURE_ROWS,
  PERSONAS,
  PRICE_WORDS,
  ROLE_OF,
  SUPPLIER_PLANS,
  rowsOf,
  type FeatureRow,
  type RowId,
  type RowStatus,
} from './features-page';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only' || request.endsWith('.css')) return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROWS = FEATURE_ROWS as Readonly<Record<RowId, FeatureRow>>;

/** ⚑ THE PIN. Edit a line ONLY in the commit that ships the feature (→ live) or retires it (→ delete), and say so. */
const STATUS_PIN: Readonly<Record<string, RowStatus>> = {
  // A · hosts
  a02: 'live', a03: 'live', a04: 'live', a14: 'live', a15: 'live', a25: 'live', a50: 'live', a71: 'live', a28: 'live',
  a72: 'live', a16: 'live', a17: 'live', a19: 'live', a20: 'live', a21: 'live', a22: 'live', a23: 'live', a24: 'live',
  a27: 'live', a51: 'live', a49: 'live', a39: 'live', a41: 'live', a42: 'coming', a43: 'live', a44: 'live', a48: 'live',
  a73: 'coming', chats: 'coming', a31: 'live', a32: 'live', a33: 'live', a34: 'live', a35: 'live', a36: 'coming',
  a37: 'coming', a29: 'live', a30: 'live', a26: 'live', a38: 'live', a18: 'live', a52: 'live', a53: 'live', a54: 'live',
  a55: 'live', a56: 'live', a61: 'live', a68: 'live', a62: 'live', a63: 'live', a64: 'live', a65: 'live', a57: 'live',
  a58: 'live', a59: 'live', a60: 'live', a66: 'live', a45: 'live', a46: 'live', a47: 'live', a74: 'live', a01: 'live',
  a05: 'live', a06: 'live', a07: 'live', a08: 'live', a10: 'live', a11: 'live', a12: 'live', a13: 'live', a75: 'live',
  a76: 'live', a77: 'live',
  // B · guests
  b01: 'live', b15: 'live', b12: 'live', b13: 'live', b16: 'live', b02: 'live', b04: 'live', b14: 'live', gchat: 'coming',
  b03: 'live', b05: 'live', b06: 'live', b09: 'live', b10: 'live', b07: 'live', b08: 'live', b11: 'live',
  // C · suppliers
  c01: 'live', c02: 'live', c03: 'live', c04: 'coming', c05: 'live', c06: 'live', c11: 'live', c12: 'coming', c13: 'live',
  c40: 'live', c41: 'live', c14: 'live', c15: 'live', cardrow: 'coming', c16: 'live', c17: 'coming', c18: 'live',
  c33: 'live', c37: 'live', c35: 'live', c43: 'coming', c38: 'coming', c21: 'live', c10: 'live', c19: 'live', c22: 'live',
  c20: 'live', c31: 'live', theirevent: 'coming', c32: 'live', c23: 'live', c24: 'live', c25: 'live',
  c26: 'live', c34: 'live', c42: 'live', c07: 'live', c08: 'live', c09: 'live', c27: 'live', c28: 'live', c29: 'live',
  c30: 'live', c39: 'coming', social: 'coming',
  // D · coordinators
  d01: 'live', d02: 'live', d03: 'live', d04: 'live', d05: 'live', d06: 'live',
};

/** The register's row count per role and how many the page must show (v3 completeness table). */
const REGISTER = { A: { total: 77, shown: 73 }, B: { total: 16, shown: 16 }, C: { total: 43, shown: 42 }, D: { total: 6, shown: 6 } } as const;
/** Register rows shown INSIDE another row (one product to a visitor). */
const MERGED: Readonly<Record<string, RowId>> = { A40: 'a39' };

test('1 · every row keeps the status it was pinned with — none added, removed or flipped silently', () => {
  const actual = Object.fromEntries(Object.entries(ROWS).map(([id, r]) => [id, r.status]));
  assert.ok(Object.keys(actual).length >= 140, `only ${Object.keys(actual).length} rows — the module is not the page`);
  assert.deepEqual(
    actual,
    STATUS_PIN,
    'A /features row changed status, appeared or disappeared. If a planned feature SHIPPED, flip its pin to live and ' +
      'say what shipped in the commit; if one was retired, remove the row and its pin together. Never flip a pin to ' +
      'make a row read better.',
  );
});

test('2 · a planned row names its lane or ruling; a row with no register id names the ruling it came from', () => {
  const bad: string[] = [];
  for (const [id, r] of Object.entries(ROWS)) {
    if (r.status === 'coming' && !r.plan?.trim()) bad.push(`${id}: Coming, but its ⓘ names no lane or ruling`);
    if (r.reg.length === 0 && !r.plan?.trim()) bad.push(`${id}: no register id and no ruling — where does it come from?`);
    for (const g of r.reg) if (!/^[ABCD]\d{2}$/.test(g)) bad.push(`${id}: "${g}" is not a register id`);
    for (const k of ['name', 'line', 'problem', 'solution', 'why'] as const) {
      if (!r[k].trim()) bad.push(`${id}: empty ${k}`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});

test('3 · every row is on the page, and the register coverage stays whole (A 73 · B 16 · C 42 · D 6)', () => {
  const onPage = new Set<string>(PERSONAS.flatMap((p) => rowsOf(p)));
  const orphans = Object.keys(ROWS).filter((id) => !onPage.has(id));
  assert.deepEqual(orphans, [], `rows in the module that no chapter shows: ${orphans.join(', ')}`);

  for (const p of PERSONAS) {
    const letter = ROLE_OF[p.key];
    const covered = new Set<string>();
    for (const id of rowsOf(p)) for (const g of ROWS[id].reg) if (g[0] === letter) covered.add(g);
    for (const [g, row] of Object.entries(MERGED)) if (g[0] === letter && covered.has(ROWS[row].reg[0]!)) covered.add(g);
    const excluded = new Set(EXCLUDED.map(([g]) => g).filter((g) => g[0] === letter));
    const { total, shown } = REGISTER[letter];
    assert.equal(covered.size, shown, `${p.label} (${letter}): ${covered.size} register rows on the page, ${shown} expected`);
    const missing: string[] = [];
    for (let n = 1; n <= total; n++) {
      const g = `${letter}${String(n).padStart(2, '0')}`;
      if (!covered.has(g) && !excluded.has(g)) missing.push(g);
    }
    assert.deepEqual(missing, [], `${p.label}: register rows neither on the page nor named in EXCLUDED`);
  }
});

test('4 · the painted page agrees: "Coming" on every planned row, never on a live one — and its ⓘ names the plan', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FeaturesStory } = await import('../app/features/_sections/_Story');
  const { RowSheet } = await import('../app/features/_row-sheet');
  const html = renderToStaticMarkup(React.createElement(FeaturesStory, { locale: 'en' }));
  const rows = [...html.matchAll(/<li[^>]*\bdata-row="(\w+)"[^>]*\bdata-status="(\w+)"[^>]*>([\s\S]*?)<\/li>/g)];
  const expected = PERSONAS.reduce((n, p) => n + rowsOf(p).length, 0);
  assert.equal(rows.length, expected, `painted ${rows.length} rows, the chapters list ${expected}`);
  const bad: string[] = [];
  for (const [, id, status, inner] of rows) {
    const row = ROWS[id as RowId];
    if (status !== row.status) bad.push(`${id}: painted ${status}, the module says ${row.status}`);
    const chips = (inner!.match(/>Coming</g) ?? []).length;
    if (status === 'coming' && chips !== 1) bad.push(`${id}: planned, but the row drew ${chips} "Coming" chips`);
    if (status === 'live' && chips !== 0) bad.push(`${id}: live, but wears "Coming"`);
    if (!inner!.includes(`aria-label="About ${row.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)) bad.push(`${id}: the row has no ⓘ`);
  }
  // The ⓘ's body (the house <Explain> draws it on a press): Coming + the plan for a planned row; never for a live one.
  for (const p of PERSONAS) {
    for (const id of rowsOf(p)) {
      const sheet = renderToStaticMarkup(React.createElement(RowSheet, { id, persona: p.key }));
      const row = ROWS[id];
      const said = sheet.includes('>Coming<');
      if (row.status === 'coming' && (!said || !sheet.includes(`Planned · ${row.plan}`))) bad.push(`${id}: its ⓘ does not say Coming · ${row.plan}`);
      if (row.status === 'live' && (said || sheet.includes('Planned'))) bad.push(`${id}: live, but its ⓘ says Coming`);
      if (!sheet.includes(row.problem.replace(/&/g, '&amp;').replace(/"/g, '&quot;'))) bad.push(`${id}: its ⓘ lost the Problem`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});

test('5 · the house words, and no typed price — prices only by catalogue code, and every code is real', () => {
  const bad: string[] = [];
  const texts: [string, string][] = [];
  for (const [id, r] of Object.entries(ROWS)) for (const k of ['name', 'line', 'problem', 'solution', 'why', 'plan'] as const) texts.push([`${id}.${k}`, r[k] ?? '']);
  for (const p of PERSONAS) {
    texts.push([`${p.key}.hero`, `${p.heroTitle} ${p.heroLine}`]);
    for (const c of p.chapters) texts.push([`${p.key}.${c.eye}`, `${c.eye} ${c.title} ${c.line} ${c.photo?.alt ?? ''}`]);
  }
  for (const [k, w] of Object.entries(PRICE_WORDS)) texts.push([`price words ${k}`, w]);
  for (const pl of [...EVENT_PLANS, ...SUPPLIER_PLANS]) texts.push([`plan ${pl.name}`, `${pl.tag} ${pl.lines.join(' ')}`]);
  for (const [where, t] of texts) {
    if (/\bvendors?\b/i.test(t)) bad.push(`${where}: says "vendor"`);
    if (/\bwebsites?\b|\bsites?\b/i.test(t)) bad.push(`${where}: says "site"/"website" — it is the Event Hub, or a page`);
    if (/\bcelebrations?\b|pagdiriwang/i.test(t)) bad.push(`${where}: says "celebration" — say "event"`);
    if (/₱\s*\d|\bPHP\s*\d/.test(t)) bad.push(`${where}: types a price`);
  }
  const sql = readdirSync(join(WEB, '..', '..', 'supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(WEB, '..', '..', 'supabase', 'migrations', f), 'utf8'))
    .join('\n');
  for (const pl of [...EVENT_PLANS, ...SUPPLIER_PLANS]) {
    if (pl.price.kind === 'free') continue;
    for (const code of pl.price.codes) if (!sql.includes(`'${code}'`)) bad.push(`plan ${pl.name}: ${code} is in no migration`);
  }
  const view = readFileSync(join(WEB, 'app', 'features', '_plans-view.tsx'), 'utf8');
  if (!/resolveFeaturePrice\(/.test(view)) bad.push('the Plans compare no longer reads prices through resolveFeaturePrice');
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});
