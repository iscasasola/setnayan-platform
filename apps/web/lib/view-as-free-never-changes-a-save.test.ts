/**
 * apps/web/lib/view-as-free-never-changes-a-save.test.ts
 *
 * 👁 "VIEW AS A FREE COUPLE" IS A VIEW. IT NEVER CHANGES A SAVE.
 *
 * The switch (`lib/view-as-free.ts` + `lib/view-as-free.server.ts`) turns an
 * internal viewer's Pro READ to `false` so the owner can see what a free couple
 * sees. If that read ever reached a WRITE — a server action, Apply, a route
 * that saves — the owner's own Pro edits would be refused, held back in the
 * draft or dropped from the live page by a switch that was only meant to LOOK.
 *
 * So the switch is opted INTO by renders, and this guard holds both halves:
 *   1 · every surface the owner looks at from the Maker passes its Pro read
 *       through `asViewed` (so none of them keeps showing Pro), and ONLY those;
 *   2 · no server action, no write gate and no write method of a route ever
 *       reads the switch or a reader that follows it.
 *
 * A save is a server action or a route write, and neither can be run here with
 * a request's cookie — hence a source guard (comments stripped) over the pure
 * rule tested in `view-as-free.test.ts`, plus one behaviour check below: outside
 * a request the switch is OFF, so a real Pro read passes through unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { asViewed, viewingAsFreeCouple } from './view-as-free.server';

const WEB = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !name.includes('.test.')) out.push(p);
  }
  return out;
}

const FILES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
const rel = (f: string) => relative(WEB, f).split('\\').join('/');
const code = (f: string) => stripComments(readFileSync(f, 'utf8'));
const read = (r: string) => code(join(WEB, r));

/** The render readers — the only places a Pro read is shown to the viewer "as viewed". */
const RENDER_READERS = [
  'app/dashboard/[eventId]/website/editor/page.tsx', // the Maker's work area: padlocks, Pro offers
  'app/dashboard/[eventId]/website/our-story/page.tsx', // the Maker's Love Story
  'app/dashboard/[eventId]/launch/page.tsx', // the Maker itself
  'lib/hub-draft-store.ts', // the Apply bar (`loadHubDraftBarData`)
  'lib/print-set.server.ts', // Prints & Tickets, /api/hub-print (`printOwnsPro`)
  'lib/qr-look.server.ts', // every QR (`resolveEventQrLook`)
  'app/[slug]/_lib/hub-look.ts', // the canvas = the public page (`websiteProActiveFor`)
].sort();

/** Names that carry the switch — the module, its functions, and the readers that follow it. */
const SWITCH_NAMES = [
  'view-as-free',
  'asViewed',
  'viewingAsFreeCouple',
  'viewAsFreeSwitch',
  'printOwnsPro',
  'resolveEventQrLook',
  'websiteProActiveFor',
  'loadHubDraftBarData',
];

test('the scan sees the tree (a guard looking at nothing passes everything)', () => {
  assert.ok(FILES.length > 500, `only ${FILES.length} files scanned`);
});

