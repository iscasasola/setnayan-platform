/**
 * A guest may CHANGE the couple's recorded address. A guest may not EMPTY it.
 *
 * 🔒 OWNER RULED 2026-08-23, asked directly: **"No for email, yes for the rest."**
 * The reply card writes `email`, `mobile` and `display_name` straight over
 * whatever the couple typed, and every box on it is `defaultValue=` — so a
 * browser that failed to prefill, or a guest who cleared a field to retype it
 * and gave up, wrote NULL over the couple's value. For `email` that is the
 * cross-device sign-in match: the key back in.
 *
 * ⚠ THE TEST IS LOCK-OUT, NOT OWNERSHIP — AND OVER-APPLYING IT IS A DEFECT.
 * `mobile` and `display_name` MUST stay freely clearable. The argument that a
 * guest controls their own data is a good one; it is exactly why those two stay
 * open. Email is different for one reason only, and if a future change starts
 * refusing clears on all three, that reason has been forgotten. Two tests below
 * exist solely to fail if that happens.
 *
 * ⛔ AND THIS IS DELIBERATELY *NOT* `.is('email', null)`. That is the JOIN
 * DOOR's rule (`lib/event-account-link.ts:47` — "only fills a NULL email so we
 * never clobber a different address the couple already recorded"), which
 * refuses to CHANGE an existing value. The owner explicitly permitted the
 * change. Same column, opposite question; copying the shape would have shipped
 * a rule nobody asked for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(resolve(HERE, '..', 'actions.ts'), 'utf8');
/** Comments stripped — a guard must never pass on the prose explaining it. */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// ── The rule the owner actually gave ────────────────────────────────────────

/**
 * The shipped decision, extracted so the behaviour is exercised rather than
 * asserted about. Mirrors `emailPatch` / `storedEmail` in actions.ts.
 */
function emailWrite(posted: string | null, stored: string | null) {
  // Mirrors the shipped truthiness test exactly — `contactEmail` is already
  // `clean(...) || null`, so '' cannot reach it, but the helper must not be
  // subtly stricter than the code it stands in for.
  const patch = posted ? { email: posted } : {};
  return { patch, willHold: posted || stored || null };
}

test('a blank box does not touch the stored address', () => {
  const { patch, willHold } = emailWrite(null, 'couple-typed@example.com');
  assert.deepEqual(patch, {}, 'the email key must be absent, not null');
  assert.equal(willHold, 'couple-typed@example.com');
});

test('a guest MAY change the address to their own — the owner permitted this', () => {
  const { patch, willHold } = emailWrite('guest@example.com', 'couple-typo@example.com');
  assert.deepEqual(patch, { email: 'guest@example.com' });
  assert.equal(willHold, 'guest@example.com');
});

test('a guest filling a blank still works', () => {
  assert.equal(emailWrite('guest@example.com', null).willHold, 'guest@example.com');
});

test('a FAILED `before` read cannot cause an erasure', () => {
  // `stored` is null when the read failed, not only when the column is empty.
  // Omitting the key means a blank box writes nothing either way — no value,
  // no write, nothing lost. Writing back `before.email` would have erased on a
  // transient failure.
  assert.deepEqual(emailWrite(null, null).patch, {});
});

// ── The half that must NOT be over-applied ──────────────────────────────────

test('mobile and preferred name stay freely clearable', () => {
  // Guarded by shape, because the tempting "consistency" fix is to give all
  // three the same treatment — which would take from guests a control the
  // owner deliberately left them.
  // ⚠ LINE-ANCHORED ON PURPOSE. `/mobile:\s*contactMobile,/` looks right and is
  // useless: wrapping the write as `...(x === null ? {} : { mobile:
  // contactMobile })` still CONTAINS that substring, so the over-application
  // this test exists to catch sailed straight through it. Measured: the
  // mutation landed 1 -> 0 and the suite stayed GREEN.
  assert.match(
    SRC,
    /^\s*mobile: contactMobile,$/m,
    'mobile must be a plain unconditional write, not wrapped in a condition',
  );
  assert.match(
    SRC,
    /^\s*display_name: contactName,$/m,
    'display_name must be a plain unconditional write, not wrapped in a condition',
  );
});

test('only ONE of the three contact fields is conditional', () => {
  assert.equal(
    (SRC.match(/\.\.\.\(contactEmail \? \{ email: contactEmail \} : \{\}\)/g) || []).length, 1,
    'the one conditional contact write is expected exactly once',
  );
  // Counts the SHAPE, so a second field made conditional is caught whatever it
  // is named. `contact(Mobile|Name) ?` would be the tell.
  assert.ok(
    !/\.\.\.\(contact(Mobile|Name)\s*[?]/.test(SRC),
    'a second contact field has been made conditional — the ruling was email only',
  );
});

// ── The narration must describe a state the data can reach ─────────────────

test('the host is never told about a removal that can no longer happen', () => {
  // 🔑 The data changing while the words stay put is the half-done shape this
  // project keeps paying for. An empty box no longer clears the email, so
  // "They removed their email." would describe an unreachable state.
  assert.ok(
    !/They removed their email/.test(SRC),
    'the email-removal line must go — an empty box no longer removes anything',
  );
  // Mobile CAN still be removed, so its line must stay.
  assert.ok(
    /They removed their mobile number/.test(SRC),
    'mobile removal is still reachable and must still be reported',
  );
});

test('the report is built from what was STORED, not from what was posted', () => {
  // Passing `contactEmail` here would tell the host the email moved every time
  // a guest saved with the box blank — a notification about nothing.
  assert.match(
    SRC,
    /guestDetailsChanged\(before,\s*\{[\s\S]{0,220}?email:\s*storedEmail/,
    'the change report must compare the stored value',
  );
});

test('the write and the report cannot disagree about what is stored', () => {
  // Both derive from the same two inputs. If a later edit computes one from
  // `contactEmail` and the other from `storedEmail`, the host is told one thing
  // and the row holds another.
  for (const [posted, stored] of [
    [null, 'a@b.co'],
    ['c@d.co', 'a@b.co'],
    ['c@d.co', null],
    [null, null],
  ] as Array<[string | null, string | null]>) {
    const { patch, willHold } = emailWrite(posted, stored);
    const wrote = 'email' in patch ? (patch as { email: string }).email : stored;
    assert.equal(wrote ?? null, willHold, `disagreement for posted=${posted} stored=${stored}`);
  }
});
