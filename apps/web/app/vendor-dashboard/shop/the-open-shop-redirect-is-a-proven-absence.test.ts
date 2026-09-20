/**
 * /open-shop IS REACHABLE ONLY FROM A PROVEN ABSENCE.
 *
 * `/open-shop` is the brand-new-shop wizard. Sending a supplier there who
 * ALREADY has a shop invites them to create a second one over the top of the
 * first — so the redirect is safe only downstream of a read that SUCCEEDED
 * and found nothing, never downstream of a read that merely failed to say.
 *
 * `lib/shop-presence.test.ts` executes that decision. This file guards the
 * wiring around it: that no second, unguarded redirect to the wizard appears,
 * that the `'no-vendor'` sentinel is only ever produced from the
 * proven-absence branch, and that the membership read feeding it still keeps
 * its error instead of destructuring it away.
 *
 * Every occurrence is scanned and every count is FLOORED — a guard that finds
 * nothing must go red, not green (repo memory: "a zero from a harness is not
 * evidence"; "print what you searched").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SHOP_PAGE = 'app/vendor-dashboard/shop/page.tsx';
const VENDOR_PROFILE = 'lib/vendor-profile.ts';

/**
 * A comment is not code. Without this, a docblock that QUOTES the shape it
 * warns about convicts the very file that fixed it — the failure mode the repo
 * records as "a phrasing ban fails in both directions".
 */
const isComment = (text: string) => /^(\/\/|\/\*|\*)/.test(text.trim());

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
  };
  walk(root);
  return out;
}

/**
 * Every `redirect(...)` whose target is the /open-shop WIZARD ROOT, outside
 * the wizard's own folder (inside it, `redirect('/open-shop?step=…&error=…')`
 * is the wizard re-rendering its own step and is not a doorway at all).
 */
function openShopRedirectSites(): Array<{ file: string; line: number; text: string }> {
  const sites: Array<{ file: string; line: number; text: string }> = [];
  for (const file of [...sourceFiles('app'), ...sourceFiles('lib')]) {
    if (file.startsWith(join('app', 'open-shop'))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      if (isComment(text)) return;
      if (/redirect\(\s*['"`]\/open-shop['"`]\s*\)/.test(text)) {
        sites.push({ file, line: i + 1, text: text.trim() });
      }
    });
  }
  return sites;
}

test('every /open-shop redirect is guarded by the proven-absence sentinel', () => {
  const sites = openShopRedirectSites();
  // eslint-disable-next-line no-console
  console.log(`[guard] /open-shop redirect sites scanned: ${sites.length}`);
  // FLOOR: the redirect exists today. A zero here means the scan broke, not
  // that the app is safe.
  assert.ok(
    sites.length >= 1,
    'found NO redirect to /open-shop — the scan is broken, or the doorway moved and this guard now proves nothing',
  );
  for (const site of sites) {
    assert.match(
      site.text,
      /===\s*['"`]no-vendor['"`]/,
      `${site.file}:${site.line} redirects to /open-shop without testing the proven-absence sentinel — a failed read would send a supplier who HAS a shop to the create-a-shop wizard.\n  ${site.text}`,
    );
  }
});

test("the 'no-vendor' sentinel is produced ONLY from a proven absence", () => {
  const lines = readFileSync(SHOP_PAGE, 'utf8').split('\n');
  const producers = lines
    .map((text, i) => ({ text: text.trim(), line: i + 1 }))
    .filter((l) => !isComment(l.text) && /return\s+['"`]no-vendor['"`]/.test(l.text));
  // eslint-disable-next-line no-console
  console.log(`[guard] 'no-vendor' production sites in ${SHOP_PAGE}: ${producers.length}`);
  assert.ok(
    producers.length >= 1,
    `no 'no-vendor' producer found in ${SHOP_PAGE} — the scan is broken or the sentinel was renamed`,
  );
  for (const p of producers) {
    // The sentinel may only follow a test of the RESOLVED profile. An error
    // path must fall through to the loader's catch (data = null), which
    // renders "couldn't load" rather than redirecting.
    assert.match(
      p.text,
      /if\s*\(\s*!\s*profile\s*\)/,
      `${SHOP_PAGE}:${p.line} returns 'no-vendor' from something other than the resolved-profile check — an error could now reach /open-shop.\n  ${p.text}`,
    );
  }
});

test('the loader still has a separate "couldn\'t load" branch for a failed read', () => {
  const src = readFileSync(SHOP_PAGE, 'utf8');
  // The catch must assign the DISTINCT null value, not the sentinel.
  assert.match(
    src,
    /catch\s*\([\s\S]{0,600}?data\s*=\s*null;/,
    `${SHOP_PAGE}: the loader's catch no longer falls through to data = null — a thrown read would have nowhere to land but the redirect`,
  );
  assert.ok(
    !/catch\s*\([\s\S]{0,600}?data\s*=\s*['"`]no-vendor['"`]/.test(src),
    `${SHOP_PAGE}: the catch assigns the 'no-vendor' sentinel — a failed read would read as a proven absence`,
  );
});

test('the membership read keeps its error instead of destructuring it away', () => {
  const src = readFileSync(VENDOR_PROFILE, 'utf8');
  const reads = src
    .split('\n')
    .map((text, i) => ({ text: text.trim(), line: i + 1 }))
    .filter((l) => !isComment(l.text) && /const\s*\{[^}]*data:\s*memberships/.test(l.text));
  // eslint-disable-next-line no-console
  console.log(`[guard] membership reads found in ${VENDOR_PROFILE}: ${reads.length}`);
  assert.ok(
    reads.length >= 1,
    `no membership read found in ${VENDOR_PROFILE} — the scan is broken or the read moved`,
  );
  for (const r of reads) {
    assert.match(
      r.text,
      /error:/,
      `${VENDOR_PROFILE}:${r.line} destructures the membership read's data without its error — a refused read becomes the same null as "no memberships", which reaches /open-shop as a proven absence.\n  ${r.text}`,
    );
  }
  assert.match(
    src,
    /classifyShopRead\(/,
    `${VENDOR_PROFILE}: the membership read no longer routes through classifyShopRead — the (rows, error) decision has been re-implemented inline where nothing executes it`,
  );
});
