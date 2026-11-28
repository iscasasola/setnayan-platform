/**
 * 🔒 "FREE TO START" LEAVES EVERY MARKETING LINE — owner, 27 Nov 2026 ("yes to all" on the L4 calls, relayed by the
 * ship controller). brand.md bans price promises; "Free to start" (and "Free to stay") read as one. Planning IS free,
 * so a line that needs to say it says "Planning is free".
 *
 * Held across the public pages, the feature pages, the SEO answers and the sign-up meta. The in-app Studio chips in
 * `lib/add-ons-catalog.ts` (`freeTrial`) are product state, not marketing, and are left for the owner.
 * The four lines OLD-L4 (#8423) removes are named in PENDING_L4 until it lands; delete them from the list then.
 *
 * 🛡 SABOTAGE (seen RED, then restored): "Free to start." typed back onto the end of /for-coordinators' meta line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();

/** Removed by OLD-L4 (#8423 → #8430). Delete each line once that ships. */
const PENDING_L4 = new Set([
  'app/_components/marketing/plan-buy-cta.tsx',
  'app/onboarding/wedding/page.tsx',
  'app/onboarding/[type]/page.tsx',
  'app/dashboard/(launcher)/_components/unihome.tsx',
]);
/** Not marketing: an in-app chip whose wording is the owner's call. */
const NOT_MARKETING = new Set(['lib/add-ons-catalog.ts']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.lab\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

test('no marketing line says "Free to start" or "Free to stay"', () => {
  const bad: string[] = [];
  for (const root of ['app', 'components', 'lib']) {
    for (const f of walk(join(WEB, root))) {
      const rel = relative(WEB, f);
      if (PENDING_L4.has(rel) || NOT_MARKETING.has(rel)) continue;
      if (/free to (start|stay)/i.test(stripComments(readFileSync(f, 'utf8')))) bad.push(rel);
    }
  }
  assert.deepEqual(bad, [], `"Free to start" is back in: ${bad.join(', ')}`);
});
