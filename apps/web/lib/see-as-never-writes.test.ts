/**
 * 👁 SEE AS NEVER WRITES (PR-10, owner 2026-10-04: *"Nothing is written — it
 * only changes what the canvas draws"*).
 *
 * The sample guest is never a real row, and nothing it does — a reply, a
 * ticket save, a sign-out, an "Ask to join" — reaches the database. Held at
 * every layer the path crosses:
 *
 *   1 · the Maker: See as is component state only — not the draft, not the
 *       tab's memory, no form, no action;
 *   2 · the guest page's sample branch: reads only (no insert / update / upsert
 *       / delete / rpc, no cookie);
 *   3 · the sample guest: literals, the sample id (matches no row), and the
 *       reply action refuses that id;
 *   4 · the canvas: every submit and every press is swallowed while a sample is
 *       drawn (executed below), the guest's sign-out form and the door's join
 *       action are not even rendered for it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { buildSimulatedGuestIdentity, SIMULATED_GUEST_ID } from './simulated-guest-preview';
import { SAMPLE_PRESSABLE, stopSamplePress, stopSampleSubmit } from '../app/[slug]/_components/sample-viewer-inert';

const WEB = join(__dirname, '..');
const raw = (p: string) => readFileSync(join(WEB, p), 'utf8');
const read = (p: string) => stripComments(raw(p));
const PAGE = read('app/[slug]/page.tsx');
const BODY = read('app/[slug]/_components/site-body.tsx');
const MAKER = read('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');
const WRITE = /\.(insert|update|upsert|delete|rpc)\(|cookies\(\)\)?\.set|\.set\(\s*RSVP_TERMS_COOKIE|revalidatePath\(|Action\(/;

test('1 · the Maker holds See as in state only — never the draft, the tab’s memory, a form or an action', () => {
  assert.match(MAKER, /const \[seeAs, setSeeAs\] = useState<SeeAs \| null>\(null\);/);
  // The tab's memory stores stage · device · navOpen · selection — never who the page is drawn for.
  const memory = MAKER.slice(MAKER.indexOf('window.sessionStorage.setItem(memoryKey'), MAKER.indexOf('window.sessionStorage.setItem(memoryKey') + 160);
  assert.ok(memory.length > 0 && !/seeAs/.test(memory), 'See as was written into the tab’s memory');
  // Every place that sets it only sets it.
  for (const m of MAKER.matchAll(/setSeeAs\(([^)]*)\)/g)) {
    assert.match(m[1]!, /^(null|s\.key)$/, `setSeeAs is called with something other than a state: ${m[0]}`);
  }
  const rows = MAKER.slice(MAKER.indexOf('data-maker-see-as-rows'), MAKER.indexOf('</div>', MAKER.indexOf('data-maker-see-as-rows')));
  assert.ok(rows.length > 50, 'the See as rows were not found — the scan is blind');
  assert.doesNotMatch(rows, /<form|action=|formAction|Action\(|fetch\(|draft/i, 'a See as row writes something');
});

test('2 · the guest page’s sample branch only reads', () => {
  const from = PAGE.indexOf('const seeAs = resolveSampleViewer(');
  const to = PAGE.indexOf("if (guestViewer.kind === 'anonymous')", from);
  assert.ok(from > 0 && to > from, 'the sample-viewer branch moved — re-anchor this test');
  const branch = PAGE.slice(from, to);
  assert.doesNotMatch(branch, WRITE, 'the sample-viewer branch writes');
  // Its one read is the preview person — a select, nothing else.
  const person = read('app/[slug]/_lib/preview-person.server.ts');
  assert.match(person, /\.select\(/);
  assert.doesNotMatch(person, WRITE, 'loadPreviewPerson writes');
  // The vocabulary and the sample builder touch no database at all.
  for (const f of ['lib/see-as.ts', 'lib/simulated-guest-preview.ts']) {
    const src = read(f);
    assert.doesNotMatch(src, /\.from\(|createAdminClient|createClient|'use server'|fetch\(/, `${f} reaches the database`);
  }
});

test('3 · the sample guest is never a real row — and the reply action refuses it by id', () => {
  for (const seeAs of ['pending', 'replied', 'declined'] as const) {
    const id = buildSimulatedGuestIdentity({ slug: 'w', seeAs, person: { first_name: 'Ana', last_name: 'Reyes', display_name: null, plus_one_allowed: true, plus_one_count: 1 } });
    assert.equal(id.guest.guest_id, SIMULATED_GUEST_ID, `${seeAs}: a real person’s name must never bring their id`);
    assert.equal(id.guest.qr_token, '', `${seeAs}: the sample guest holds no code`);
    assert.equal(id.account, null, `${seeAs}: no account prompt — the sample has no account to save to`);
  }
  assert.doesNotMatch(SIMULATED_GUEST_ID, /^S89|^[0-9a-f]{8}-/i, 'the sample id looks like a real id');
  const actions = read('app/[slug]/invite/actions.ts');
  const refuse = actions.indexOf('if (guestId === SIMULATED_GUEST_ID) {');
  assert.ok(refuse > 0 && refuse < actions.indexOf('formData.set(', refuse), 'the reply action no longer refuses the sample before it writes');
});

test('4 · in the canvas the sample touches nothing — the door joins nothing, there is no sign-out, the guard is mounted', () => {
  assert.match(BODY, /\{sampleViewer !== null \? <SampleViewerInert \/> : null\}/, 'the inert guard is not mounted for a sample');
  assert.match(BODY, /const signOut = sampleViewer !== null \? null : \(/, 'the sample guest is offered a sign-out form');
  assert.match(BODY, /joinAction=\{\s*sampleViewer === null && oneQrLetsYouIn/, 'the door binds a join action for a sample viewer');
  // The private door (no SiteBody) gets the guard too.
  assert.match(PAGE, /<PrivateLanding[\s\S]{0,300}?\/>\s*<SampleViewerInert \/>/);
});

/* ── The guard itself, executed ─────────────────────────────────────────── */

