/**
 * one-couple-name-order.test.ts — 🔀 THE TWO NAMES HAVE ONE ORDER, SET IN ONE PLACE.
 *
 * Owner, 2026-10-21, over two of his own screenshots — Event Details › Event name reading "Claire & Indalecio" and
 * the Event Hub cover reading "Indalecio & Claire": *"it should be Indalecio & Claire. And the title should be
 * consistent"*.
 *
 * The cover, the page title, the link picture, every print and pass, the emails, Home and the Events board read the
 * event's name AS STORED (`events.display_name`). Event Details re-composed it from the two people — always the first
 * person (the bride's slot) first — so it showed a different order, and keeping ANY name there wrote that order back
 * over the stored one. The fix is one helper (`lib/typed-names.ts`): the order is READ from the stored name
 * (`nameOrderOf`), every composition takes it (`coupleNameColumns` · `joinCoupleNames` · `coupleNamesLine` ·
 * `coupleFirstNamesLine`), and Event name › Name order ▾ is the one place it is changed.
 *
 *   (1) THE ORDER IS READ FROM THE STORED NAME — both orders, full or first names, and an unsettled name keeps the default.
 *   (2) THE COVER AND THE TITLE AGREE WITH EVENT DETAILS, FOR BOTH ORDERS — the Event name row (rendered) shows the
 *       stored line; the cover's split of it leads with the same person; a kept last name keeps the order; Name
 *       order ▾ offers both lines and its pick flips the stored line.
 *   (3) EVERY WRITER COMPOSES IN THE EVENT'S ORDER — no `coupleNameColumns(` call outside the helper leaves the order out.
 *   (4) NO SURFACE BUILDS THE COUPLE NAME ITSELF — no line in `app/` or `lib/` joins two people's names with "&"
 *       outside the helper (a join whose operands are read from the people: bride / groom / person A·B / partner A·B).
 *
 * Sabotage (2026-10-21, each restored): `nameOrderOf` always the default → (1)(2) red; the Studio row's keep without
 * its order → (2)(3) red; the details page's Names row back to `${personA} & ${personB}` → (4) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { splitCoupleNames } from './split-names';
import {
  coupleFirstNamesLine,
  coupleNameColumns,
  coupleNamesLine,
  joinCoupleNames,
  nameOrderOf,
  type NameOrder,
} from './typed-names';
import { resolveCoupleName } from './save-the-date-emails-core';
import { inviterFirstNames } from './claim-invite-words';
import { coupleNames } from './print-pieces';
import { homeCoverWords } from './home-cover-words';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The Event name row imports the draft door (a server action file): its server-only marks are not for a test run. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const HELPER = 'lib/typed-names.ts';
const NAME = 'app/dashboard/[eventId]/launch/_components/studio-event-name.tsx';

/** The owner's own event, both ways round (the people are stored in the same slots either way). */
const CLAIRE = { first: 'Claire', last: 'Buanhog' };
const INDALECIO = { first: 'Indalecio', last: 'Casasola II' };
const ROWS: Record<NameOrder, { display_name: string; bride_name: string; groom_name: string }> = {
  'a-first': { display_name: 'Claire & Indalecio', bride_name: 'Claire Buanhog', groom_name: 'Indalecio Casasola II' },
  'b-first': { display_name: 'Indalecio & Claire', bride_name: 'Claire Buanhog', groom_name: 'Indalecio Casasola II' },
};

/* ── (1) the order is read from the stored name ──────────────────────── */

