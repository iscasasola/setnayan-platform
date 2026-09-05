/**
 * the-quick-view-can-act.test.ts — the one guest surface you could read but not
 * use.
 *
 * Every other place a host meets a guest can remove them: the desktop bulk bar
 * (optimistic + undo), both phone densities (swipe-left), and the `[guestId]`
 * page ("Remove guest"). The QUICK VIEW — one body behind two frames, the
 * below-xl sheet and the desktop inspector column — could not. A host could
 * open a guest, read their contact, groups, RSVP, seat and QR, and then have
 * exactly one exit: "Open full details", i.e. leave the roster they were
 * working in to do the one thing the panel existed to save them a trip for.
 *
 * ── WHY THIS IS THE LAST ONE, AND WHY IT LOOKED DELIBERATE ─────────────────
 * The file's own docblock called it "read-only", and read-only is a legitimate
 * design — for a PREVIEW. It stopped being one once the roster row beside it
 * grew inline editors for side, role, RSVP and groups: every field on the row
 * became actionable while the panel that shows those same fields in detail
 * stayed inert. The panel was not more careful than the row, it was just older.
 *
 * ── ONE ACTION, NOT A SECOND RULE ──────────────────────────────────────────
 * It posts the SAME `softDeleteGuest` the full detail page posts. That action
 * owns both gates — the couple is refused, and a guest who has already RSVP'd
 * must be reset to Pending first — so this file must NOT re-spell them. The one
 * thing mirrored here is the COUPLE case, and only because a button that can
 * only ever fail is worse than no button: the couple gets the same sentence the
 * detail page shows instead.
 *
 * ⚠ KNOWN, ACCEPTED: a refusal redirects to `[guestId]?error=…`, so removing an
 * RSVP'd guest from the sheet bounces to their full page carrying the reason.
 * That is `softDeleteGuest`'s existing behaviour, shared with the detail page.
 * Forking a nicer in-sheet error would mean a second copy of the failure path —
 * the thing this file exists to prevent.
 *
 * 🛡 Mutation-checked against the real file, failures counted, each RED:
 *  · drop the <form action={softDeleteGuest…}>      → 0 → 1 failing · RED
 *  · remove the isCouple branch (dangle the button) → 0 → 1 failing · RED
 *  · re-spell the RSVP gate in the body             → 0 → 1 failing · RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const BODY = stripComments(readFileSync(join(HERE, 'guest-detail-body.tsx'), 'utf8'));
const DETAIL = stripComments(
  readFileSync(resolve(HERE, '..', '[guestId]', 'page.tsx'), 'utf8'),
);

test('the quick view can remove a guest', () => {
  assert.ok(
    /action=\{softDeleteGuest\.bind\(null, eventId, guest\.guest_id\)\}/.test(BODY),
    'the shared quick-view body has no remove action — a host can read the ' +
      'guest and do nothing about them',
  );
  assert.ok(
    /from '\.\.\/\[guestId\]\/actions'/.test(BODY),
    'it must import the shipped action, not declare its own',
  );
});

test('it posts the SAME action the full detail page posts', () => {
  // Two doors, one rule. If these ever diverge, one of them is wrong and
  // nothing will say which.
  assert.ok(
    /softDeleteGuest/.test(DETAIL),
    'the detail page no longer uses softDeleteGuest — the baseline moved',
  );
  assert.ok(
    /softDeleteGuest/.test(BODY),
    'the quick view must post the same action',
  );
});

test('the couple gets the sentence, not a button that always fails', () => {
  assert.ok(
    /const isCouple = guest\.role === 'bride' \|\| guest\.role === 'groom';/.test(
      BODY,
    ),
    'the couple must be branched before the button is rendered',
  );
  assert.ok(
    /Foundation of the event/.test(BODY),
    'and told why, in the same words the detail page uses',
  );
  assert.ok(
    /Foundation of the event/.test(DETAIL),
    'the detail page wording moved — these two should still read alike',
  );
});

test('the RSVP gate is NOT re-spelled here', () => {
  // softDeleteGuest owns it. A second copy in the UI is a rule that can drift
  // out of step with the server silently.
  assert.equal(
    /rsvp_status !== 'pending'/.test(BODY),
    false,
    'the quick view is re-implementing the RSVP gate — leave it in the action',
  );
});
