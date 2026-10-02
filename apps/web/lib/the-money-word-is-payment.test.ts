/**
 * ⚖ Owner tracker d22 (2026-10-02, first-timer test fix 3 + 17): **one money word —
 * "payment"**. "deposit", "downpayment" and "installment" retire in the UI ("first
 * payment" where the order matters); the supplier's page is "Money in", not "Payday".
 *
 * 🔑 THE PROPERTY: no word a person reads says deposit / downpayment / installment,
 * outside the reasoned allowlist: public blog articles (where "deposit" is the word the
 * whole market uses), staff screens, the DPO's registers, and one stamp the database
 * itself matches. Identifiers (`deposit_paid`, `is_downpayment`, `/payday`) stay.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { RetiredName } from './retired-names-scan';
import { allowlistProblems, scanSource, scanTree, type WordAllow } from './retired-word-guard';

const NAMES: readonly RetiredName[] = [
  { was: 'deposit', now: 'payment', pattern: 'deposit|down[- ]?payment|installment' },
  { was: 'Payday', now: 'Money in', pattern: 'payday', caseSensitive: false },
];

const ALLOW: readonly WordAllow[] = [
  { prefix: 'lib/blog', why: 'public blog articles — "deposit" is the word couples search for; a separate SEO pass' },
  { prefix: 'app/admin/', why: 'the staff console (the disputes and force-majeure desks)' },
  { prefix: 'lib/erasure/', why: 'the DPO’s erasure register (legal text)' },
  { prefix: 'lib/ugat/', why: 'the staff Root map’s own vocabulary' },
  {
    prefix: 'app/dashboard/[eventId]/vendors/actions.ts',
    text: /awaiting vendor confirmation/,
    why: 'the payment stamp note — the deposit trigger matches it exactly (NEW.notes IN (…)), so the word changes with a migration, not here',
  },
];

test('the scanner flags the retired money words where a person reads them', () => {
  const visible = [
    ['a.tsx', `export const A = () => <p>Pay your deposit</p>;`],
    ['b.ts', `export const t = 'Downpayment received';`],
    ['c.ts', "export const t = (n: string) => `Second installment for ${n}`;"],
    ['d.tsx', `export const D = () => <h1>Payday</h1>;`],
    ['e.ts', `export const t = { label: 'Earnings & payday' };`],
  ] as const;
  for (const [f, s] of visible) assert.ok(scanSource(f, s, NAMES).length >= 1, `missed a visible word in: ${s}`);
});

test('the scanner leaves identifiers, columns, routes and comments alone', () => {
  const code = [
    `export const s = 'deposit_paid';`,
    `export const q = 'event_id, is_downpayment, due_date';`,
    `export const r = '/vendor-dashboard/payday';`,
    `import { x } from '@/lib/vendor-payday-read';`,
    `// the deposit trigger, in a comment`,
    `export const k = { kind: 'downpayment' };`,
    `export const log = () => console.warn('payday read refused');`,
  ];
  for (const s of code) assert.deepEqual(scanSource('x.tsx', s, NAMES), [], `flagged code as copy: ${s}`);
});

test('no screen a couple or a supplier reads says deposit / downpayment / installment / Payday', () => {
  const r = scanTree(NAMES, ALLOW, new Set(['lib/the-money-word-is-payment.test.ts']));
  console.log(`[money-word] ${r.scanned} files · ${r.findings.length} findings · ${r.excused} excused`);
  assert.ok(r.scanned > 1000, `walked only ${r.scanned} files — the walk is broken`);
  assert.ok(r.excused > 10, 'the allowlist matched almost nothing — the scan is not reading the tree');
  assert.deepEqual(
    r.findings,
    [],
    'Say "payment" ("first payment" where the order matters), and "Money in" for the page (owner d22). ' +
      'Change the WORD, never the identifier:\n  ' + r.findings.join('\n  '),
  );
});

test('every allowlist row is real, reasoned and still needed', () => {
  assert.deepEqual(allowlistProblems(ALLOW, scanTree(NAMES, ALLOW).used), []);
});
