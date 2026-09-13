/**
 * a-cost-needs-no-supplier.test.ts — BA7's fence.
 *
 * ── WHAT IS BEING FENCED ───────────────────────────────────────────────────
 * `event_vendor_line_items.vendor_id` is NOT NULL, so for the life of this
 * project every peso had to hang off a supplier row and `/budget` told the
 * couple so: *"No vendors yet. Add a vendor first, then come back here to
 * itemize costs."* `event_costs` removed the reason. Three things now have to
 * stay true, and each fails a different way:
 *
 *   1 · DRAFT   — the validator accepts a cost with no supplier and rejects
 *                 nothing a couple can legitimately record. A tightened
 *                 predicate here would close the door again without touching
 *                 the schema.
 *   2 · SOURCE  — naming a supplier saves it LOCKED and mints the invite from
 *                 the EXISTING claim link; naming nobody writes one
 *                 `event_costs` row and creates no supplier and no invite.
 *                 The unit tests are blind to an action that stops doing
 *                 either.
 *   3 · COPY    — the page's empty state no longer sends the couple away to
 *                 invent a supplier. That sentence was the defect said out
 *                 loud, and a future session restoring it would restore the
 *                 dead end even with the schema fixed.
 *
 * ⚠ IT DOES NOT SAY SUPPLIERS ARE OPTIONAL EVERYWHERE. `event_vendor_line_items`
 * still requires one, deliberately — a cost WITH a supplier belongs on that
 * supplier's card, and keeping the two tables apart is what stops one peso
 * being counted in both.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  EVENT_COST_LABEL_MAX,
  EVENT_COST_MAX_PHP,
  costCategoryOptions,
  isCostCategoryId,
  parseCostAmountPhp,
  readCostDraft,
  vendorCategoryForCostCategory,
} from './event-costs';
import { OTHER_BUCKET } from './budget-truth';
import { VENDOR_CATEGORIES } from './vendors';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTIONS = 'app/dashboard/[eventId]/budget/cost-actions.ts';
const PAGE = 'app/dashboard/[eventId]/budget/page.tsx';

/**
 * ⚠ ONE COMMENT STRIPPER. `stripComments` (`lib/strip-comments.ts`) is a LEXER
 * and this file must not grow its own: the obvious two-replace regex deletes
 * real code, because a `//` line containing a `/*` opens a block-comment window
 * that runs to the next real terminator, so a scan can assert against BLANKED
 * SOURCE and pass. `scripts/lint-one-comment-stripper.mjs` fails CI over it,
 * and four sessions paid a full CI cycle for that lesson in one day.
 */
function code(rel: string): string {
  return stripComments(readFileSync(resolve(WEB, rel), 'utf8'));
}

function count(haystack: string, re: RegExp): number {
  return haystack.match(re)?.length ?? 0;
}

const draft = (over: Partial<Record<string, unknown>> = {}) =>
  readCostDraft({
    planGroupId: 'rings',
    label: 'Wedding rings',
    amountPhp: '40000',
    paidPhp: '',
    dueDate: '',
    note: '',
    supplierName: '',
    ...over,
  });

// ── 1 · DRAFT ────────────────────────────────────────────────────────────────

test('BA7 · the three costs the taxonomy names and could not hold all validate', () => {
  // Rings, the marriage licence and ang pao — the exact examples the defect
  // was reported with. Each has NO supplier, and each must come back clean.
  for (const [planGroupId, label, amount] of [
    ['rings', 'Wedding rings', '40,000'],
    ['wedding_paperwork', 'Marriage licence', '₱600'],
    ['other', 'Ang pao', '12000'],
  ] as const) {
    const r = draft({ planGroupId, label, amountPhp: amount });
    assert.equal(r.ok, true, `${label} was refused: ${r.ok ? '' : r.error}`);
    assert.ok(r.ok && r.draft.supplierName === null, `${label} invented a supplier`);
  }
});

