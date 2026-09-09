/**
 * THE WIRING GUARD FOR THE LOCK STEP.
 *
 * `lock-freeze-copy.test.ts` proves the SENTENCES are honest. This proves the
 * screens actually use them — which is the half that rots, because a lie can
 * come back three ways:
 *
 *   1. Somebody types "Deal locked" back into the card.
 *   2. A NEW <ChatMessageStream> mount forgets the handshake prop. There were
 *      FOUR mounts when this was written and the survey that found the defect
 *      named three — a hand-enumerated list is a list of the ones somebody
 *      thought of, so the file set is DERIVED by scanning the tree.
 *   3. The supplier is told "Deal locked" by NOTIFICATION instead, which is
 *      what actually shipped: one press fired both "A couple wants to book you"
 *      and "Couple accepted: Deal locked".
 *
 * And the refusal half:
 *   4. `/vendor-dashboard` stops reading `lock_agree` / `lock_decline`, which
 *      is the state it was in for the whole life of the feature.
 *
 * Comments are stripped before matching — every file below carries a note
 * naming the string it removed, and a raw-source guard would report the defect
 * it just fixed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const APP = join(WEB, 'app');

const read = (abs: string) => stripComments(readFileSync(abs, 'utf8'));

/** Every .tsx under app/ — derived, never listed. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (abs.endsWith('.tsx')) out.push(abs);
  }
  return out;
}

/** The JSX element text for each `<ChatMessageStream …/>` mount in a file. */
function mounts(src: string): string[] {
  const found: string[] = [];
  let i = src.indexOf('<ChatMessageStream');
  while (i !== -1) {
    const end = src.indexOf('/>', i);
    found.push(src.slice(i, end === -1 ? src.length : end + 2));
    i = src.indexOf('<ChatMessageStream', i + 1);
  }
  return found;
}

test('every <ChatMessageStream> mount passes the handshake', () => {
  const files = walk(APP);
  const sites: Array<{ file: string; jsx: string }> = [];
  for (const abs of files) {
    for (const jsx of mounts(read(abs))) sites.push({ file: abs.slice(WEB.length + 1), jsx });
  }
  // Anti-vacuity: a scan that finds nothing passes for free.
  assert.ok(
    sites.length >= 4,
    `expected at least the 4 known mounts, found ${sites.length} — did the scan break?`,
  );
  const missing = sites.filter((s) => !/\blockHandshake=/.test(s.jsx)).map((s) => s.file);
  assert.deepEqual(
    missing,
    [],
    `these chat mounts would tell both people a deal is locked before anybody booked: ${missing.join(', ')}`,
  );
});

test('the amendment card holds no hardcoded booked sentence', () => {
  const card = read(join(APP, '_components', 'chat-amendment-card.tsx'));
  const hits = card.match(/Deal locked/gi) ?? [];
  assert.equal(
    hits.length,
    0,
    'the frozen-price sentence must come from lockFreezeLine(), never from a literal in the card',
  );
  assert.match(card, /lockFreezeLine\(/, 'the card no longer routes through the shared copy');
});

test('the "Deal locked" notification does not fire on an ask', () => {
  const src = read(join(APP, '_components', 'negotiation-actions.ts'));
  const hits = src.match(/notifyChangeCounterparty\(ctx, 'Deal locked'/g) ?? [];
  assert.equal(hits.length, 1, 'there should be exactly one Deal-locked notify site');
  // It must be gated on the ask flag, and that flag must be SET where the
  // handshake reports an ask.
  assert.match(
    src,
    /if \(!askedNotBooked\) \{\s*await notifyChangeCounterparty\(ctx, 'Deal locked', 'accepted'\);/,
    'the Deal-locked notification is no longer gated on "did this actually book anybody?"',
  );
  const setSites = src.match(/askedNotBooked = true/g) ?? [];
  assert.equal(
    setSites.length,
    2,
    "both ask outcomes ('requested' and 'already_requested') must set the flag",
  );
});

test('the supplier is told the outcome of a booking ask', () => {
  const page = read(join(APP, 'vendor-dashboard', 'page.tsx'));
  assert.match(page, /lockAgreeNotice\(/, '/vendor-dashboard does not read lock_agree');
  assert.match(page, /lockDeclineNotice\(/, '/vendor-dashboard does not read lock_decline');
  assert.match(page, /\{lockAnswer\.text\}/, 'the notice is computed but never rendered');
});
