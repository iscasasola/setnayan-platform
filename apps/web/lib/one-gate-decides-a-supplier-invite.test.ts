/**
 * one-gate-decides-a-supplier-invite.test.ts
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * Five shipped call sites answered ONE question — "may this supplier be sent a
 * claim invite?" — three different ways:
 *
 *   · `createManualVendorInvite`   — manual_vendor_id IS NOT NULL
 *                                    AND marketplace_vendor_id IS NULL
 *   · `finalizeVendor`             — the same two conditions
 *   · the workspace page           — marketplace_vendor_id IS NULL, alone
 *   · `createAutoShareInviteAction`— no condition at all
 *   · `inviteVendorByEmail`        — marketplace_vendor_id IS NULL, alone
 *
 * Measured against production 2026-09-03: 45 `event_vendors` rows, **43 with
 * BOTH ids NULL**. Narrowed to the rows actually eligible — off-platform AND
 * locked, which is what the workspace page offers an invite for — it is
 * **12 of 12 REFUSED**, every one told *"This vendor is already on Setnayan."*
 * That sentence was false for precisely the suppliers who saw it.
 * `vendor_invites` held **0 rows of any source**.
 *
 * ── WHY A GUARD AND NOT JUST THE FIX ───────────────────────────────────────
 * Because the wrong half was written into `ensureAutoShareInvite`'s own
 * docblock as an instruction to callers, and two callers followed it in good
 * faith. Deleting the sentence is not enough — the next session re-derives
 * "manual vendors get manual invites" from the column name alone. So this
 * asserts three things, each facing a different way of undoing it:
 *
 *   1 · TRUTH TABLE — the predicate turns on the account and nothing else.
 *   2 · SOURCE      — every gate CALLS it; none spells its own. Property 1 is
 *                     blind to a call site that stops calling.
 *   3 · COPY        — the false sentence cannot come back as rendered text.
 *
 * ⚠ WHAT THIS DOES NOT SAY. It does not say every off-platform supplier should
 * be OFFERED an invite on every surface. Whether the booking is real enough to
 * bother is a separate condition and deliberately stays per-surface: the
 * workspace page ANDs a locked-status test, `finalizeVendor` runs at lock time,
 * and the add-a-contact modal offers the QR at add time per the owner's
 * 2026-07-01 directive. Folding status into the predicate would silently retire
 * one of those three.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  SUPPLIER_ALREADY_HAS_ACCOUNT_MESSAGE,
  canInviteSupplier,
  isOffPlatformSupplier,
} from './supplier-invite-eligibility';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every file that decides, or renders, this question. A gate that moves house
 * must be added here — an empty list would make the source properties vacuous,
 * which the first assertion below refuses.
 */
const GATES = [
  'app/dashboard/[eventId]/vendors/actions.ts',
  'app/dashboard/[eventId]/vendors/[vendorId]/workspace/actions.ts',
  'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx',
  'lib/vendor-invite-actions.ts',
] as const;

/**
 * ⚠ ONE COMMENT STRIPPER. `stripComments` (`lib/strip-comments.ts`) is a LEXER
 * and this file must not grow its own: the obvious two-replace regex deletes
 * real code, because a `//` line containing a `/*` opens a block-comment window
 * that runs to the next real terminator — so a scan can assert against BLANKED
 * SOURCE and pass. `scripts/lint-one-comment-stripper.mjs` fails CI over it.
 * It matters especially here, where the docblocks QUOTE the wrong predicate on
 * purpose so the correction is readable next to it.
 */
function code(rel: string): string {
  return stripComments(readFileSync(resolve(WEB, rel), 'utf8'));
}

function count(haystack: string, re: RegExp): number {
  return haystack.match(re)?.length ?? 0;
}

// ── 1 · TRUTH TABLE ──────────────────────────────────────────────────────────

