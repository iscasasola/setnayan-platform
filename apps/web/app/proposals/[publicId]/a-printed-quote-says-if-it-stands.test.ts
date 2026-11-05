/**
 * a-printed-quote-says-if-it-stands.test.ts — the proposal letterhead on paper (coordinator walk, 2026-10-23).
 *
 *   ⓵ The status badge lives in the bar print hides, so a DECLINED, EXPIRED or SUPERSEDED quote (or a draft) printed
 *      exactly like a live offer. Such a quote now carries one line on paper saying it no longer stands.
 *   ⓶ A row of the quote — a line item, an instalment, a way to pay — never splits across two pages.
 *   ⓷ A long shop name, title or line label wraps instead of pushing the price off a 375 px screen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PROPOSAL_STATUS_LABEL, proposalPaperStatus, type ProposalStatus } from '@/lib/vendor-proposals';

const PAGE = stripComments(readFileSync(join(__dirname, 'page.tsx'), 'utf8'));

test('⓵ every status that is not a live offer says so on paper; a live or accepted one says nothing', () => {
  const statuses = Object.keys(PROPOSAL_STATUS_LABEL) as ProposalStatus[];
  const live = new Set<ProposalStatus>(['sent', 'viewed', 'accepted']);
  for (const s of statuses) {
    if (live.has(s)) assert.equal(proposalPaperStatus(s), null, `a ${s} quote prints a "no longer stands" line`);
    else assert.ok(proposalPaperStatus(s), `a ${s} quote prints like a live offer`);
  }
  assert.match(proposalPaperStatus('declined') ?? '', /^Declined/);

  // The line is in the LETTERHEAD (which prints), shown only on paper — never inside the print:hidden bar.
  const header = PAGE.slice(PAGE.indexOf('<header'), PAGE.indexOf('</header>'));
  assert.match(header, /\{paperStatus\s*\?\s*\(\s*<p[^>]*\bhidden\b[^>]*\bprint:block\b/, 'the paper status line left the letterhead');
  assert.match(PAGE, /const paperStatus = proposalPaperStatus\(proposal\.status\)/);
});

test('⓶ no row of the quote splits across a page break', () => {
  const rows = PAGE.match(/<li\b[^>]*>/g) ?? [];
  assert.ok(rows.length >= 3, 'the quote lost its rows — re-point this guard');
  for (const li of rows) assert.match(li, /print:break-inside-avoid/, `a row can split across pages: ${li}`);
});

test('⓷ a long name, title or label wraps; the price and logo keep their size', () => {
  const header = PAGE.slice(PAGE.indexOf('<header'), PAGE.indexOf('</header>'));
  assert.match(header, /<img[^>]*className="[^"]*\bshrink-0\b/, 'the logo can be squeezed');
  assert.match(header, /<div className="min-w-0">\s*<p className="[^"]*\bbreak-words\b[^"]*">\{businessName\}/);
  assert.match(header, /<h1 className="[^"]*\bbreak-words\b/);
  assert.match(PAGE, /<span className="shrink-0 text-sm tabular-nums text-ink\/70">/, 'a line item price can be squeezed');
});
