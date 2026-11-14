/**
 * template-score-ratchet.test.ts — NO PAGE MAY BREAK THE DESIGN TEMPLATE MORE THAN IT DOES TODAY.
 *
 * Owner-approved plan, 14 Nov 2026 ("how do we reach 0%"): (1) a CI guard so scores can only go down and
 * new pages start at 0 · (2) fix shared pieces first · (3) an explicit exempt list · (4) the rest in batches.
 * This file is (1); `TEMPLATE_EXEMPT` in `lib/template-score.ts` is (3). The method is the 14 Nov audit's
 * (corpus `prototypes/design_template_audit_2026-11-14.md`), documented in `lib/template-score.ts`.
 *
 * It fails when:
 *   • a page in `lib/template-score.baseline.json` scores HIGHER than its baseline;
 *   • a page NOT in the baseline scores above 0 (new pages start clean);
 *   • the baseline is not sorted, holds a page that no longer exists or is exempt, or holds a 0;
 *   • an exempt entry matches no page (a stale exemption hides nothing and must go);
 *   • the counting patterns stop counting (self-check on known snippets — an inert pattern is a green
 *     guard checking nothing).
 * When a page's score goes DOWN it prints a reminder: run
 *     pnpm --filter @setnayan/web template-score --write
 * which only ever LOWERS the baseline.
 *
 * Sabotage (proved red in the PR that added it): add one `bg-[#123456]` to a baselined page; add a new
 * page.tsx holding one `sn-card`. Both failed; both reverted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  APP_DIR,
  TEMPLATE_EXEMPT,
  areaTotals,
  countSource,
  readTemplateBaseline,
  scoreAllPages,
  scoreOf,
} from '@/lib/template-score';

const rows = scoreAllPages();
const baseline = readTemplateBaseline();

test('the counting patterns still count (self-check)', () => {
  const k = countSource(
    [
      `<p className="x">${'word '.repeat(30)}</p>`,
      '<div className="sn-card">',
      '<div className="sn-tile"><p>No guests yet</p></div>',
      '<button className="rounded-full bg-terracotta px-4">Go</button>',
      '<Link href="/" className="bg-mulberry text-white">Go</Link>',
      '<div className="bg-[#123456]" />',
      '<span className="font-mono uppercase">Label</span>',
      '<select name="x"></select>',
    ].join('\n'),
  );
  assert.deepEqual(k, { longP: 1, cards: 2, handBtn: 2, hex: 1, mono: 1, emptyCard: 1, select: 1 });
  assert.equal(scoreOf(k), 2 + 2 + 4 + 1 + 1 + 2 + 2);
});

test('it scores real pages (not an empty walk)', () => {
  assert.ok(rows.length > 300, `only ${rows.length} pages scored — the walk is broken`);
  const totals = areaTotals(rows);
  console.log(
    'template score by area: ' +
      Object.entries(totals)
        .map(([a, t]) => `${a} ${t.score} (${t.breaking}/${t.pages} pages breaking)`)
        .join(' · '),
  );
});

test('no page breaks the template more than its baseline; new pages start at 0', () => {
  const rose: string[] = [];
  const fresh: string[] = [];
  const fell: string[] = [];
  for (const r of rows) {
    const b = baseline[r.page];
    if (b === undefined) {
      if (r.score > 0) fresh.push(`${r.page}: ${r.score} ${JSON.stringify(r.counts)}`);
    } else if (r.score > b) {
      rose.push(`${r.page}: ${b} → ${r.score} ${JSON.stringify(r.counts)}`);
    } else if (r.score < b) {
      fell.push(`${r.page}: ${b} → ${r.score}`);
    }
  }
  if (fell.length) {
    console.log(
      `\n🎉 ${fell.length} page(s) now break the template LESS than the baseline — lower it in this PR:\n` +
        '    pnpm --filter @setnayan/web template-score --write\n  ' +
        fell.join('\n  '),
    );
  }
  const help =
    '\nUse the shared pieces the template sheet already uses: rows on white instead of cards, ActionButton ' +
    'instead of a hand-made button, a colour token instead of a hex, PickMenu instead of <select>, InfoTip ' +
    'instead of a long paragraph, plain section labels instead of font-mono uppercase. The baseline may only go DOWN.';
  const faults = [
    ...(rose.length ? [`page(s) now break the design template MORE than the baseline:\n  ${rose.join('\n  ')}`] : []),
    ...(fresh.length ? [`new page(s) must start at 0 but break the design template:\n  ${fresh.join('\n  ')}`] : []),
  ];
  assert.ok(faults.length === 0, `${faults.join('\n')}${help}`);
});

test('the baseline is sorted, live, non-zero and never names an exempt page', () => {
  const keys = Object.keys(baseline);
  assert.deepEqual(keys, [...keys].sort(), 'baseline must be sorted by path — regenerate with template-score --write');
  const scored = new Set(rows.map((r) => r.page));
  const dead = keys.filter((k) => !scored.has(k));
  assert.deepEqual(dead, [], `baseline names pages that are gone or exempt — run template-score --write:\n  ${dead.join('\n  ')}`);
  const zero = keys.filter((k) => !((baseline[k] ?? 0) > 0));
  assert.deepEqual(zero, [], 'baseline entries must be > 0 (a clean page simply leaves the file)');
});

test('every exemption still matches a page, and carries a reason', () => {
  const pages: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'page.tsx') pages.push(path.relative(APP_DIR, d).split(path.sep).join('/'));
    }
  };
  walk(APP_DIR);
  const stale = TEMPLATE_EXEMPT.filter((e) =>
    e.match.endsWith('/') ? !pages.some((p) => p.startsWith(e.match)) : !pages.includes(e.match),
  ).map((e) => e.match);
  // `dev/` holds no pages today; it stays listed so lab pages added there are not scored.
  assert.deepEqual(stale.filter((m) => m !== 'dev/'), [], `exemptions that match no page — remove them:\n  ${stale.join('\n  ')}`);
  for (const e of TEMPLATE_EXEMPT) assert.ok(e.reason.trim().length > 0, `exemption ${e.match} has no reason`);
});