test('(1) the order is read from the stored name — both orders, full or first names; an unsettled name keeps the default', () => {
  for (const order of ['a-first', 'b-first'] as const) {
    const r = ROWS[order];
    assert.equal(nameOrderOf(r.display_name, r.bride_name, r.groom_name), order, `${r.display_name} over full names`);
    assert.equal(nameOrderOf(r.display_name, CLAIRE.first, INDALECIO.first), order, `${r.display_name} over first names`);
  }
  assert.equal(nameOrderOf('Indalecio and Claire', 'Claire', 'Indalecio'), 'b-first', '"and" is a joiner too');
  assert.equal(nameOrderOf('  indalecio  &  claire ', 'Claire', 'Indalecio'), 'b-first', 'case and spacing');
  assert.equal(nameOrderOf('Maria Clara & Jose', 'Maria Clara Santos', 'Jose Reyes'), 'a-first', 'a two-word first name');
  assert.equal(nameOrderOf('Jose & Maria Clara', 'Maria Clara Santos', 'Jose Reyes'), 'b-first', 'a two-word first name');
  // Nothing to settle it → the default, so reading an event never changes its order.
  for (const unsettled of [null, '', 'Claire', 'Dale & Claire', 'Our Wedding', 'Sam & Sam']) {
    assert.equal(nameOrderOf(unsettled, 'Sam', 'Sam'), 'a-first', String(unsettled));
  }
  assert.equal(nameOrderOf('Sam & Alex', 'Sam Cruz', 'Sam Alex'), 'a-first');
  // "Alexandra" holds "and" but is no joiner.
  assert.equal(nameOrderOf('Alexandra', 'Alexandra', 'Ben'), 'a-first');
});

/* ── (2) the cover and the title agree with Event Details, both orders ── */

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
const amp = (s: string) => s.replace(/&/g, '&amp;');

test('(2) the cover, the title and Event Details › Event name read ONE order — for both orders', async () => {
  const { StudioEventName } = await import(`../${NAME}`);
  for (const order of ['a-first', 'b-first'] as const) {
    const r = ROWS[order];
    const html = await paint(
      React.createElement(StudioEventName as React.FC<Record<string, unknown>>, {
        eventId: 'ev-1',
        people: ['Bride', 'Groom'],
        initial: [CLAIRE, INDALECIO],
        storedName: r.display_name,
        nameStyle: 'full',
      }),
    );
    // Event Details › Event name shows the stored line — the line the page title prints (`display_name`, as stored).
    assert.match(html, new RegExp(`aria-label="Event name: ${amp(r.display_name)}\\. Tap to change"`), `${order}: the Event name row`);
    // …and Name order ▾ holds it, offering both lines.
    assert.match(html, new RegExp(`data-name-order="${order}"`), `${order}: the Name order row`);
    assert.match(html, new RegExp(`aria-label="Name order: ${amp(r.display_name)}"`), `${order}: the Name order pill`);
    // The cover splits the same stored line: it leads with the same person.
    const cover = splitCoupleNames(r.display_name, true);
    const lead = order === 'b-first' ? INDALECIO.first : CLAIRE.first;
    assert.equal(cover.first, lead, `${order}: the cover leads with another person`);
    assert.equal(`${cover.first} & ${cover.second}`, r.display_name);
    // Home's header and every print and pass (the ticket) read the same stored line.
    assert.equal(homeCoverWords({ event_type: 'wedding', event_date: '2026-12-18', display_name: r.display_name }).name, r.display_name, `${order}: Home`);
    assert.equal(coupleNames(r.display_name).first, lead, `${order}: the ticket and the prints lead with another person`);
    // A kept last name keeps the order (the composition the row drafts).
    const kept = coupleNameColumns({ ...CLAIRE, last: 'Buanhog-Casasola' }, INDALECIO, nameOrderOf(r.display_name, CLAIRE.first, INDALECIO.first));
    assert.equal(kept.display_name, r.display_name, `${order}: keeping a last name re-ordered the event's name`);
    // Picking the other order flips the stored line — and only the line.
    const other: NameOrder = order === 'a-first' ? 'b-first' : 'a-first';
    const flipped = coupleNameColumns(CLAIRE, INDALECIO, other);
    assert.equal(flipped.display_name, ROWS[other].display_name);
    assert.deepEqual([flipped.bride_name, flipped.groom_name], ['Claire Buanhog', 'Indalecio Casasola II'], 'the people moved slots');
    // A surface that prints both in full, and the fallbacks of the emails and the claim page, keep the same order.
    assert.equal(coupleNamesLine(r), order === 'b-first' ? 'Indalecio Casasola II & Claire Buanhog' : 'Claire Buanhog & Indalecio Casasola II');
    assert.equal(coupleFirstNamesLine(r), r.display_name);
    assert.equal(resolveCoupleName(r), r.display_name);
    assert.equal(inviterFirstNames(r), r.display_name);
  }
  // No stored name → the first person first, everywhere.
  const bare = { display_name: null, bride_name: 'Claire Buanhog', groom_name: 'Indalecio Casasola II' };
  assert.equal(resolveCoupleName(bare), 'Claire Buanhog & Indalecio Casasola II');
  assert.equal(inviterFirstNames(bare), 'Claire & Indalecio');
  assert.equal(joinCoupleNames('Claire', ''), 'Claire');
});

