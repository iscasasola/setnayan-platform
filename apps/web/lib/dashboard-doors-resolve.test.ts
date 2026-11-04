/**
 * THREE EVENT-DASHBOARD DOORS LAND WHERE THEIR WORDS SAY (audit 2026-11-02 #4 · #9 · #10).
 *
 *   1 · Home's "One QR for everyone" (an event with no guest list — the QR IS the way in) opened `/event-qr`, which is the
 *       CREW's device-pairing code (`setnayan://crew-pair`, "For your photography + livestream crew").
 *   2 · The Crew page's "Print the poster" was `${papicHomeHref(id)}/crew/poster` = `/dashboard/X?papic=open#papic/crew/poster`
 *       — the path landed inside the fragment and opened Home.
 *   3 · "Switch Papic on" (Home's day-of row, the guest card's "Turn on ›") opened `/details/field/papic-answer`, and the
 *       couple's Event Details redirects to Home's Event Settings sheet, which has no Papic row.
 *
 * Each is held as a PROPERTY of where the door lands — the route exists and is the page the words promise — never as the
 * spelling of the fix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { papicCrewPosterHref, papicHomeHref } from './papic-home-href';
import { COUPLE_RECORD_FIELD_FORWARD, coupleRecordFieldForward } from './record-field-couple-forward';
import { isDetailsItemKey } from './maker-details-items';
import { dayPapicView, type HomeService } from './home-first-screen';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const DASH = join(WEB, 'app', 'dashboard', '[eventId]');
const E = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';
const read = (p: string) => readFileSync(p, 'utf8');

/** The `page.tsx` an in-event dashboard href renders, or null when no such route exists. */
function eventPageFor(href: string): string | null {
  const path = href.split(/[?#]/)[0]!;
  const prefix = `/dashboard/${E}`;
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length).replace(/^\/+/, '');
  const file = join(DASH, ...(rest ? rest.split('/') : []), 'page.tsx');
  return existsSync(file) ? file : null;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      sourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const TREE = [...sourceFiles(join(WEB, 'app')), ...sourceFiles(join(WEB, 'lib'))];

// ── 1 · One QR for everyone ────────────────────────────────────────────────────────────────────────────────────────

test("Home's One QR card opens the GUESTS' one link + QR — never the crew's pairing code", () => {
  const home = stripComments(read(join(DASH, '_components', 'home-first-screen.tsx')));
  const m = /<Link\s+href=\{`\/dashboard\/\$\{eventId\}([^`]*)`\}[^>]*data-home-one-qr/.exec(home);
  assert.ok(m, 'the One QR card (data-home-one-qr) is no longer a Link to an in-event page — this guard lost its door');
  const page = eventPageFor(`/dashboard/${E}${m[1]}`);
  assert.ok(page, `the One QR card opens ${m[1]}, which is no page`);
  const src = read(page);
  // The page draws the guests' join link + its QR (the ShareLinkPanel, or the same one-link read).
  assert.match(src, /ShareLinkPanel|readOneLink/, `${relative(WEB, page)} does not draw the guests' one link + QR`);
  assert.doesNotMatch(src, /crew-pair/, `${relative(WEB, page)} is the crew's device-pairing page`);
  // …and the page it must NOT be is still recognisably the crew's (so this guard knows what it is avoiding).
  assert.match(read(join(DASH, 'event-qr', 'page.tsx')), /setnayan:\/\/crew-pair/);
});

// ── 2 · Print the poster ───────────────────────────────────────────────────────────────────────────────────────────

test('the poster door is a real page', () => {
  assert.ok(eventPageFor(papicCrewPosterHref(E)), `${papicCrewPosterHref(E)} is no page`);
  assert.equal(papicCrewPosterHref(E).includes('#'), false);
});

test('nothing appends a PATH to a papicHomeHref value (it ends in ?papic=open#papic — a path after it opens Home)', () => {
  let assigned = 0;
  const offenders: string[] = [];
  for (const file of TREE) {
    const src = stripComments(read(file));
    if (!src.includes('papicHomeHref(')) continue;
    if (/\$\{\s*papicHomeHref\([^)]*\)\s*\}\//.test(src)) offenders.push(`${relative(WEB, file)} · \${papicHomeHref(…)}/…`);
    for (const a of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*papicHomeHref\(/g)) {
      assigned++;
      const name = a[1]!;
      if (new RegExp(`\\$\\{\\s*${name}\\s*\\}/`).test(src)) offenders.push(`${relative(WEB, file)} · \${${name}}/…`);
    }
  }
  assert.ok(assigned >= 1, 'no papicHomeHref value is held in a variable anywhere — the sweep has gone blind');
  assert.deepEqual(offenders, [], `a path appended to Home's Papic address lands in its fragment:\n${offenders.join('\n')}`);
  // The sample the sweep is built for: Home's address really does carry a fragment.
  assert.match(papicHomeHref(E), /#/);
});

// ── 3 · Switch Papic on ────────────────────────────────────────────────────────────────────────────────────────────

test('every Details-field door drawn OUTSIDE the record has a couple forward (the record sends a couple to Settings)', () => {
  const rows = new Set<string>();
  for (const file of TREE) {
    if (file.startsWith(join(DASH, 'details') + '/')) continue;
    const src = stripComments(read(file));
    for (const m of src.matchAll(/recordFieldHref\(\s*[\w.]+\s*,\s*'([^']+)'\s*\)/g)) rows.add(m[1]!);
  }
  assert.ok(rows.size >= 1, 'no Details-field door outside the record was found — the sweep has gone blind');
  for (const row of rows) {
    assert.ok(Object.prototype.hasOwnProperty.call(COUPLE_RECORD_FIELD_FORWARD, row), `/details/field/${row} lands a couple on Event Settings, which has no row for it`);
  }
});

test('the papic-answer forward opens the Maker’s Papic answer — the papic_on switch — or Home’s Papic card head', () => {
  const day = dayPapicView('off', { key: 'papic', name: 'Papic', status: '' } satisfies HomeService, E);
  assert.equal(day.kind, 'say');
  const door = (day as { door: { href: string } | null }).door!.href;
  const row = /\/details\/field\/([^/?#]+)/.exec(door)?.[1];
  assert.ok(row, `the day-of "Switch on" door is ${door}`);

  const maker = coupleRecordFieldForward(E, row, true)!;
  assert.ok(eventPageFor(maker), `${maker} is no page`);
  const item = new URL(maker, 'https://x').searchParams.get('item');
  assert.ok(isDetailsItemKey(item), `${maker} names no Maker item`);
  const parts = stripComments(read(join(DASH, 'launch', '_components', 'details-answers-parts.tsx')));
  assert.match(parts, new RegExp(`editors\\.${item}\\s*=\\s*<AnswerPicker[^>]*column="papic_on"`), `the Maker item ${item} is not the papic_on switch`);

  const home = coupleRecordFieldForward(E, row, false)!;
  assert.ok(eventPageFor(home), `${home} is no page`);
  assert.match(read(join(DASH, 'page.tsx')), /<PapicHeadControl\b/, "Home's Papic card no longer carries the papic_on head");
});

test('the field page asks the forward BEFORE it draws the record (which would redirect the couple to Settings)', () => {
  const src = stripComments(read(join(DASH, 'details', 'field', '[row]', 'page.tsx')));
  const ask = src.indexOf('coupleRecordFieldForward(');
  const draw = src.indexOf('<EventDetailsPage');
  assert.ok(ask !== -1 && draw !== -1 && ask < draw, 'the field page draws the record without asking where a couple belongs');
  assert.match(src.slice(0, draw), /redirect\(/);
});
