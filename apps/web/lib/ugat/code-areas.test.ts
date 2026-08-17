import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CODE_AREAS,
  ALL_CODE_AREAS,
  areaForPath,
  areasBySize,
  dependentsOf,
  dependenciesOf,
  type CodeMap,
} from './code-areas';

const GENERATED = path.join(__dirname, 'code-map.generated.json');

/* ── the taxonomy ── */

test('specific prefixes beat general ones — order is load-bearing', () => {
  // apps/web/app/admin/ must not be swallowed by apps/web/app/
  assert.equal(areaForPath('apps/web/app/admin/ugat/page.tsx'), 'admin');
  assert.equal(areaForPath('apps/web/app/dashboard/[eventId]/page.tsx'), 'couple');
  assert.equal(areaForPath('apps/web/app/vendor-dashboard/shop/page.tsx'), 'vendor');
  // …and a page that matches ONLY the general rule still lands somewhere sensible
  assert.equal(areaForPath('apps/web/app/(shell)/pricing/page.tsx'), 'site');
});

test('both shared-component roots map to the same area', () => {
  // apps/web/components/ predates app/_components/. Missing it put 20.8% of the
  // graph in `other` on the first generation.
  assert.equal(areaForPath('apps/web/app/_components/file-upload.tsx'), 'components');
  assert.equal(areaForPath('apps/web/components/skeletons/index.tsx'), 'components');
});

test('apps/web root files are config, not a surface', () => {
  assert.equal(areaForPath('apps/web/next.config.mjs'), 'config');
  assert.equal(areaForPath('apps/web/package.json'), 'config');
});

test('a repo-root file is config', () => {
  assert.equal(areaForPath('turbo.json'), 'config');
  assert.equal(areaForPath('pnpm-workspace.yaml'), 'config');
});

test('an UNKNOWN top-level directory stays visible as `other`', () => {
  // The single most important behaviour in this file. A catch-all rule matching
  // everything would make `other` unreachable — and `other` is the only thing
  // that shows what the taxonomy has failed to classify. It earned that on the
  // first generation by surfacing an entire missing component root.
  assert.equal(areaForPath('some-new-top-level-dir/thing.ts'), 'other');
  assert.equal(areaForPath(null), 'other');
  assert.equal(areaForPath(undefined), 'other');
});

test('every declared area has a non-empty id, label and blurb', () => {
  for (const a of ALL_CODE_AREAS) {
    assert.ok(a.id.length > 0, 'area needs an id');
    assert.ok(a.label.length > 0, `${a.id} needs a label`);
    assert.ok(a.blurb.length > 4, `${a.id} needs a real blurb`);
  }
});

test('no prefixed rule is empty — an empty prefix would match everything', () => {
  for (const a of CODE_AREAS) {
    assert.ok(a.prefix.length > 0, `${a.id} has an empty prefix and would swallow the map`);
  }
});

/* ── the committed derivative ── */

test('the generated map is committed, small, and provenanced', () => {
  assert.ok(fs.existsSync(GENERATED), 'run `pnpm --filter @setnayan/web ugat:code-map`');
  const map = JSON.parse(fs.readFileSync(GENERATED, 'utf8')) as CodeMap;

  // Size is the whole reason this file exists rather than the 33 MB source.
  const kb = fs.statSync(GENERATED).size / 1024;
  assert.ok(kb < 128, `derivative should stay small, got ${kb.toFixed(1)} kB`);

  // Provenance: a derivative you cannot date or attribute is one you cannot trust.
  assert.match(map.builtAtCommit, /^[0-9a-f]{7,40}$/, 'needs a real commit sha');
  assert.match(map.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(map.source.nodes > 1000 && map.source.edges > 1000);
});

test('the map classifies essentially everything', () => {
  const map = JSON.parse(fs.readFileSync(GENERATED, 'utf8')) as CodeMap;
  const total = map.areas.reduce((n, a) => n + a.size, 0);
  const other = map.areas.find((a) => a.id === 'other')?.size ?? 0;
  // A map that cannot place a meaningful share of the repo is describing
  // something other than the repo. 16.5% was the first attempt; this is the
  // floor that keeps it honest.
  assert.ok(other / total < 0.02, `${((other / total) * 100).toFixed(2)}% unclassified — too high`);
});

test('every edge endpoint is a known area', () => {
  const map = JSON.parse(fs.readFileSync(GENERATED, 'utf8')) as CodeMap;
  const known = new Set(map.areas.map((a) => a.id));
  for (const e of map.edges) {
    assert.ok(known.has(e.from), `edge from unknown area ${e.from}`);
    assert.ok(known.has(e.to), `edge to unknown area ${e.to}`);
    assert.ok(e.weight > 0, 'a bond with no weight is not a bond');
    assert.notEqual(e.from, e.to, 'self-edges are not cross-area bonds');
  }
});

test('lib is the universal dependency — the blast-radius story', () => {
  // Not a vanity assertion: if this ever stops being true, the shape of the
  // codebase has changed fundamentally and the map should be re-read.
  const map = JSON.parse(fs.readFileSync(GENERATED, 'utf8')) as CodeMap;
  const intoLib = dependentsOf(map, 'lib');
  assert.ok(intoLib.length >= 5, 'most surfaces should depend on lib');
  const heaviest = map.edges[0];
  assert.equal(heaviest?.to, 'lib', 'the heaviest bond in the repo points at lib');
});

test('helpers sort and filter the way the UI will read them', () => {
  const map = JSON.parse(fs.readFileSync(GENERATED, 'utf8')) as CodeMap;
  const sorted = areasBySize(map);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i - 1]!.size >= sorted[i]!.size, 'areasBySize must be descending');
  }
  assert.ok(dependenciesOf(map, 'couple').every((e) => e.from === 'couple'));
  assert.ok(dependentsOf(map, 'lib').every((e) => e.to === 'lib'));
});

test('hubs are real files with real dependent counts', () => {
  const map = JSON.parse(fs.readFileSync(GENERATED, 'utf8')) as CodeMap;
  const lib = map.areas.find((a) => a.id === 'lib');
  assert.ok(lib && lib.hubs.length > 0, 'lib should have hubs');
  for (const h of lib.hubs) {
    assert.ok(h.path.startsWith('apps/web/lib/'), `hub ${h.path} is not in its own area`);
    assert.ok(h.dependents > 0);
  }
  // descending
  for (let i = 1; i < lib.hubs.length; i++) {
    assert.ok(lib.hubs[i - 1]!.dependents >= lib.hubs[i]!.dependents);
  }
});