/* ── source scans ─────────────────────────────────────────────────────── */

function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(relative(WEB, p));
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  return out;
}

test('(3) every writer composes the names in the event\'s order — no `coupleNameColumns(` leaves the order out', () => {
  let calls = 0;
  const bare: string[] = [];
  for (const rel of sources()) {
    if (rel === HELPER) continue;
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    for (const m of src.matchAll(/\bcoupleNameColumns\(/g)) {
      // The call's own arguments, to its closing parenthesis; then its top-level arguments counted.
      let depth = 1;
      let i = m.index! + m[0].length;
      for (; i < src.length && depth > 0; i++) {
        const c = src[i];
        if (c === '(' || c === '{' || c === '[') depth++;
        else if (c === ')' || c === '}' || c === ']') depth--;
      }
      const args = src.slice(m.index! + m[0].length, i - 1).trim().replace(/,\s*$/, '');
      let argCount = args === '' ? 0 : 1;
      let d = 0;
      for (const c of args) {
        if (c === '(' || c === '{' || c === '[') d++;
        else if (c === ')' || c === '}' || c === ']') d--;
        else if (c === ',' && d === 0) argCount++;
      }
      calls++;
      if (argCount < 3) bare.push(`${rel}: coupleNameColumns(${args.replace(/\s+/g, ' ').slice(0, 90)})`);
    }
  }
  assert.ok(calls >= 4, `anti-vacuity: only ${calls} coupleNameColumns( calls were found`);
  assert.deepEqual(bare, [], 'a writer composes the names without the event\'s order — it re-sets them to the first person first');
});

/** Where a line joins two values with "&" — a list join, a template, a JSX pair, a concatenation. */
const JOINERS: readonly RegExp[] = [
  /\.join\(\s*(['"`]) & \1\s*\)/g,
  /\$\{[^}]+\} (?:&|&amp;) \$\{[^}]+\}/g,
  /\{[^{}\n]+\}\s*(?:&amp;|&)\s*\{[^{}\n]+\}/g,
  /(['"`]) & \1\s*\+|\+\s*(['"`]) & \2/g,
];
/** A value read from the two people — the event's slots, as the code names them (never the bridesmaids or groomsmen). */
const PEOPLE = /\b\w*(?:bride(?!smaid)|groom(?!sm[ae]n)|person_?[ab]\b|person[AB]|partner_?[ab]\b|partner[AB])\w*/i;

test('(4) no surface builds the couple name itself — every "X & Y" of the two people goes through the helper', () => {
  const found: string[] = [];
  let joins = 0;
  for (const rel of sources()) {
    if (rel === HELPER) continue;
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    const lines = src.split('\n');
    const lineAt = (idx: number) => src.slice(0, idx).split('\n').length - 1;
    for (const re of JOINERS) {
      for (const m of src.matchAll(re)) {
        joins++;
        const at = lineAt(m.index!);
        // The statement the join sits in: its own line and the four before it (a `.map(...).filter(...).join` chain).
        const window = lines.slice(Math.max(0, at - 4), at + 1).join('\n');
        const who = window.match(PEOPLE);
        if (who) found.push(`${rel}:${at + 1} joins "${who[0]}" — ${lines[at]!.trim().slice(0, 100)}`);
      }
    }
  }
  assert.ok(joins >= 20, `anti-vacuity: only ${joins} "&" joins were found across app/ and lib/`);
  assert.deepEqual(found, [], 'a surface joins the two people\'s names itself — route it through lib/typed-names.ts');
});