test('every Maker surface shows Pro "as viewed" — and only render readers do', () => {
  const callers = FILES.filter((f) => /\basViewed\(/.test(code(f)))
    .map(rel)
    .filter((r) => r !== 'lib/view-as-free.server.ts')
    .sort();
  for (const r of RENDER_READERS) {
    const n = (read(r).match(/\basViewed\(/g) ?? []).length;
    console.log(`  asViewed( in ${r}: ${n}`);
    assert.ok(n > 0, `${r} reads Pro for the owner's view but does not pass it through asViewed — it would keep showing Pro`);
  }
  assert.deepEqual(
    callers,
    RENDER_READERS,
    'asViewed is called somewhere new. If it is a RENDER, add it to RENDER_READERS; if it gates a write, it must read the real gate instead.',
  );
});

test('no server action reads the switch, or any reader that follows it', () => {
  const actions = FILES.filter((f) => /^\s*['"]use server['"]/.test(code(f)));
  assert.ok(actions.length > 20, `only ${actions.length} 'use server' modules found — the scan is broken`);
  const found: string[] = [];
  for (const f of actions) {
    const src = code(f);
    for (const name of SWITCH_NAMES) if (src.includes(name)) found.push(`${rel(f)} → ${name}`);
  }
  assert.deepEqual(found, [], `a server action would see the view switch:\n${found.join('\n')}`);
});

test('no write method of a route reads the switch', () => {
  const found: string[] = [];
  for (const f of FILES.filter((x) => /\/route\.tsx?$/.test(rel(x)))) {
    const src = code(f);
    const re = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const rest = src.slice(m.index + m[0].length);
      const next = rest.search(/\nexport\s/);
      const body = next === -1 ? rest : rest.slice(0, next);
      for (const name of SWITCH_NAMES) if (body.includes(name)) found.push(`${rel(f)} ${m[1]} → ${name}`);
    }
  }
  assert.deepEqual(found, [], `a route's write method would see the view switch:\n${found.join('\n')}`);
});

test('the write gates read the REAL entitlement — Apply included', () => {
  for (const gate of [
    'lib/couple-website-pro.ts', // eventCoupleWebsiteProActive — every action's gate
    'lib/entitlements.ts', // eventSkuActive + the §10a internal-host arm
    'lib/hub-look-gate.ts', // lookProAllows / requireLookPro — the look writers
    'app/dashboard/[eventId]/website/hub-draft-actions.ts', // Apply
  ]) {
    const src = read(gate);
    for (const name of SWITCH_NAMES) {
      assert.ok(!src.includes(name), `${gate} mentions ${name} — the switch would reach a save`);
    }
  }
  // Apply's own Pro answer comes from the real look gate, not from anything the page drew.
  assert.match(read('app/dashboard/[eventId]/website/hub-draft-actions.ts'), /await lookProAllows\(/);
  assert.match(read('lib/hub-look-gate.ts'), /await eventCoupleWebsiteProActive\(/);
});

test('the switch itself writes nothing', () => {
  for (const r of ['lib/view-as-free.server.ts', 'lib/view-as-free.ts', 'app/dashboard/[eventId]/launch/_components/view-as-free.tsx']) {
    const src = read(r);
    assert.doesNotMatch(src, /\.(insert|update|upsert|delete|rpc)\(/, `${r} writes to the database`);
    assert.doesNotMatch(src, /cookies\(\)\)?\.set\(|\.set\(\s*VIEW_AS_FREE_COOKIE/, `${r} sets a cookie server-side`);
    assert.doesNotMatch(src, /['"]use server['"]/, `${r} is a server action`);
  }
});

test('outside a request the switch is off — a real Pro read passes through untouched', async () => {
  assert.equal(await viewingAsFreeCouple(), false);
  assert.equal(await asViewed(true), true, 'a Pro event must stay Pro when no viewer asked to see it free');
  assert.equal(await asViewed(Promise.resolve(false)), false);
  await assert.rejects(asViewed(Promise.reject(new Error('read failed'))), /read failed/, 'a failed real read must stay a failure, for the caller to default');
});

test('the switch is drawn for internal viewers only', () => {
  // The Maker hands the shell the switch only when the server says the viewer is internal…
  assert.match(
    read('app/dashboard/[eventId]/launch/page.tsx'),
    /viewAsFree=\{freeSwitch\.offered \?/,
    'the Maker draws the switch without asking whether the viewer is internal',
  );
  // …and "offered" IS that question, nothing looser (not admin, not team, not host).
  const server = read('lib/view-as-free.server.ts');
  assert.match(server, /\.select\('is_internal'\)/);
  assert.match(server, /const \[offered, on\] = await Promise\.all\(\[viewerIsInternal\(\)/);
  // The shell never draws either half without that prop.
  const shell = read('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');
  assert.match(shell, /\{viewAsFree \? <ViewAsFreeRow /);
  assert.match(shell, /\{viewAsFree\?\.on \? <ViewAsFreeStrip \/> : null\}/);
});
