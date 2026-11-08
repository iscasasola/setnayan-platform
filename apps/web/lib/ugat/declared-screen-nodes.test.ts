/**
 * declared-screen-nodes.test.ts — the fence around `DECLARED_SCREEN_NODES`.
 *
 * "No table, no node" is the Root map's rule; a declaration is the one way a
 * doorway screen that reads nothing gets a node. That is only safe while each
 * declaration stays TRUE, so each is held to four things (see screens.ts):
 * the screen exists, the scan still maps it nowhere, its nodes are real, and
 * the anchor its reason rests on is still in the page's code.
 *
 * Both sides are asserted on a fixture too: a declaration fills an unmapped
 * screen, and is IGNORED the moment that screen reads a mapped table.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

import { UGAT_TYPE_BY_ID } from './graph';
import { scanScreens } from './scan-screens';
import { DECLARED_SCREEN_NODES, type UgatScreensMap } from './screens';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');
const committed: UgatScreensMap = JSON.parse(readFileSync(join(HERE, 'screens.generated.json'), 'utf8'));

const entries = Object.entries(DECLARED_SCREEN_NODES);

test('there is at least one declaration, and each names a real screen', () => {
  assert.ok(entries.length > 0);
  for (const [route] of entries) {
    assert.ok(
      committed.screens.some((s) => s.route === route),
      `${route} is declared but is not a screen — delete its DECLARED_SCREEN_NODES entry`,
    );
  }
});

test('a declared screen is one the scan maps nowhere — and the map says it was declared', () => {
  for (const [route, d] of entries) {
    const s = committed.screens.find((x) => x.route === route)!;
    assert.deepEqual(
      s.tables,
      [],
      `${route} now reads ${s.tables.join(', ')} — the scan places it; delete its DECLARED_SCREEN_NODES entry`,
    );
    assert.equal(s.declared, d.why, `${route}: the committed map does not carry the declaration — run ugat:screens`);
    assert.deepEqual(s.nodes, [...d.nodes].sort());
  }
  // And nothing undeclared claims to be declared.
  const declaredRoutes = new Set(entries.map(([r]) => r));
  for (const s of committed.screens) if (s.declared !== undefined) assert.ok(declaredRoutes.has(s.route), s.route);
});

test('every declared node is a real Ugat node', () => {
  for (const [route, d] of entries) {
    assert.ok(d.nodes.length > 0, `${route} declares no node`);
    for (const n of d.nodes) assert.ok(UGAT_TYPE_BY_ID[n], `${route} declares ${n}, which is not in UGAT_TYPES`);
    assert.ok(d.why.trim().length > 20, `${route} needs a reason`);
  }
});

test("each declaration's anchor is still in the page's code (comments do not count)", () => {
  for (const [route, d] of entries) {
    const s = committed.screens.find((x) => x.route === route)!;
    const src = stripComments(readFileSync(join(WEB, s.file), 'utf8'));
    assert.ok(
      src.includes(d.anchor),
      `${s.file} no longer contains "${d.anchor}" — the reason for declaring ${route} has changed; re-check it`,
    );
  }
});

test('fixture: a declaration fills an unmapped screen and loses to a table read', () => {
  const root = mkdtempSync(join(tmpdir(), 'ugat-declared-'));
  const put = (rel: string, body: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  };
  try {
    put('app/page.tsx', 'export default function P() { return (<main><a href="/door">d</a><a href="/reads">r</a></main>); }\n');
    put('app/door/page.tsx', 'export default function P() { return (<main />); }\n');
    put('app/reads/page.tsx', "export const q = (s: any) => s.from('guests');\nexport default function P() { return (<main />); }\n");
    const map = scanScreens({
      webRoot: root,
      builders: new Map(),
      tableNodes: new Map([['guests', ['TYPE-GUESTS']]]),
      declared: {
        '/door': { nodes: ['TYPE-VENDORS'], anchor: 'main', why: 'a doorway' },
        '/reads': { nodes: ['TYPE-VENDORS'], anchor: 'guests', why: 'stale' },
      },
    });
    const door = map.screens.find((s) => s.route === '/door')!;
    assert.deepEqual(door.nodes, ['TYPE-VENDORS']);
    assert.equal(door.declared, 'a doorway');
    const reads = map.screens.find((s) => s.route === '/reads')!;
    assert.deepEqual(reads.nodes, ['TYPE-GUESTS']);
    assert.equal(reads.declared, undefined);
    assert.equal(map.screens.find((s) => s.route === '/')!.declared, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
