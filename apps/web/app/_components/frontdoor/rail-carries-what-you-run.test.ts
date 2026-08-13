import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE RAIL CARRIES WHAT YOU RUN — and it is sized like the page it copies.
 *
 * Owner 2026-08-13: "we get to keep that sidebar as agreed and user home and
 * shop and admin will be on that sidebar", and separately "look at the text size
 * difference of youtube and setnayan".
 *
 * The shop row already shipped. THE ADMIN ROW DID NOT EXIST AT ALL — and could
 * not have: `FrontDoorAccount` carried `shopName` and no admin signal, so the
 * data never reached the component. That is why the owner, an admin, saw no HQ
 * anywhere in the rail.
 *
 * Both rows are CAPABILITY-GATED: absent for someone who does not hold that
 * access, never a greyed row. Four honest targets beat five with a dead one.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = join(HERE, 'front-door-shell.tsx');
const DATA = join(HERE, 'front-door.tsx');
const CSS = join(HERE, 'front-door.css');

function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
}

test('the files are non-trivial — the guard cannot silently read nothing', () => {
  for (const p of [SHELL, DATA, CSS]) {
    assert.ok(readFileSync(p, 'utf8').length > 1000, `${p} is missing or a stub.`);
  }
});

test('the rail offers a row into HQ, and into the shop', () => {
  const src = code(readFileSync(SHELL, 'utf8'));
  assert.match(
    src,
    /href="\/admin"/,
    'The rail has no row into Setnayan HQ. The owner asked for home, shop AND ' +
      'admin to live in this sidebar; the admin half never existed.',
  );
  assert.match(
    src,
    /href="\/vendor-dashboard"/,
    'The rail lost its row into the shop.',
  );
});

test('both rows are capability-gated — never a greyed door', () => {
  const src = code(readFileSync(SHELL, 'utf8'));
  assert.match(
    src,
    /account\.isAdmin\s*\?/,
    'The HQ row is not gated on account.isAdmin. An ungated row shows every ' +
      'couple a console they cannot open.',
  );
  assert.match(src, /account\.shopName\s*\?/, 'The shop row lost its gate.');
});

test('the admin signal is decided by THE canonical predicate, and fails closed', () => {
  const src = code(readFileSync(DATA, 'utf8'));
  assert.match(
    src,
    /isAdminProfile\s*\(/,
    'front-door.tsx decides admin some other way. Use lib/admin/admin-predicate ' +
      '— it is three clauses wide (is_internal · is_team_member · account_type), ' +
      'and a narrower copy once locked Team Pool staff out of their own queue.',
  );
  assert.match(
    src,
    /is_internal[\s\S]{0,60}is_team_member[\s\S]{0,60}account_type/,
    'The admin read does not select all three predicate columns. Selecting fewer ' +
      'silently narrows who counts as staff.',
  );
});

test('the card type matches the reference — 14px/500 title, 12px byline', () => {
  const css = readFileSync(CSS, 'utf8');
  const ttl = /\.fd-ttl\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
  assert.match(ttl, /font-size:\s*14px/, '.fd-ttl is not 14px. It was 15px, which ' +
    'against the reference\'s 14px read as a different product.');
  assert.match(ttl, /font-weight:\s*500/, '.fd-ttl is not weight 500. It was 600 — ' +
    'a whole weight step heavier than the page it copies.');
  const by = /\.fd-by\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
  assert.match(by, /font-size:\s*12px/, '.fd-by is not 12px.');
});
