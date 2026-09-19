/**
 * NO SERVER COMPONENT HANDS A FUNCTION TO THE CLIENT — see ./rsc-function-props.ts.
 *
 * Prod, 2026-09-19 15:24 UTC: a supplier saved their first QR payment method and
 * /vendor-dashboard/shop fell to "Your shop console is temporarily unavailable"
 * ("Event handlers cannot be passed to Client Component props"). The Delete
 * button on a saved method carried an inline `onClick`, inside a SERVER
 * component, and it only renders once a method exists — which no shop had.
 *
 * This walks every file reachable from every route entry under app/ without
 * crossing a `'use client'` boundary, so it covers the payment-options surface
 * with ANY number of methods of ANY type: the branch is read, not rendered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  WEB_ROOT,
  routeEntries,
  scanServerSource,
  serverTree,
} from './rsc-function-props';

const ENTRIES = routeEntries(path.join(WEB_ROOT, 'app'));
const TREE = serverTree(ENTRIES);
const rel = (f: string) => path.relative(WEB_ROOT, f);

test('ANTI-VACUITY: the walk reaches the server tree, including the shop’s payment-options surface', () => {
  // 645 entries and 2,077 server files on 2026-09-19. Floors well under that.
  assert.ok(ENTRIES.length >= 300, `only ${ENTRIES.length} route entries — the walk is blind`);
  assert.ok(TREE.length >= 1000, `only ${TREE.length} server files — the walk is blind`);
  const files = new Set(TREE.map(rel));
  for (const f of [
    'app/vendor-dashboard/shop/page.tsx',
    'app/vendor-dashboard/payment-options/surface.tsx',
    'app/vendor-dashboard/page.tsx',
  ]) {
    assert.ok(files.has(f), `${f} is not in the server tree — the guard does not cover it`);
  }
  // A client component must NOT be walked as server code.
  assert.ok(!files.has('app/_components/submit-button.tsx'), "a 'use client' file was walked as server code");
  console.log(`# route entries ${ENTRIES.length} · server files ${TREE.length}`);
});

test('ANTI-VACUITY: fixtures — every function-to-client shape is caught, and the legal ones are not', () => {
  const file = path.join(WEB_ROOT, 'app', '__rsc_fixture__.tsx');
  const src = [
    "import { SubmitButton } from '@/app/_components/submit-button';", // 1
    "import Link from 'next/link';", // 2
    "import { ServerThing } from '@/app/__server_thing__';", // 3
    "import { removeIt } from './actions';", // 4
    'function handle() { return 1; }', // 5
    'async function inlineAction() { "use server"; }', // 6
    'export default function Page() {', // 7
    '  return (<div>', // 8
    '    <SubmitButton pendingLabel="x" onClick={(e) => e.preventDefault()}>a</SubmitButton>', // 9
    '    <button onClick={() => 1}>b</button>', // 10
    '    <Link href="/" onClick={handle}>c</Link>', // 11
    '    <SubmitButton formAction={removeIt}>d</SubmitButton>', // 12
    '    <SubmitButton formAction={inlineAction}>e</SubmitButton>', // 13
    '    <ServerThing render={(x) => x} />', // 14
    '    <form action={async () => { "use server"; }}><button>f</button></form>', // 15
    '  </div>);', // 16
    '}', // 17
  ].join('\n');
  const isClient = (resolved: string) => resolved.endsWith('submit-button.tsx');
  const found = scanServerSource(file, src, isClient);
  const lines = found.map((f) => f.line).sort((a, b) => a - b);
  assert.deepEqual(
    lines,
    [9, 10, 11],
    `expected the inline onClick to a client button (9), a host onClick (10) and a local function to next/link (11); got ${JSON.stringify(found)}`,
  );
});

test('no server component passes a function prop to a client component or host element', () => {
  const findings = TREE.flatMap((f) => scanServerSource(f, undefined));
  assert.deepEqual(
    findings.map((f) => `${f.file}:${f.line} <${f.tag} ${f.prop}={…}> — ${f.why}`),
    [],
    'React cannot serialise a function across the server→client boundary; the WHOLE route crashes to its ' +
      'error boundary the first time this branch renders. Use a form action (a server action serialises), ' +
      'a small client wrapper (e.g. <ConfirmForm> for a confirm-before-submit), or an href.',
  );
});
