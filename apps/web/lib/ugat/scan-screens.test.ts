/**
 * scan-screens.test.ts — the Screens · Doors scanner, against a fixture tree.
 *
 * Every rule the owner's fix list depends on is asserted from BOTH sides: a
 * screen with no door IS listed, and one with a door is NOT; a door to a
 * missing address IS reported, and a door that merely looks odd (a URL helper,
 * a comparison, a legacy redirect) is NOT. A scanner that listed everything,
 * or nothing, would pass a one-sided test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { noDoorBaseline, scanScreens, serializeScreensMap, urlForAppDir } from './scan-screens';
import { summarizeScreens, type UgatScreensMap } from './screens';

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ugat-screens-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

const page = (body = '<main />') => `export default function P() { return (${body}); }\n`;

const FILES: Record<string, string> = {
  'app/page.tsx': page(`<main><a href="/guests">Guests</a><Link href={\`/events/\${id}\`}>e</Link><a href="/missing/thing">x</a></main>`),
  'app/guests/page.tsx': `import { load } from '@/lib/load-guests';\n${page()}`,
  'lib/load-guests.ts': `export const load = (s: any) => s.from('guests').select('*');\n`,
  'app/events/[eventId]/page.tsx': page(`<a href="/events/x">self</a>`),
  // Linked only from itself and from the admin console: neither is a way in.
  'app/orphan/page.tsx': page(`<a href="/orphan">me</a>`),
  'app/admin/tools/page.tsx': page(`<a href="/orphan">staff only</a>`),
  // A legacy stub: draws nothing, forwards on.
  'app/old-guests/page.tsx': `import { redirect } from 'next/navigation';\nexport default function P() { redirect('/guests'); }\n`,
  // A URL helper's return value IS the door to /helped — and a helper that
  // returns a non-address is never accused.
  'app/helped/page.tsx': page(),
  'lib/helper.ts': `export function helpedHref() { return '/helped'; }\nexport function other() { return '/not/a/page/at/all'; }\n`,
  // A comparison inside an href expression is a test, not a door.
  'components/compare.tsx': `export const X = ({ p }: any) => <a href={p.startsWith('/nowhere/here') ? p : '/guests'}>x</a>;\n`,
  // An old public address next.config forwards: valid, and legacy.
  'next.config.ts': `export default { async redirects() { return [{ source: '/old-public', destination: '/guests', permanent: true }]; } };\n`,
  'components/legacy-link.tsx': `export const L = () => <a href="/old-public">old</a>;\n`,
  // A menu-registry slot, with the area that says phone.
  'lib/nav-registry-defaults.ts': `export const D = [{ key: "a", area: "customer-bottom-nav", route: "/events/[eventId]", label: "x" }];\n`,
};

const TABLES = new Map([['guests', ['TYPE-GUESTS']]]);

function scan(files = FILES): { map: UgatScreensMap; root: string } {
  const root = fixture(files);
  return { map: scanScreens({ webRoot: root, builders: new Map(), tableNodes: TABLES }), root };
}

const byRoute = (m: UgatScreensMap, r: string) => {
  const s = m.screens.find((x) => x.route === r);
  assert.ok(s, `screen ${r} was not scanned`);
  return s;
};

test('the scan is deterministic — two runs serialize byte-identically', () => {
  const root = fixture(FILES);
  try {
    const a = serializeScreensMap(scanScreens({ webRoot: root, builders: new Map(), tableNodes: TABLES }));
    const b = serializeScreensMap(scanScreens({ webRoot: root, builders: new Map(), tableNodes: TABLES }));
    assert.equal(a, b);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a page with no door appears in "no door"; a linked one does not', () => {
  const { map, root } = scan();
  try {
    assert.equal(byRoute(map, '/orphan').status, 'no-door');
    assert.equal(byRoute(map, '/guests').status, 'connected');
    assert.equal(byRoute(map, '/helped').status, 'connected', 'a URL helper return is a door');
    assert.match(noDoorBaseline(map), /^\/orphan$/m);
    assert.doesNotMatch(noDoorBaseline(map), /^\/guests$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a self-link and an admin-only link do not connect a screen, but are recorded', () => {
  const { map, root } = scan();
  try {
    const orphan = byRoute(map, '/orphan');
    assert.deepEqual(orphan.doors.map((d) => d.kind), ['admin']);
    assert.ok(!orphan.doors.some((d) => d.from === 'app/orphan/page.tsx'), 'self-link counted');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a door to a missing route is reported — and nothing else is', () => {
  const { map, root } = scan();
  try {
    assert.deepEqual(
      map.brokenDoors.map((b) => `${b.to} <- ${b.from}`),
      ['/missing/thing <- app/page.tsx'],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a placeholder fills a dynamic segment, and the registry says phone', () => {
  const { map, root } = scan();
  try {
    const ev = byRoute(map, '/events/[eventId]');
    assert.equal(ev.status, 'connected');
    const reg = ev.doors.find((d) => d.kind === 'nav-registry');
    assert.equal(reg?.surface, 'phone');
    assert.ok(ev.doors.some((d) => d.from === 'app/page.tsx'), 'the `/events/${id}` link was missed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a redirect-only page is a legacy stub with its target; next.config redirects are listed', () => {
  const { map, root } = scan();
  try {
    const stub = byRoute(map, '/old-guests');
    assert.equal(stub.status, 'stub');
    assert.equal(stub.redirectsTo, '/guests');
    assert.deepEqual(map.legacyRedirects, [{ source: '/old-public', destination: '/guests' }]);
    // The legacy door connects the destination only as legacy, never on its own.
    assert.ok(byRoute(map, '/guests').doors.some((d) => d.kind === 'legacy-redirect'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Ugat nodes come from tables read two imports deep; none read = unmapped', () => {
  const { map, root } = scan();
  try {
    assert.deepEqual(byRoute(map, '/guests').nodes, ['TYPE-GUESTS']);
    assert.deepEqual(byRoute(map, '/guests').tables, ['guests']);
    assert.deepEqual(byRoute(map, '/orphan').nodes, []);
    assert.equal(summarizeScreens(map).unmapped, map.screens.filter((s) => s.status !== 'stub' && !s.nodes.length).length);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('route groups and parallel slots drop out; intercepting routes are not screens', () => {
  assert.equal(urlForAppDir('(shell)/about'), '/about');
  assert.equal(urlForAppDir('dashboard/(launcher)/@modal/x'), '/dashboard/x');
  assert.equal(urlForAppDir('dashboard/(launcher)/@modal/(.)create-event'), null);
  assert.equal(urlForAppDir(''), '/');
});