test('BA7 · a blank paid figure is ₱0, and an unreadable one is an error', () => {
  // The distinction is money. Blank means "written down, not paid yet" — an
  // ordinary thing to record. A typed-but-unparseable value read as ₱0 would
  // tell the couple they still owe what they have already handed over.
  const blank = draft({ paidPhp: '' });
  assert.ok(blank.ok && blank.draft.paidPhp === 0);
  const spaces = draft({ paidPhp: '   ' });
  assert.ok(spaces.ok && spaces.draft.paidPhp === 0);
  assert.equal(draft({ paidPhp: 'about half' }).ok, false);
  const partial = draft({ paidPhp: '₱ 15,000' });
  assert.ok(partial.ok && partial.draft.paidPhp === 15000);
});

test('BA7 · paid ABOVE the amount is accepted here and reported by the resolver', () => {
  // Not the validator's job to refuse it. Overpaying is real; the resolver
  // NAMES it (`overpaid_cost`) rather than clamping, and a form that refused
  // the entry would make the couple's own records unrepresentable.
  const r = draft({ amountPhp: '18000', paidPhp: '25000' });
  assert.ok(r.ok && r.draft.paidPhp === 25000 && r.draft.amountPhp === 18000);
});

test('BA7 · every rejection is a sentence, and the refusals are the right ones', () => {
  for (const [field, value] of [
    ['planGroupId', 'not_a_group'],
    ['planGroupId', ''],
    ['label', '   '],
    ['label', 'x'.repeat(EVENT_COST_LABEL_MAX + 1)],
    ['amountPhp', ''],
    ['amountPhp', '0'],
    ['amountPhp', '-500'],
    ['amountPhp', String(EVENT_COST_MAX_PHP + 1)],
    ['dueDate', '31/12/2026'],
    ['note', 'x'.repeat(1000)],
    ['supplierName', 'x'.repeat(500)],
  ] as const) {
    const r = draft({ [field]: value });
    assert.equal(r.ok, false, `${field}=${String(value).slice(0, 20)} was accepted`);
    assert.ok(
      !r.ok && r.error.length > 0 && !/undefined|null|Error:/.test(r.error),
      `${field} produced an unhelpful message: ${r.ok ? '' : r.error}`,
    );
  }
});

test('BA7 · the amount parser takes what the budget setter above it takes', () => {
  // A couple who has just used the target setter types the same way here.
  assert.equal(parseCostAmountPhp('₱ 680,000'), 680000);
  assert.equal(parseCostAmountPhp('1,500,000.50'), 1500000.5);
  assert.equal(parseCostAmountPhp('40000'), 40000);
  assert.equal(parseCostAmountPhp(''), null);
  assert.equal(parseCostAmountPhp('-1'), null);
  assert.equal(parseCostAmountPhp(undefined), null);
});

test('BA7 · the category ids ARE plan-group ids, so a cost lands on an existing row', () => {
  // The whole reason a cost filed here shows up on BA3's ledger row instead of
  // opening a second row beside it: one namespace, no join table.
  const options = costCategoryOptions('wedding');
  assert.ok(options.length > 10, 'the category list is suspiciously short');
  for (const o of options) {
    assert.equal(isCostCategoryId(o.id), true, `${o.id} is not a valid bucket id`);
    assert.ok(o.label.length > 0, `${o.id} has no label`);
  }
  assert.equal(options.at(-1)!.id, OTHER_BUCKET, '"Other" must be last — it is the fallback');
  assert.equal(isCostCategoryId('not_a_group'), false);

  // And every one maps to a REAL vendor category, so the supplier fork can
  // always stamp the event_vendors row it creates.
  const cats = new Set<string>(VENDOR_CATEGORIES as readonly string[]);
  for (const o of options) {
    assert.ok(
      cats.has(vendorCategoryForCostCategory(o.id)),
      `${o.id} maps to a category the enum does not have`,
    );
  }
});

// ── 2 · SOURCE ───────────────────────────────────────────────────────────────