type Fake = { prevented: number; stopped: number; target: EventTarget | null; preventDefault(): void; stopImmediatePropagation(): void };
function fakeEvent(target: unknown): Fake {
  return {
    prevented: 0,
    stopped: 0,
    target: target as EventTarget | null,
    preventDefault() {
      this.prevented++;
    },
    stopImmediatePropagation() {
      this.stopped++;
    },
  };
}
/** An element whose `closest` answers from a list of selectors it "is inside". */
const el = (inside: string[]) => ({ closest: (sel: string) => (inside.some((s) => sel.split(',').map((x) => x.trim()).includes(s)) ? {} : null) });

test('4 · every submit is stopped before anything reads it', () => {
  const e = fakeEvent(null);
  stopSampleSubmit(e);
  assert.equal(e.prevented, 1);
  assert.equal(e.stopped, 1);
});

test('4 · a press on a link / button / field: no default; outside a scene, no handler either', () => {
  for (const what of ['a[href]', 'button', 'input', '[role="button"]']) {
    assert.ok(SAMPLE_PRESSABLE.includes(what), `${what} is not covered`);
    const outside = fakeEvent(el([what]));
    stopSamplePress(outside);
    assert.deepEqual([outside.prevented, outside.stopped], [1, 1], `${what} outside a scene still acts`);
    // Inside a scene the Maker's bridge turns the tap into "select this scene" — only the default goes.
    const inScene = fakeEvent(el([what, '[data-setnayan-editor-bound="1"]']));
    stopSamplePress(inScene);
    assert.deepEqual([inScene.prevented, inScene.stopped], [1, 0], `${what} inside a scene lost the scene selection`);
  }
  // A tap on plain words is left alone (the bridge's tap-to-type keeps working).
  const words = fakeEvent(el([]));
  stopSamplePress(words);
  assert.deepEqual([words.prevented, words.stopped], [0, 0]);
});
