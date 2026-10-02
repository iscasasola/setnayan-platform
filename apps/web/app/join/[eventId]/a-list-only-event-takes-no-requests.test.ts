/**
 * A LIST-ONLY EVENT TAKES NO NEW JOIN REQUEST — FROM ANY PATH (owner 2026-10-03:
 * cale-ice is "Only people on my list" and showed "2 requests to join").
 *
 * Measured first: cale-ice's two requests were created 2026-09-21, BEFORE the
 * 2026-09-27 ruling "Only my Guest List has no ask-to-join ANYWHERE" — they
 * stay for the hosts to review. This guard holds that no NEW one can be made:
 *
 *   1 · the setting: only "Anyone, I approve" lets a keyless person ask, and the
 *       one-QR admission is closed too on a list-only event;
 *   2 · ONE writer: the only code that makes a request row is
 *       `createJoinRequest` (the host's own Undo-Accept aside), and it asks the
 *       setting ITSELF before writing — whoever calls it;
 *   3 · every caller refuses a list-only event before it gets there (the /join
 *       form, the event QR or link, a signed-in "ask to join", find-me);
 *   4 · no database function writes a request row;
 *   5 · rendered: a stranger on a list-only event is told "This event is by
 *       invitation only — ask the hosts for your link." and offered no ask.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { anyoneMayAskToJoin, oneQrLetsYouIn } from '@/lib/rsvp-ask';
import { INVITATION_ONLY_LINE } from '@/lib/invite-arrival';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = process.cwd();
const read = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

/** A function's body, from its signature to the next top-level function. */
function bodyOf(src: string, signature: string): string {
  const at = src.indexOf(signature);
  assert.ok(at > -1, `${signature} is gone`);
  const next = src.slice(at + signature.length).search(/\n(?:export )?(?:async )?function /);
  return next > -1 ? src.slice(at, at + signature.length + next) : src.slice(at);
}

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('1 · only "Anyone, I approve" lets a keyless person ask; a list-only event is closed to the one QR too', () => {
  const LIST_ONLY = [null, undefined, {}, { whoCanRsvp: 'guest_list' }, { whoCanRsvp: 'GUEST_LIST' }, 'junk', { whoCanRsvp: 'guest_list', guestsReply: true }];
  for (const cfg of LIST_ONLY) {
    assert.equal(anyoneMayAskToJoin(cfg), false, `${JSON.stringify(cfg)} lets a stranger ask`);
    assert.equal(oneQrLetsYouIn(cfg), false, `${JSON.stringify(cfg)} lets a stranger straight in`);
  }
  assert.equal(anyoneMayAskToJoin({ whoCanRsvp: 'guest_list', guestsReply: false }), false, 'cale-ice\'s shape lets a stranger ask');
  assert.equal(anyoneMayAskToJoin({ whoCanRsvp: 'anyone' }), true);
});

test('2 · ONE writer makes a request row — and it asks the setting itself before it writes', () => {
  const writers: string[] = [];
  for (const f of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(f, 'utf8'));
    if (/entry_source:\s*(?:'self_added_unlisted'|REQUEST_SOURCE|REQUEST_ENTRY_SOURCE)/.test(src)) writers.push(f.slice(WEB.length + 1));
  }
  assert.deepEqual(
    writers.sort(),
    [join('app', 'dashboard', '[eventId]', 'guests', 'claims', 'actions.ts'), join('app', 'join', '[eventId]', 'actions.ts')].sort(),
    `a new place writes a join request: ${writers.join(', ')}`,
  );
  // The host's own Undo-Accept is the couple's action, never a stranger's.
  const claims = read('app', 'dashboard', '[eventId]', 'guests', 'claims', 'actions.ts');
  const undo = bodyOf(claims, 'export async function undoAcceptAction(');
  assert.match(undo, /await assertCouple\(eventId\);/, 'the request-writing Undo is not the couple\'s alone');
  assert.equal((claims.match(/entry_source:\s*'self_added_unlisted'/g) ?? []).length, 1);

  const join_ = read('app', 'join', '[eventId]', 'actions.ts');
  assert.equal((join_.match(/entry_source:\s*'self_added_unlisted'/g) ?? []).length, 1, 'a second request write in the join door');
  const writer = bodyOf(join_, 'async function createJoinRequest(');
  // An unreadable setting is recorded and fails closed (ugat both-ends: never a silent drop).
  assert.match(writer, /if \(settingErr\) \{\s*console\.error\('\[supabase-error\] app\/join\/\[eventId\]\/actions\.ts · from:events\.select', settingErr\);\s*return null;\s*\}/, 'an unreadable setting is dropped silently');
  const gate = writer.indexOf('if (!anyoneMayAskToJoin(setting?.rsvp_ask_config)) return null;');
  assert.ok(gate > -1, 'the one writer no longer asks the setting itself');
  assert.ok(gate < writer.indexOf("entry_source: 'self_added_unlisted'"), 'the request is written before the setting is asked');
  assert.ok(gate < writer.indexOf('.update('), 'an old request is re-opened before the setting is asked');
});