test('BA7 · naming a supplier saves it LOCKED and mirrors it into the Merkado', () => {
  // Owner, 2026-09-02: "if they add a budget it means it is automatically
  // locked. and it will automatically be on the marketplace as well."
  const src = code(ACTIONS);
  assert.equal(
    count(src, /status:\s*'contracted'/g),
    1,
    "the supplier fork must insert event_vendors at 'contracted' — exactly once",
  );
  assert.match(
    src,
    /\.from\('event_vendors'\)\s*\.insert\(/,
    'the supplier fork no longer creates the Merkado row',
  );
  // The cost hangs off THAT row through the shipped tables, so one peso has
  // one home and the counting law holds without anyone remembering it.
  assert.match(src, /\.from\('event_vendor_line_items'\)\s*\.insert\(/);
  assert.match(src, /covers_plan_groups:\s*\[draft\.planGroupId\]/);
});

test('BA7 · the QR is a RENDER of the existing claim link, not new plumbing', () => {
  const src = code(ACTIONS);
  for (const symbol of ['ensureAutoShareInvite', 'buildClaimUrl', 'renderUrlQrSvg']) {
    assert.ok(src.includes(symbol), `${symbol} is no longer what mints the invite`);
  }
  // ⛔ No second token generator, no second URL speller, no second QR options
  // block. Each of those would be a parallel copy of a shipped mechanism, and
  // the two copies would drift.
  assert.equal(count(src, /generateClaimToken|crypto\.randomUUID|randomBytes/g), 0);
  assert.equal(count(src, /vendor\/claim\//g), 0, 'the claim URL is spelled in buildClaimUrl');
  assert.equal(count(src, /from 'qrcode'|require\('qrcode'\)/g), 0);
});

test('BA7 · the supplier-less path creates NO supplier and NO invite', () => {
  // Owner: "A cost with NO supplier named is just recorded." The two writes
  // that must not happen are the ones a well-meaning refactor would add.
  const src = code(ACTIONS);
  assert.match(src, /\.from\('event_costs'\)\s*\.insert\(/);
  // Both the vendor insert and the invite live inside the fork, so each
  // appears exactly once in the file — a second occurrence would mean one of
  // them escaped into the shared path.
  assert.equal(count(src, /\.from\('event_vendors'\)\s*\.insert\(/g), 1);
  assert.equal(count(src, /ensureAutoShareInvite\(/g), 1);
  // The fork itself, and it is the SUPPLIER NAME that decides — not a status,
  // not a category, not a flag.
  assert.match(src, /if\s*\(draft\.supplierName\)/);
});

test('BA7 · a failed line-item write does not leave a supplier nobody added', () => {
  // Half a save is worse than none: the couple would find a booked supplier on
  // their Merkado they never chose to add, carrying no money.
  const src = code(ACTIONS);
  assert.match(
    src,
    /\.from\('event_vendors'\)\s*\.delete\(\)\s*\.eq\('vendor_id',\s*eventVendorId\)/,
    'the line-item failure path no longer rolls the supplier back',
  );
});

// ── 3 · COPY ─────────────────────────────────────────────────────────────────

test('BA7 · the page no longer tells a couple to invent a supplier first', () => {
  const src = readFileSync(resolve(WEB, PAGE), 'utf8');
  // The literal sentence, and the instruction it carried. Checked against the
  // RAW file, not the stripped one, on purpose: the old copy is quoted inside
  // this PR's own docblock explaining why it went, and that quotation is the
  // record. What must not come back is the RENDERED string.
  const stripped = stripComments(src);
  assert.equal(
    /Add a vendor first/.test(stripped),
    false,
    'the dead-end empty state is back in rendered copy',
  );
  assert.ok(
    src.includes('Add a vendor first'),
    'the docblock that records what this replaced has been deleted',
  );
  // And the section that replaced it is actually mounted.
  assert.match(stripped, /<CostsWithNoSupplier\b/);
});

test('BA7 · the recorded list comes from the resolver, not a second read', () => {
  // Two mechanisms that can disagree about one fact is the defect. The page
  // derives its list from `money.lines`; a second `.from('event_costs')` here
  // would be a query that can succeed while the resolver's fails, printing a
  // list beside totals that do not include it.
  const src = code(PAGE);
  assert.equal(count(src, /from\('event_costs'\)/g), 0);
  assert.match(src, /source === 'event_cost'/);
  // ...and a resolver refusal is SAID, not rendered as an empty list. An
  // absence that looks identical to "you have none" is the disease this whole
  // stream is named after.
  assert.match(src, /costsUnavailable/);
});
