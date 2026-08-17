/**
 * port-guard-reach.test.ts — the port guard's REACH cannot narrow silently.
 *
 * On 2026-08-17 `PRIVATE_SUBDIRS` in `scripts/port-controls.mjs` named two
 * private-folder conventions — `_components` and `_lib` — while this codebase
 * used nine. The consequence, measured: **41 `_surfaces/*.tsx` files under
 * `app/admin`, every one absent from the baseline.** `/admin/studio` was recorded
 * as having ZERO destinations and ZERO actions while its thirteen surfaces
 * carried thirteen destinations and twenty-six actions. The guard did not cry
 * wolf about it — it said nothing, which is indistinguishable from a clean pass,
 * and four sessions were porting exactly those files at the time.
 *
 * 🔑 A GUARD'S REACH IS SET BY ITS LIST, NOT BY ITS RULES — the third instance of
 * that shape in one day (the hand-enumerated door list that missed three doors;
 * the `CONVERTED` list that could be silently shortened). The fix is not to
 * remember better. It is to DERIVE the question from the disk and make the answer
 * fail loudly: every underscore folder that actually exists must be either IN the
 * set or named here with a measured reason for being out.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const APP = join(WEB, 'app');

function dirsNamed(dir: string, out: Set<string> = new Set()): Set<string> {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const full = join(dir, e);
    if (!statSync(full).isDirectory()) continue;
    if (e.startsWith('_')) out.add(e);
    dirsNamed(full, out);
  }
  return out;
}

/**
 * Conventions deliberately OUT of scope, each with the measurement that justifies
 * it. A line here is a claim that the folder carries no control — so if one ever
 * gains a link or a server action, delete its line and add it to the set instead.
 */
const CARRIES_NO_CONTROL = new Set([
  '_data', // 9 files · 0 destinations · 0 'use server'
  '_styles', // 0 files
  '_fonts', // 0 files
]);

test('every private-folder convention on disk is either walked or explained', () => {
  const onDisk = [...dirsNamed(APP)].sort();
  const src = readFileSync(join(WEB, 'scripts', 'port-controls.mjs'), 'utf8');
  const setBody = /const PRIVATE_SUBDIRS = new Set\(\[([\s\S]*?)\]\)/.exec(src)?.[1] ?? '';
  const walked = new Set([...setBody.matchAll(/'(_[a-z]+)'/g)].map((m) => m[1]));

  const unaccounted = onDisk.filter((d) => !walked.has(d) && !CARRIES_NO_CONTROL.has(d));
  assert.deepEqual(
    unaccounted,
    [],
    'A private-folder convention exists on disk that the port guard neither walks ' +
      'nor explains, so any link or action inside it is unguarded and NOTHING WILL ' +
      'SAY SO. Add it to PRIVATE_SUBDIRS, or add it to CARRIES_NO_CONTROL with the ' +
      `measurement that justifies leaving it out. Unaccounted: ${unaccounted.join(', ')}`,
  );
});

test('the four conventions that carry controls are actually walked', () => {
  // POSITIVE CONTROL. The rule above is satisfied by moving every folder into
  // CARRIES_NO_CONTROL, which would pass while guarding nothing. This pins the
  // ones measured to carry a control.
  const src = readFileSync(join(WEB, 'scripts', 'port-controls.mjs'), 'utf8');
  const setBody = /const PRIVATE_SUBDIRS = new Set\(\[([\s\S]*?)\]\)/.exec(src)?.[1] ?? '';
  for (const must of ['_components', '_lib', '_surfaces', '_sections']) {
    assert.ok(
      setBody.includes(`'${must}'`),
      `${must} carries destinations or actions and must be walked. Removing it ` +
        'un-guards them silently — that is the defect this file exists for.',
    );
  }
});

test('a destination handed to a shared component still counts', () => {
  // PageMasthead renders the <Link href={back}> itself, so requiring the literal
  // token `href` made every back link invisible the moment a page adopted the
  // shared masthead — and the sanctioned response to a reported loss is to
  // regenerate, which writes the absence down and then defends it.
  const src = readFileSync(join(WEB, 'scripts', 'port-controls.mjs'), 'utf8');
  const href = /const HREF_RE = (.*)/.exec(src)?.[1] ?? '';
  for (const prop of ['back', 'returnTo', 'cancelHref']) {
    assert.ok(
      href.includes(prop),
      `HREF_RE must match \`${prop}\` — it carries a literal route in this ` +
        'codebase and PageMasthead turns it into a real link.',
    );
  }
});
