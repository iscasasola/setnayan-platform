/**
 * 📬 EVERY WRITER OF A GUEST'S REPLY ASKS THE REPLY WINDOW FIRST (owner 2026-10-14, DECISION_LOG 📬
 * "RSVP GETS ITS OWN OPEN AND CLOSE": *"Server actions for reply MUST refuse outside the window (not
 * just hide the button)"*). Hiding the Reply button is the page's half; a stale tab, a bookmarked
 * reply page or a crafted post reaches the writer directly.
 *
 *   1 · `submitRsvp` asks `replyWindowOfRow` BEFORE its answer write, and a refusal leaves with
 *       `?rsvp=window` — which both pages turn into the sentence (`replyRefusedWords`).
 *   2 · The join door's request carries an answer, so its one writer (`createJoinRequest`) asks too,
 *       before it writes, and both callers ask first so the door can say why.
 *   3 · THE TREE: any guest-facing file (`app/[slug]`, `app/join`, `app/api`) that writes a `guests`
 *       row naming `rsvp_status` asks the window — a new reply writer cannot be added without it.
 *       The couple's Guest list (`app/dashboard`) is deliberately NOT walked: their edits are never
 *       gated (the same ruling, item 3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

/** The body of `export async function <name>(` / `async function <name>(` up to the next top-level function. */
function fnBody(body: string, name: string): string {
  const start = body.search(new RegExp(`(?:export )?async function ${name}\\(`));
  assert.ok(start >= 0, `${name} not found`);
  const rest = body.slice(start + 1);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? body.slice(start) : body.slice(start, start + 1 + next);
}

test('1 · submitRsvp asks the window before it writes the answer, and refuses with ?rsvp=window', () => {
  const fn = fnBody(src('app/[slug]/actions.ts'), 'submitRsvp');
  const ask = fn.indexOf('replyWindowOfRow(');
  const write = fn.search(/\.from\('guests'\)\s*\.update\(/);
  assert.ok(ask >= 0, 'submitRsvp no longer asks the reply window');
  assert.ok(write > ask, 'the answer is written before the window is asked');
  const gate = fn.slice(ask, ask + 400);
  assert.match(gate, /\.state !== 'open'/, 'the window is asked but its answer is not obeyed');
  assert.match(gate, /\?rsvp=window/, 'a refusal must reach the page as ?rsvp=window');
  // Both pages say it.
  assert.match(src('app/[slug]/page.tsx'), /search\.rsvp === 'window'[\s\S]{0,200}replyRefusedWords\(/);
  assert.match(src('app/[slug]/invite/reply/page.tsx'), /search\.rsvp === 'window'[\s\S]{0,200}replyRefusedWords\(/);
});

test('2 · the join door’s request asks the window — the writer, and both callers before it', () => {
  const body = src('app/join/[eventId]/actions.ts');
  const writer = fnBody(body, 'createJoinRequest');
  const ask = writer.indexOf('replyWindowOfRow(');
  assert.ok(ask >= 0 && ask < writer.indexOf('answerColumns'), 'createJoinRequest writes an answer without asking the window');
  for (const caller of ['joinEventAction', 'selfJoinAction']) {
    const fn = fnBody(body, caller);
    const asked = fn.indexOf('replyWindowOfRow(');
    assert.ok(asked >= 0 && asked < fn.indexOf('createJoinRequest('), `${caller} sends a request without asking the window`);
  }
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test('3 · every guest-facing file that writes a guest’s rsvp_status asks the window', () => {
  const files = ['app/[slug]', 'app/join', 'app/api'].flatMap((d) => walk(join(WEB, d)));
  assert.ok(files.length > 50, 'the walk found almost nothing — it is broken, not clean');
  const writers: string[] = [];
  const missing: string[] = [];
  for (const f of files) {
    const body = stripComments(readFileSync(f, 'utf8'));
    const writesGuests = /\.from\('guests'\)\s*\.(?:update|insert|upsert)\(/.test(body) || /answerColumns/.test(body);
    if (!writesGuests || !/rsvp_status\s*:/.test(body)) continue;
    const rel = relative(WEB, f);
    writers.push(rel);
    if (!/replyWindowOfRow\(|replyWindow\(/.test(body)) missing.push(rel);
  }
  assert.ok(writers.includes('app/[slug]/actions.ts') && writers.includes('app/join/[eventId]/actions.ts'), `the known writers were not found: ${writers.join(', ')}`);
  assert.deepEqual(missing, [], 'these guest-facing files write a reply without asking the reply window');
});

test('4 · a join request refused before replies open is told the Reply card’s words and day — one source', async () => {
  const { joinDoorRefusalMessage } = await import('./join-door-refusal-copy');
  const { replyWindowWords } = await import('./reply-window');
  const w = { theOrganizer: 'the couple' };
  const notYet = replyWindowWords({ state: 'not_yet', reason: 'opens_on_date', opensOn: '2026-11-14', closesOn: null }, w.theOrganizer);
  assert.equal(joinDoorRefusalMessage('replies_not_yet', w, notYet), 'Replies open on Saturday, 14 November');
  const closed = replyWindowWords({ state: 'closed', reason: 'closed_by_couple', opensOn: null, closesOn: null }, w.theOrganizer);
  assert.equal(joinDoorRefusalMessage('replies_closed', w, closed), 'Replies are closed. Need to change? Message the couple.');
  // The door reads the window from its own one read and hands the words in — never a date from the address.
  const flow = src('app/join/[eventId]/_components/join-flow.tsx');
  assert.match(flow, /\.select\(REPLY_WINDOW_EVENT_COLUMNS\)/, 'the door no longer reads the window’s columns');
  assert.match(flow, /replyWindowWords\(await replyWindowOfRow\(askRow\), w\.theOrganizer\)/, 'the door’s words are not the window’s');
  assert.match(flow, /joinDoorRefusalMessage\(errorKey, w, repliesShut\)/, 'the refusal is not handed the window’s words');
  assert.doesNotMatch(flow, /search(Params)?\.(opens|date)/, 'a date read from the address');
});
