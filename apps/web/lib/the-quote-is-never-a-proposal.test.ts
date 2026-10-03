/**
 * ⚖ Owner tracker d21 (2026-10-02, first-timer test fix 8): **"quote" everywhere;
 * "proposal" retires** — "See the quote", "Accept quote", "Send this quote", and the
 * /proposals page title is "Quotes" (the route and `vendor_proposals` stay).
 *
 * 🔑 THE PROPERTY: no word a person reads says "proposal", couple side or supplier
 * side, outside the reasoned allowlist: a marriage proposal is a real thing a couple
 * writes about, and staff screens, the legal register and a machine-readable summary
 * are not words a couple or a supplier reads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { RetiredName } from './retired-names-scan';
import { allowlistProblems, scanSource, scanTree, type WordAllow } from './retired-word-guard';

const NAMES: readonly RetiredName[] = [{ was: 'proposal', now: 'quote', pattern: 'proposal' }];

const ALLOW: readonly WordAllow[] = [
  { prefix: 'app/[slug]/_components/editorial/data.ts', why: 'sample story chapters: "The proposal" is the couple’s marriage proposal' },
  { prefix: 'app/_components/app-store/studio-card-demo.tsx', why: 'a demo story chapter — the marriage proposal' },
  { prefix: 'app/dashboard/[eventId]/studio/papic/_components/add-to-library.tsx', why: '"the proposal clip" — a marriage proposal in a couple’s old photos' },
  { prefix: 'app/onboarding/wedding/_components/', why: 'the "The proposal" story chapter a couple fills in — the marriage proposal' },
  { prefix: 'lib/onboarding/specialty-catalog.ts', why: 'a story chapter named "The proposal" — the marriage proposal' },
  { prefix: 'lib/invitation-widgets.ts', why: '"How you met, the proposal, and your milestones" — the couple’s story' },
  { prefix: 'lib/pakanta-brief.ts', why: 'the song brief asks about the marriage proposal' },
  { prefix: 'lib/blog', why: 'public blog articles about marriage proposals — a separate SEO pass' },
  { prefix: 'lib/category-proposal-draft.ts', why: 'an AI prompt about proposing a new supplier trade — never rendered' },
  { prefix: 'lib/llms-txt.ts', why: 'the machine-readable site summary for crawlers' },
  { prefix: 'app/admin/', why: 'the staff console (partnership proposals between suppliers)' },
  { prefix: 'lib/ugat/', why: 'the staff Root map’s own vocabulary' },
  { prefix: 'lib/erasure/', why: 'the DPO’s erasure register (legal text)' },
];

test('the scanner flags "proposal" where a person reads it', () => {
  const visible = [
    ['a.tsx', `export const A = () => <h1>Proposals</h1>;`],
    ['b.ts', `export const t = 'Accept proposal';`],
    ['c.ts', "export const t = (n: string) => `Send a proposal to ${n}`;"],
    ['d.tsx', `export const D = () => <button aria-label="View proposal" />;`],
    ['e.ts', `export const t = { label: 'Proposal' };`],
  ] as const;
  for (const [f, s] of visible) assert.ok(scanSource(f, s, NAMES).length >= 1, `missed a visible word in: ${s}`);
});

test('the scanner leaves identifiers, tables, routes and comments alone', () => {
  const code = [
    `export const t = 'vendor_proposals';`,
    `export const s = 'proposal_id, public_id, status';`,
    `export const r = '/proposals/abc';`,
    `import { x } from '@/lib/vendor-proposals';`,
    `// a proposal in a comment`,
    `export const k = { proposal_sent: 1 };`,
    `export const log = () => console.error('[proposals] read refused');`,
  ];
  for (const s of code) assert.deepEqual(scanSource('x.tsx', s, NAMES), [], `flagged code as copy: ${s}`);
});

test('no screen a couple or a supplier reads says "proposal"', () => {
  const r = scanTree(NAMES, ALLOW, new Set(['lib/the-quote-is-never-a-proposal.test.ts']));
  console.log(`[proposal] ${r.scanned} files · ${r.findings.length} findings · ${r.excused} excused`);
  assert.ok(r.scanned > 1000, `walked only ${r.scanned} files — the walk is broken`);
  assert.ok(r.excused > 10, 'the allowlist matched almost nothing — the scan is not reading the tree');
  assert.deepEqual(
    r.findings,
    [],
    'Say "quote", never "proposal" (owner d21). Change the WORD, never the identifier — or, if it is a ' +
      'marriage proposal or staff text, add it to ALLOW with its reason:\n  ' + r.findings.join('\n  '),
  );
});

test('every allowlist row is real, reasoned and still needed', () => {
  assert.deepEqual(allowlistProblems(ALLOW, scanTree(NAMES, ALLOW).used), []);
});
