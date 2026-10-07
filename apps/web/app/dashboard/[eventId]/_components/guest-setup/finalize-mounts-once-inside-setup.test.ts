/**
 * finalize-mounts-once-inside-setup.test.ts — FINALIZE LIVES IN SETUP (owner
 * 2026-10-07: *"finalize should be inside the Setup. not on its current
 * location"*). It sat above the List · Map · Setup switcher ("Guests can reply
 * until you finalize. · Finalize guest list"); now it is ONE row in Guests ›
 * Setup, next to Reply by, with the old sentence behind its ⓘ — and nowhere on
 * List or Map.
 *
 * 🛡 Sabotage: mount `setGuestListFinalized` again on the guests page → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { FINALIZE_TIP, FINALIZE_TITLE } from '@/lib/headcount-row';
import { renderSetup } from './render-setup';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const APP = join(WEB, 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !full.includes(`render-setup`)) out.push(full);
  }
  return out;
}

test('ONE caller of the finalize action in the whole app — the Setup row', () => {
  const callers = walk(APP)
    .filter((f) => !f.endsWith('finalize-actions.ts')) // the action itself
    .filter((f) => /setGuestListFinalized\(/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  console.log(`finalize callers: ${callers.join(' · ')}`);
  assert.deepEqual(callers, ['app/dashboard/[eventId]/_components/guest-setup/guest-setup-rows.tsx']);
  assert.ok(!existsSync(join(APP, 'dashboard', '[eventId]', 'guests', '_components', 'finalize-guest-list-control.tsx')), 'the header control is back');
});

test('the guests page renders no finalize above the switcher', () => {
  const page = stripComments(readFileSync(join(APP, 'dashboard', '[eventId]', 'guests', 'page.tsx'), 'utf8'));
  assert.doesNotMatch(page, /FinalizeGuestListControl|Guests can reply until you finalize|data-guest-list-finalize/);
});

test('rendered: exactly one finalize row in Setup, for every choice, with its ⓘ', async () => {
  for (const getIn of ['list', 'personal', 'requests', 'one_qr_approve', 'one_qr'] as const) {
    const html = await renderSetup({ getIn });
    const n = (html.match(/data-setup-row="finalize"/g) ?? []).length;
    assert.equal(n, 1, `${getIn}: ${n} finalize rows`);
    assert.ok(html.includes(FINALIZE_TITLE), `${getIn}: the row is not titled "${FINALIZE_TITLE}"`);
    assert.ok(html.includes(FINALIZE_TIP.replace(/\.$/, '')) || /aria-label="[^"]*Finalize guest list/.test(html), `${getIn}: no ⓘ`);
    assert.match(html, /aria-label="Finalize now"/);
  }
  const reply = await renderSetup({ getIn: 'list' });
  const order = [...reply.matchAll(/data-setup-row="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(order[order.indexOf('reply-by') + 1], 'finalize', `finalize does not sit next to Reply by: ${order.join(' · ')}`);
});
