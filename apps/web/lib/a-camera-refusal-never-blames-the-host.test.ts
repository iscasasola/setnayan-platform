/**
 * Guard: when a camera does not open, the screen must not invent a reason.
 *
 * WHAT WAS WRONG (C7 + C8, measured against PRODUCTION on 2026-08-25, not read
 * off a brief). Two guest-facing surfaces printed a sentence about the HOST
 * whenever a camera failed to open — and neither had checked whether the host
 * had anything to do with it.
 *
 *   C8 · `/papic/me/[token]`, the page a guest's PRINTED personal QR opens,
 *        resolved only the paid Limited ROLL camera. Production holds **zero**
 *        `papic_limited_snapshots`, ever. So all **40** guests across all **5**
 *        events landed on "The host hasn't turned on Papic for the guest list
 *        yet" — while `papic_event_pool_status(event_id).applies` was **true on
 *        every one of those five events**, i.e. the guest camera was OPEN and
 *        one redirect away. The page asked the wrong question, then blamed the
 *        host for its own answer.
 *
 *   C7 · `/papic/decorate` read the RIGHT gate, but that gate collapses "we
 *        could not find out" into `false`: the pool reader returns its ABSENT
 *        sentinel on any RPC error. Since the pool applies on every production
 *        event, the refusal is unreachable through the gate — so every time it
 *        HAS rendered, it was a failed read wearing a sentence about the host.
 *
 * 🔑 ONE DEFECT IN TWO COSTUMES: a state nobody chose, and a state we could not
 * determine, both reported as somebody's decision. Same family as this repo's
 * "a rejected query is not a thrown error — the only symptom is an absence".
 *
 * THE FIX IS WORDING PLUS ONE DOOR, AND NO GATE WAS WIDENED. Every permission
 * check still fails closed; `eventPapicGuestActive` still returns false for
 * 'unknown', so all of its other callers are byte-identical in behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const strip = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

const read = (...p: string[]) => strip(readFileSync(join(WEB, ...p), 'utf8'));

/**
 * Every guest-facing camera surface, DERIVED — not a list I wrote out. Anything
 * under app/papic that renders a refusal is in scope, so a sixth surface added
 * next month is policed the day it lands. A hand-written list is exactly how the
 * personal-QR page went two years without anyone noticing which gate it read.
 */
function papicSurfaces(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === 'page.tsx') out.push(p);
    }
  })(join(WEB, 'app', 'papic'));
  return out;
}

test('🔴 no Papic surface tells a guest the host turned cameras off', () => {
  const surfaces = papicSurfaces();
  assert.ok(
    surfaces.length >= 8,
    `floor: expected 8+ Papic pages, found ${surfaces.length} — if the tree ` +
      'moved, re-derive rather than lowering this',
  );

  /* 🪤 REV 1 OF THIS PATTERN WAS DECORATIVE AND THE MUTATION RUN SAID SO.
     It read `/host\s+(hasn|has not|didn)[^<"']*turned on/` — and the very
     sentence it exists to ban is "The host hasn't turned on…", whose APOSTROPHE
     the character class excluded. Re-injecting the exact string left it GREEN
     (occurrence count 0 → 1). A search that cannot match is not a negative
     result. This one spans anything but sentence/JSX punctuation, so straight
     and curly apostrophes both fall inside it. */
  const blaming = surfaces.filter((f) =>
    /\bhost\b[^.<>{}]{0,60}turned\s+on/i.test(strip(readFileSync(f, 'utf8'))),
  );
  assert.deepEqual(
    blaming.map((f) => f.slice(WEB.length + 1)),
    [],
    'a Papic page states that the HOST turned cameras off. Unless it has ' +
      'checked, it is asserting somebody’s intent from a failed or irrelevant ' +
      'read — which is what sent 40 of 40 production guests away from an open camera.',
  );
});

test('🚪 a guest whose roll seat is missing is handed the camera that IS open', () => {
  const me = read('app', 'papic', 'me', '[token]', 'page.tsx');
  assert.match(
    me,
    /eventPapicGuestAccess\(/,
    'the personal-QR page must ask the gate that actually decides whether this ' +
      'guest may shoot, not only whether a PAID roll camera exists for them',
  );
  assert.match(
    me,
    /session\?next=guest/,
    'when the camera is open, the page must send the guest to it — through the ' +
      'token→session bridge, so no guest token lands in the destination URL',
  );

  const route = read('app', 'papic', 'me', '[token]', 'session', 'route.ts');
  assert.match(
    route,
    /guest: '\/papic\/guest'/,
    'the bridge has no allowlisted destination for the guest camera, so the ' +
      'link above silently lands on the decorator instead',
  );
  /* ⛔ AND IT STAYS AN ALLOWLIST. An open redirect here would take a guest's
     session cookie somewhere we did not choose. */
  assert.ok(
    !/searchParams\.get\('next'\)\s*\|\|/.test(route),
    'the bridge must resolve `next` through the fixed map, never fall back to ' +
      'a caller-supplied path',
  );
});

test('🔴 "we could not tell" is a third state, and it is not a permission', () => {
  const gate = read('lib', 'papic-guest.ts');
  assert.match(
    gate,
    /export type PapicGuestAccess = 'on' \| 'off' \| 'unknown'/,
    'the gate must be able to say it could not find out',
  );
  /* THE SAFETY PROPERTY. The boolean every other caller uses must still be
     false for 'unknown' — three states are for WORDING, never for access. */
  assert.match(
    gate,
    /eventPapicGuestAccess\(supabase, eventId\)\) === 'on'/,
    'eventPapicGuestActive must be exactly `access === on` — anything looser ' +
      'turns a read failure into a granted camera for its ten callers',
  );

  const pool = read('lib', 'papic-event-pool.ts');
  assert.match(
    pool,
    /return \{ ok: false, status: EVENT_POOL_ABSENT \};/,
    'the pool reader must report a FAILED read distinctly from an absent pool — ' +
      'one sentinel for both is what made the failure printable as a decision',
  );
});

test('🔴 the two causes of "no camera" are told apart', () => {
  const lib = read('lib', 'papic-limited.ts');
  for (const shape of [/reason: 'not_offered'/, /reason: 'no_seat'/]) {
    assert.match(
      lib,
      shape,
      `resolveGuestCamera lost ${shape} — "nobody has a camera" and "you have ` +
        'no camera" are different facts and were being printed as one sentence',
    );
  }
  const me = read('app', 'papic', 'me', '[token]', 'page.tsx');
  assert.match(
    me,
    /camera\.reason === 'no_seat'/,
    'the page reads the split but does not use it — the copy is the whole point',
  );
});
