/**
 * the-toolkit-claim-is-true.test.ts — the Toolkit's count on /for-suppliers is a count, not a slogan.
 *
 * Owner, 23 Nov 2026: "put 390+ tools and templates on /for-suppliers" (first drafted in closed #8249), then "Should be
 * adaptive to a rounded off number. So when we add a toolkit, it adapts to itself". So the page's words are
 * `toolkitClaim(toolkitTotal(cardTemplates))` (lib/supplier-toolkit-count.ts), never a typed number, and this file runs
 * THAT reader on the seeded card templates:
 *   · the honest total (each item once) is at least `TOOLKIT_CLAIM_FLOOR` (390);
 *   · one more template moves the total, and the words follow the rounding rule (down to the nearest 10, then "+");
 *   · the page shows the one reader's words once, draws no second total, and never calls the set "free".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { TOOLKIT_CLAIM_FLOOR, toolkitClaim, toolkitCodeParts, toolkitTotal } from '@/lib/supplier-toolkit-count';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

/** The seeded starting card templates: one VALUES row each, in every migration that seeds `service_included_templates`. */
function seededCardTemplates(): number {
  let rows = 0;
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    const seed = sql.match(/INSERT INTO public\.service_included_templates[\s\S]*?FROM \(VALUES\n([\s\S]*?)\n\s*\) AS v\(/);
    if (seed) rows += (seed[1] ?? '').split('\n').filter((l) => /^\s*\('/.test(l)).length;
  }
  return rows;
}

test('the honest total (seeded templates + what the code ships, each once) is at least 390', () => {
  const templates = seededCardTemplates();
  assert.ok(templates >= 300, `the card-template seed is still read (found ${templates})`);
  const total = toolkitTotal(templates);
  assert.ok(total !== null && total >= TOOLKIT_CLAIM_FLOOR, `the count needs ${TOOLKIT_CLAIM_FLOOR}; the code ships ${total}: ${JSON.stringify({ templates, ...toolkitCodeParts() })}`);
  assert.ok(toolkitClaim(total)!.startsWith(`${Math.floor(total! / 10) * 10}+`));
});

test('it adapts: one more template moves the total, and the words round DOWN to the nearest 10', () => {
  const t = seededCardTemplates();
  assert.equal(toolkitTotal(t + 1), toolkitTotal(t)! + 1, 'adding a template does not move the total');
  assert.equal(toolkitClaim(394), '390+ tools and templates');
  assert.equal(toolkitClaim(399), '390+ tools and templates', 'rounded up');
  assert.equal(toolkitClaim(400), '400+ tools and templates');
  assert.equal(toolkitClaim(401), '400+ tools and templates');
  // an unread template count draws no number — never 0+, never a guess
  assert.equal(toolkitTotal(null), null);
  assert.equal(toolkitClaim(null), null);
  assert.equal(toolkitClaim(toolkitTotal(null)), null);
});

test('/for-suppliers shows the one reader’s words once, no second total, and never calls the set free', () => {
  const page = stripComments(readFileSync(join(HERE, '_components', 'supplier-front-page.tsx'), 'utf8'));
  const client = stripComments(readFileSync(join(HERE, '_components', 'supplier-front-client.tsx'), 'utf8'));
  const route = stripComments(readFileSync(join(WEB, 'app', '(shell)', 'for-suppliers', 'page.tsx'), 'utf8'));
  assert.match(page, /const claim = toolkitClaim\(toolkitTotal\(cardTemplates\)\);/);
  assert.equal(page.split('<ToolkitCount ').length - 1, 1, 'the Toolkit count is drawn more than once');
  assert.match(route, /readCardTemplateCount\(admin\)/, 'the route does not read the live template count');
  assert.doesNotMatch(page + client, /\d{2,}\+ tools|TOOLKIT_CLAIM\b/, 'a typed count beside the claim');
  assert.doesNotMatch(page + client, /toolkitCountWords|toolkitCounts|toolkitCountLine/, 'a second Toolkit total is drawn');
  assert.match(client, /<span className=\{s\.num\}>\{claim\}<\/span>, ready to use\./);
  assert.doesNotMatch(client, /\{claim\}[^<]*\bfree\b/i, 'the claim line does not say free');
});
