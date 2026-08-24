/**
 * subscriptions-speaks-no-dead-currency.test.ts — the money desk stops
 * promising something the database refuses to do.
 *
 * ── WHAT WAS WRONG, MEASURED IN PRODUCTION ────────────────────────────────
 * The vendor token currency was retired product-wide on 2026-08-07 (owner lock
 * 2026-07-21: *"token can retire, there should be nothing that needs token any
 * more"*). Production has never seen one bought or spent.
 *
 * `/admin/subscriptions` went on saying otherwise for seventeen days. Its lede
 * told an operator that pressing Confirm activated the tier AND handed the
 * vendor a bundle of the old currency; `actions.ts` said the approve path did
 * it by calling `grant_admin_direct_tokens`. (The exact old wording is not
 * reproduced anywhere in this directory — rule 5 bans it on RAW source, and a
 * guard that quotes the string it bans is a guard that fails on itself.)
 *
 * Both were false, and this was read out of the live database rather than
 * inferred from a migration:
 *
 *   approve_vendor_subscription(p_purchase_id uuid)
 *     └─ _apply_subscription_credit(...), whose live body says, in its own
 *        words: "The token bundle and the add-on credit were REMOVED here
 *        (2026-08-07). Activating a plan now activates a plan. Nothing else."
 *        …and returns `bundle: 0`, `addon_tokens: 0` as constants.
 *
 * 🔑 `grant_admin_direct_tokens` IS STILL IN PRODUCTION — and that is exactly
 * why the sentence survived being read. A named function that still exists
 * makes a claim about it look checkable and true. **A named function is not a
 * call site.** Its one remaining caller in the database is
 * `redeem_vendor_token_voucher`; the subscription path is not one.
 *
 * 🔑 AND THE PILL COULD NEVER HAVE RENDERED, WHICH IS WHY NOBODY CAUGHT IT.
 * "incl. N tokens" was gated on `addon_token_count > 0`. The only writer of
 * that column, `create_vendor_subscription`, prices an add-on from
 * `vendor_billing_catalog WHERE offering_type = 'token_pack' AND is_active =
 * TRUE` — and all six of those rows are inactive. A dead branch sitting over a
 * false sentence: the screen made a claim, and the one element that could have
 * contradicted it on screen was unreachable.
 *
 * ── WHAT IS DELIBERATELY NOT DONE HERE ────────────────────────────────────
 * ⛔ The COLUMNS stay. `addon_token_count` and `addon_amount_php` are no longer
 * read by this page — and this page was their only reader in the whole repo —
 * but their writer is live and still populates them. They are unread, not
 * orphaned. Dropping a column is a migration and a separate decision.
 *
 * ⛔ Prices, SKUs and the tier ladder are untouched.
 *
 * 🔴 AND ONE RISK IS NAMED RATHER THAN FIXED, BECAUSE THE FIX IS OUT OF THIS
 * SESSION'S TERRITORY. The CHARGE path and the GRANT path were retired at
 * different layers. `create_vendor_subscription` still carries the whole
 * add-on machinery — it will price a token pack, fold it into `amount_php` and
 * store the count — while `_apply_subscription_credit` no longer grants
 * anything. **The only thing standing between a vendor and being charged for
 * tokens nobody will hand them is `is_active = FALSE` on six catalog rows.**
 * Re-activating one is exactly the kind of tidy-up somebody does while cleaning
 * a catalog. That belongs in the SQL, not on this screen.
 *
 * 🛡 EVERY ASSERTION HERE WAS MUTATION-CHECKED AND THE MUTATION MEASURED — the
 * guarded thing broken on purpose, the OCCURRENCE COUNT printed before → after
 * to prove the sabotage landed, and the test confirmed RED before being
 * trusted. An unmeasured mutation proves nothing in either direction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Blank comments out, keeping line numbers.
 *
 * 🔑 LOAD-BEARING HERE, NOT COSMETIC. Both files now carry a long note about
 * the currency they stopped naming, so the WORD appears in this directory more
 * often than before the fix. A guard reading raw source would find the defect
 * inside the sentence announcing its own removal and report work that is
 * already done.
 *
 * ⚠ BUT STRIPPING COMMENTS IS EXACTLY WRONG FOR ONE OF THESE DEFECTS, AND THE
 * MUTATION RUN IS WHAT SHOWED IT. The original lie in `actions.ts` was ONLY
 * ever a docblock — a comment. A comment-stripped rule can never see it, so
 * re-asserting the false claim in that docblock left this file GREEN
 * (measured: occurrences 2 → 3, exit 0). Rule 5 below therefore reads the RAW
 * source and bans the CLAIM PHRASES rather than the word, which is only
 * possible because neither file quotes them any more.
 */
const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => (l.trimStart().startsWith('//') ? '' : l))
    .join('\n');

const read = (rel: string) => code(readFileSync(join(HERE, rel), 'utf8'));
const FILES = ['page.tsx', 'actions.ts'] as const;

const occurrences = (src: string, re: RegExp): number =>
  (src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? [])
    .length;

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE DESK SPEAKS NO DEAD CURRENCY
   ══════════════════════════════════════════════════════════════════════════ */