test('3 · every caller refuses a list-only event before it reaches the writer', () => {
  const join_ = read('app', 'join', '[eventId]', 'actions.ts');
  const calls = join_.match(/await createJoinRequest\(/g) ?? [];
  assert.equal(calls.length, 2, `createJoinRequest is called ${calls.length} times — check each new caller`);
  for (const sig of ['export async function joinEventAction(', 'export async function selfJoinAction(']) {
    const body = bodyOf(join_, sig);
    const refuse = body.search(/if \(!anyoneMayAskToJoin\((?:visRow|event\?)\.rsvp_ask_config\)\) \{/);
    assert.ok(refuse > -1, `${sig} no longer refuses a list-only event`);
    assert.ok(refuse < body.indexOf('await createJoinRequest('), `${sig} writes a request before it refuses`);
  }
  // find-me and the /join page refuse before anything else, too.
  assert.match(read('app', 'join', '[eventId]', 'find-me-actions.ts'), /if \(!anyoneMayAskToJoin\(event\?\.rsvp_ask_config\)\) refuse\(GUEST_LIST_ONLY\);/);
  const page = read('app', 'join', '[eventId]', 'page.tsx');
  const pageGate = page.indexOf('if (!anyoneMayAskToJoin(event.rsvp_ask_config)) {');
  assert.ok(pageGate > -1 && pageGate < page.indexOf('<JoinFlow'), 'the /join form is drawn on a list-only event');
  assert.match(page.slice(pageGate, page.indexOf('<JoinFlow')), /sub=\{INVITATION_ONLY_LINE\}/, 'the /join refusal does not say why');
});

test('4 · no database function writes a request row', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const offenders: string[] = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, name), 'utf8').replace(/--[^\n]*/g, '');
    for (const m of sql.matchAll(/INSERT\s+INTO\s+(?:public\.)?guests\b[\s\S]*?;/gi)) {
      if (/self_added_unlisted/.test(m[0])) offenders.push(name);
    }
  }
  assert.deepEqual(offenders, [], `a migration inserts a join request: ${offenders.join(', ')}`);
});

test('5 · rendered: a stranger on a list-only event is told it is by invitation only — and offered no ask', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GetInside } = await import('@/app/[slug]/_components/get-inside');
  const draw = (signedInNotListed: boolean, mayAskToJoin: boolean) =>
    renderToStaticMarkup(
      React.createElement(GetInside, { slug: 'cale-ice', eventId: 'e-1', signedInNotListed, theOrganizer: 'the couple', mayAskToJoin }),
    );
  const esc = INVITATION_ONLY_LINE.replace(/&/g, '&amp;');
  for (const signedIn of [false, true]) {
    const listOnly = draw(signedIn, false);
    assert.ok(listOnly.includes(esc), `${signedIn ? 'a signed-in' : 'an anonymous'} stranger is not told it is by invitation only`);
    assert.doesNotMatch(listOnly, /href="\/join\//, 'a list-only event offers an ask-to-join');
    const open = draw(signedIn, true);
    assert.ok(!open.includes(esc), 'an event that takes requests says it is invitation only');
  }
  assert.match(draw(true, true), /href="\/join\/e-1"/, 'an open event lost its ask-to-join');
});