test('the predicate turns on the account, and on nothing else', () => {
  // The row shape that broke it: off-platform, no contact card. 43 of 45 in
  // production. This is the case that must be TRUE.
  assert.equal(canInviteSupplier({ marketplace_vendor_id: null }), true);
  assert.equal(canInviteSupplier({}), true, 'an absent column must not read as "has an account"');
  assert.equal(canInviteSupplier({ marketplace_vendor_id: undefined }), true);
  assert.equal(canInviteSupplier({ marketplace_vendor_id: '' }), true, 'an empty id is not an account');

  // ...and the one case that must be FALSE.
  assert.equal(canInviteSupplier({ marketplace_vendor_id: 'vp_123' }), false);
});

test('a contact card is irrelevant to it — that half was never the question', () => {
  // `event_manual_vendors` requires contact_person AND contact_number, both NOT
  // NULL, so a supplier the couple named with nothing but a NAME can never have
  // one. Making the invite depend on it excluded exactly the supplier who most
  // needs inviting. The predicate must not read the column at all.
  for (const manual of [null, undefined, 'mv_123']) {
    assert.equal(
      canInviteSupplier({ marketplace_vendor_id: null, ...({ manual_vendor_id: manual } as object) }),
      true,
      `manual_vendor_id=${String(manual)} changed the answer`,
    );
    assert.equal(
      canInviteSupplier({
        marketplace_vendor_id: 'vp_123',
        ...({ manual_vendor_id: manual } as object),
      }),
      false,
      `manual_vendor_id=${String(manual)} changed the answer`,
    );
  }
  // Structural, not just behavioural: the function body cannot mention it.
  const src = code('lib/supplier-invite-eligibility.ts');
  const body = src.slice(src.indexOf('export function canInviteSupplier'));
  const fnEnd = body.indexOf('\n}');
  assert.ok(fnEnd > 0, 'could not find the end of canInviteSupplier');
  assert.equal(
    /manual_vendor_id/.test(body.slice(0, fnEnd)),
    false,
    'canInviteSupplier reads manual_vendor_id again',
  );
});

// ── 2 · SOURCE ───────────────────────────────────────────────────────────────