test('nothing on this desk says the word token in code a person can read', () => {
  const offenders: string[] = [];
  for (const rel of FILES) {
    const src = read(rel);
    src.split('\n').forEach((line, i) => {
      if (/\btokens?\b/i.test(line)) offenders.push(`${rel}:${i + 1} — ${line.trim()}`);
    });
  }
  assert.deepEqual(
    offenders,
    [],
    'The token currency was retired 2026-08-07 and the confirm path stopped ' +
      'granting the same day. A screen that still names it is telling an ' +
      `operator something the database will refuse to do. Offenders: ${offenders.join(' · ')}`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE POSITIVE HALF — the sentence still says what Confirm DOES
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Rule 1 is satisfied by deleting the sentence outright, which would take the
 * idempotency reassurance with it — and that reassurance is the reason the
 * lede was worth keeping at all. An operator whose press looks like it did
 * nothing needs to know a second press is safe.
 */
test('the lede still tells an operator what confirming actually does', () => {
  const src = read('page.tsx');
  assert.match(
    src,
    /activates the plan and nothing else/,
    'the replacement claim is the one the live function makes about itself: ' +
      'activating a plan activates a plan',
  );
  assert.match(
    src,
    /a\s+repeat is a no-op/,
    'and it keeps the idempotency reassurance the old sentence carried — ' +
      'without it, a press that looks like it did nothing invites a second ' +
      'guess rather than a second press',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE TWO COLUMNS ARE NOT READ HERE — AND ARE NOT DROPPED EITHER
   ══════════════════════════════════════════════════════════════════════════ */

test('the desk no longer selects the two add-on columns', () => {
  const offenders: string[] = [];
  for (const rel of FILES) {
    const n = occurrences(read(rel), /addon_(?:token_count|amount_php)/);
    if (n !== 0) offenders.push(`${rel} (${n})`);
  }
  assert.deepEqual(
    offenders,
    [],
    'This page was the ONLY reader of those columns in the repo. Reading a ' +
      'column to render a branch that cannot fire is how the false sentence ' +
      `above kept its cover. Offenders: ${offenders.join(', ')}`,
  );
});

/**
 * 🪤 THIS RULE WAS DECORATIVE ON ITS FIRST RUN AND ONLY THE MUTATION SAID SO.
 * It asked whether each column name appeared ANYWHERE in `page.tsx` — but every
 * one of them also appears in the row TYPE and again in the render, so deleting
 * `rejection_reason` from the SELECT still left two matches and the test passed
 * (measured: occurrences 4 → 3, exit 0). **A file-level match cannot tell you
 * which of three places a name is still in.** It now extracts the `COLS`
 * literal and checks THAT.
 */
function selectList(src: string): string {
  const m = src.match(/const COLS\s*=\s*\n?\s*'([^']+)'/);
  assert.ok(m, 'could not find the COLS select literal — the guard must read the real list, not the file');
  return m![1]!;
}

test('the select still asks for the columns the screen actually renders', () => {
  // ⚖ THE COUNTERWEIGHT TO RULE 3. Trimming a select is one keystroke away
  // from trimming a column the page needs — and a phantom column is REFUSED by
  // PostgREST, not thrown, so the whole read comes back null and the queue
  // renders as empty. That failure mode is this repo's most expensive one.
  const cols = selectList(read('page.tsx'));
  for (const col of [
    'purchase_id',
    'vendor_id',
    'sku_code',
    'tier',
    'billing_cycle',
    'amount_php',
    'reference_code',
    'status',
    'created_at',
    'paid_at',
    'expires_at',
    'rejection_reason',
  ]) {
    assert.ok(
      cols.split(',').map((c) => c.trim()).includes(col),
      `the SELECT dropped ${col}, which the rows still render`,
    );
  }
  assert.equal(
    cols.split(',').length,
    12,
    'exactly the twelve columns the screen renders — no more (a column read to ' +
      'feed a branch that cannot fire is how the false sentence kept its cover) ' +
      'and no fewer',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE CLAIM ABOUT THE RPC MATCHES THE RPC
   ══════════════════════════════════════════════════════════════════════════ */

test('the action does not claim a grant call it does not make', () => {
  const src = read('actions.ts');
  assert.equal(
    /grant_admin_direct_tokens/.test(src),
    false,
    'A NAMED FUNCTION IS NOT A CALL SITE. That function is still in ' +
      'production — which is precisely why this claim read as true — but the ' +
      'subscription path does not call it, and its only remaining caller is ' +
      'redeem_vendor_token_voucher.',
  );
  assert.match(
    src,
    /approve_vendor_subscription/,
    'the RPC this path DOES call must still be named, so the docblock stays ' +
      'checkable against the database rather than becoming vague',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · THE CLAIM ITSELF, BANNED ON RAW SOURCE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 🔑 THE ONE RULE THAT MUST *NOT* STRIP COMMENTS.
 *
 * The lie in `actions.ts` was never code. It was a docblock, and a docblock is
 * a comment — so every other rule in this file is structurally blind to it.
 * Proved by mutation: re-asserting the false claim in that docblock left this
 * file green.
 *
 * So this rule reads the RAW source and bans the three phrasings the claim ever
 * took. That is only possible because neither file quotes them any more — both
 * corrections paraphrase on purpose, and say so where they do it. A guard that
 * quotes the string it bans is a guard that fails on itself.
 */
const RETIRED_CLAIMS = [
  /grants the bundled tokens/i,
  /grants the token bundle/i,
  /token bundle is granted/i,
];

test('no docblock re-asserts a grant this path does not make', () => {
  const offenders: string[] = [];
  for (const rel of FILES) {
    const raw = readFileSync(join(HERE, rel), 'utf8'); // RAW — comments included
    for (const claim of RETIRED_CLAIMS) {
      if (claim.test(raw)) offenders.push(`${rel} — ${claim.source}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A docblock is where this defect lived for seventeen days, and every other ' +
      'rule here strips comments before matching. Describe what the path does ' +
      `now; do not restate what it stopped doing. Offenders: ${offenders.join(' · ')}`,
  );
});
