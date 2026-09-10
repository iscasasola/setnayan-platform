/**
 * Nothing tells a supplier what accepting COSTS in a currency that is gone.
 *
 * ── WHY (owner, 2026-09-08) ────────────────────────────────────────────────
 * *"why do i see accepting token is free. this token system does not exist
 * anymore."*
 *
 * The founder inquiry line read *"Accepting is token-free."* Two things were
 * wrong, and the second is worse:
 *
 *   1. TOKENS ARE RETIRED — `chat-actions.ts` says "answering is free — token
 *      packs are retired" at the point of accepting, and
 *      `unlock_vendor_event_free` forces the burn to zero for every tier with
 *      its burn path marked "retained but unreachable".
 *   2. IT ADVERTISED A UNIVERSAL THING AS A PRIVILEGE. Answering is free for
 *      every vendor — "the inbox is ungated (owner 2026-07-24) … no tier wall
 *      and no weekly cap". Saying THIS inquiry costs nothing implies the others
 *      do, and the card already states the true version one line above:
 *      "Accept to see who they are and reply — it's free."
 *
 * 🔑 A PERK EVERYONE HAS IS NOT A PERK. This guards the vendor-FACING strings
 * only — the module header still records the 2026-07-16 decision and the comp
 * mechanism, annotated as vestigial, because deleting the record of a locked
 * decision is not the same as retiring a claim made to a supplier.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  FOUNDER_INQUIRY_NOTE,
  FOUNDER_INQUIRY_NOTIFICATION_PREFIX,
} from '@/lib/founder-seats';

const HERE = dirname(fileURLToPath(import.meta.url));

const VENDOR_FACING = {
  FOUNDER_INQUIRY_NOTE,
  FOUNDER_INQUIRY_NOTIFICATION_PREFIX,
};

test('no vendor-facing string mentions tokens', () => {
  for (const [name, text] of Object.entries(VENDOR_FACING)) {
    assert.ok(
      !/token/i.test(text),
      `${name} names a retired currency to a supplier: "${text}"`,
    );
  }
});

test('nor does any of them make a cost claim at all', () => {
  // Accepting is free for everyone, unconditionally. A founder line that talks
  // about price — free OR otherwise — implies a difference that does not exist.
  for (const [name, text] of Object.entries(VENDOR_FACING)) {
    assert.ok(
      !/\bfree\b|\bcost|\bcharge|\bpay\b|\bprice\b/i.test(text),
      `${name} makes a cost claim; accepting is free for every vendor, so this ` +
        `implies the others are not: "${text}"`,
    );
  }
});

test('the identity signal — the half that still says something — survives', () => {
  assert.match(FOUNDER_INQUIRY_NOTE, /founder of Setnayan/);
  assert.match(FOUNDER_INQUIRY_NOTE, /built the app/);
  assert.match(FOUNDER_INQUIRY_NOTIFICATION_PREFIX, /founder of Setnayan/);
});

test('the notification prefix still ends ready for the message that follows', () => {
  // The couple's own text is concatenated onto it.
  assert.ok(
    FOUNDER_INQUIRY_NOTIFICATION_PREFIX.endsWith(' '),
    'the prefix lost its trailing space and will run into the couple’s message',
  );
});

/**
 * ── AND THE ADMIN SURFACES STOPPED SELLING IT TOO ─────────────────────────
 * Two RENDERED admin strings — the founder-seats page and its nav description —
 * still listed "token-free vendor inquiries" among what a seat buys. They tell
 * the person GRANTING a seat what it confers, so a stale benefit there is a
 * decision made on wrong information.
 *
 * The comments and docblocks are deliberately NOT policed: they record an
 * owner-locked decision (2026-07-16) and the comp mechanism, annotated as
 * vestigial. Deleting the record of a locked decision is not the same as
 * retiring a claim.
 */
test('no RENDERED admin string sells token-free inquiries as a seat benefit', () => {
  for (const rel of [
    '../app/admin/founder-seats/page.tsx',
    '../app/admin/_components/admin-nav-descriptions.ts',
  ]) {
    const src = stripComments(readFileSync(resolve(HERE, rel), 'utf8'));
    assert.ok(
      !/token-free/i.test(src),
      `${rel} still lists token-free inquiries as something a founder seat buys — ` +
        'answering is free for every vendor, so it buys nothing',
    );
  }
});

test('the REAL benefits are still described', () => {
  // Removing a vestigial perk must not quietly remove the true ones.
  const page = stripComments(
    readFileSync(resolve(HERE, '../app/admin/founder-seats/page.tsx'), 'utf8'),
  );
  assert.match(page, /in-app feature is already paid for/, 'the comped-features benefit vanished');
  assert.match(page, /Setnayan Founder/, 'the founder badge benefit vanished');
  assert.match(page, /paid directly/, 'the "vendors are still paid directly" clarification vanished');
});