test('every gate CALLS the predicate — none spells its own', () => {
  assert.ok(GATES.length >= 4, 'the gate list is too short to be measuring anything');
  let callSites = 0;
  for (const rel of GATES) {
    const src = code(rel);
    const calls = count(src, /canInviteSupplier\s*\(/g);
    assert.ok(calls > 0, `${rel} no longer asks canInviteSupplier`);
    callSites += calls;

    // ⛔ And no file re-derives it. Both spellings of the old gate, in either
    // order, plus the raw column test that the predicate exists to replace.
    assert.equal(
      count(src, /manual_vendor_id\s*&&\s*!\s*\w+\.marketplace_vendor_id/g),
      0,
      `${rel} spells the old two-column gate again`,
    );
    assert.equal(
      count(src, /!\s*\w+\.manual_vendor_id\s*\|\|\s*\w+\.marketplace_vendor_id/g),
      0,
      `${rel} spells the old two-column gate again`,
    );
  }
  // Five gates, and the count is asserted rather than "at least one file
  // matched" — a file-level check cannot tell 5 from 4, and a gate that
  // silently stops calling is exactly how this drifted the first time.
  assert.equal(callSites, 5, `expected 5 call sites, found ${callSites}`);
});

test('the invite helper is never called without the gate in the same file', () => {
  // `ensureAutoShareInvite` is the write. Every file that performs it must also
  // ask the question — `createAutoShareInviteAction` shipped for months doing
  // the write with no condition at all.
  for (const rel of GATES) {
    const src = code(rel);
    if (!/ensureAutoShareInvite\s*\(/.test(src)) continue;
    assert.ok(
      /canInviteSupplier\s*\(/.test(src),
      `${rel} mints an invite without asking whether it may`,
    );
  }
});

// ── 3 · COPY ─────────────────────────────────────────────────────────────────

test('the false sentence cannot come back as rendered text', () => {
  // "This vendor is already on Setnayan." was returned to 12 of 12 eligible
  // off-platform suppliers — the ones who are not on Setnayan. Checked against
  // STRIPPED source: the docblocks quote it on purpose, and that quotation is
  // the record of what went wrong.
  for (const rel of GATES) {
    assert.equal(
      /This vendor is already on Setnayan/.test(code(rel)),
      false,
      `${rel} returns the false sentence again`,
    );
  }
  // The replacement says the thing that is actually true when it is shown.
  assert.match(SUPPLIER_ALREADY_HAS_ACCOUNT_MESSAGE, /already has a Setnayan account/);
  assert.equal(
    /vendor/i.test(SUPPLIER_ALREADY_HAS_ACCOUNT_MESSAGE),
    false,
    'couple-facing copy calls them a supplier, not a vendor',
  );
});

test('the docblock that taught the wrong gate carries its own correction', () => {
  // The instruction "caller MUST verify manual_vendor_id IS NOT NULL AND
  // marketplace_vendor_id IS NULL" is where two callers got it. Deleting it is
  // not enough — the record of WHY has to stay, or the next session re-derives
  // it from the column name. Read RAW: this lives in comments.
  const raw =
    readFileSync(resolve(WEB, 'lib/supplier-invite-eligibility.ts'), 'utf8') +
    readFileSync(resolve(WEB, 'lib/vendor-invites.ts'), 'utf8');
  assert.match(raw, /manual_vendor_id IS NOT NULL/, 'the record of the wrong rule was deleted');
  assert.match(raw, /12 of 12/, 'the measurement that proves it was wrong was deleted');
  // ...but it must not survive as a live instruction.
  assert.equal(
    /MUST verify[\s\S]{0,80}manual_vendor_id IS NOT NULL/.test(raw),
    false,
    'the docblock still INSTRUCTS callers to use the wrong gate',
  );
});

// ── 4 · THE SECOND QUESTION, FOUND BY THIS GUARD ─────────────────────────────
//
// While property 2 was being written it fired on a site nobody had listed:
// the `HostServiceDetails` render gate, which ANDed the same wrong
// `manual_vendor_id IS NOT NULL` half. It is a DIFFERENT question — "may the
// host author this supplier's package details?" — with the same fact
// underneath, and the same 43-of-45 blast radius:
//
//   · the EDITOR was never rendered for a both-ids-NULL supplier, and
//   · `updateHostServiceDetails` scoped its UPDATE the same way, so it matched
//     no row — and an UPDATE that matches nothing returns NO ERROR.
//
// 🔑 THE TWO FAILURES CONCEALED EACH OTHER. With the form hidden, the silent
// no-op behind it was unreachable and therefore unreportable. Fixing only one
// would have turned a hidden control into a save button that does nothing.

test('the fact and the question are separate names, and both are exported', () => {
  // Same answer today. Named apart so a future clause on one does not silently
  // move the other — the exact way five call sites drifted in the first place.
  assert.equal(isOffPlatformSupplier({ marketplace_vendor_id: null }), true);
  assert.equal(isOffPlatformSupplier({ marketplace_vendor_id: 'vp_1' }), false);
  assert.equal(
    canInviteSupplier({ marketplace_vendor_id: null }),
    isOffPlatformSupplier({ marketplace_vendor_id: null }),
  );
});

test('the host-details gates ask the fact, on BOTH the render and the write', () => {
  const page = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  const actions = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/actions.ts');

  // RENDER — the editor is offered to every off-platform supplier.
  assert.match(
    page,
    /!hasPackageLines\s*&&\s*isOffPlatformSupplier\(ev\)/,
    'the host-details editor is gated on something other than the shared fact',
  );

  // WRITE — and the save reaches them. The column filter that made this a
  // silent no-op must be gone; the marketplace filter must NOT be, or a host
  // could overwrite a marketplace supplier's own package.
  assert.equal(
    count(actions, /\.not\('manual_vendor_id',\s*'is',\s*null\)/g),
    0,
    'the write still filters on manual_vendor_id — it will match no row and say nothing',
  );
  assert.match(
    actions,
    /\.is\('marketplace_vendor_id',\s*null\)/,
    'the write no longer refuses a marketplace supplier — a host can overwrite their package',
  );
});
