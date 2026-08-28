/**
 * EVENT HUB PRO MAY ONLY CLAIM WHAT A NON-BUYER IS ACTUALLY REFUSED.
 *
 * Owner ruled 2026-08-28: say what it includes. Doing that honestly turned up
 * the opposite problem first — of the FOUR inclusions this ₱3,500 upgrade
 * advertised, THREE were untrue, in three places at once (the buy page's
 * BENEFITS, the Studio catalogue blurb, and the description stored in the
 * database, which is the one the PUBLIC pricing page renders).
 *
 *   · RSVP           — gated on nothing. Every couple has the RSVP page.
 *   · the on-the-day page — gated on nothing. Every guest-side read of this SKU
 *                      resolves the WATERMARK and nothing else.
 *   · Editorial PRO  — real once; FREE FOR EVERYONE since 2026-08-23.
 *
 * ── WHY THIS IS DERIVED AND NOT A LIST OF BANNED WORDS ───────────────────────
 * A banned-word list is a bill somebody has to keep paying, and it goes stale
 * in the WRONG direction: the day a real Pro gate is added to the RSVP page,
 * the honest copy becomes forbidden. So the two live claims are derived from
 * the code instead:
 *   · "may we say Editorial PRO?" is answered by FREE_FOR_ALL_SKUS. It is
 *     checked BOTH WAYS — if Editorial PRO ever stops being free, this fails
 *     and tells you to put the claim BACK.
 *   · "may we say RSVP / on-the-day?" is answered by what the guest-side tree
 *     actually does with this SKU. Today every call there names a watermark.
 *     Add a guest-side gate that is not a watermark and this fails, telling you
 *     to re-check the benefit list rather than silently under-selling.
 *
 * ⚠ IT READS SOURCE INSTEAD OF IMPORTING. `@/lib/...` under `tsx --test` can
 * resolve to EMPTY NAMED EXPORTS, which would make every loop below run zero
 * times and report a pass. Every scan carries a non-zero anti-vacuity check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '../../../../..');
const read = (p: string) => readFileSync(p, 'utf8');

const SKU = 'COUPLE_WEBSITE_PRO';
const GATE = 'eventCoupleWebsiteProActive';

/** The customer-facing sentences that describe this upgrade, all three of them. */
function claimSurfaces(): Array<{ where: string; text: string }> {
  const page = read(join(HERE, 'page.tsx'));
  const benefits = /const BENEFITS = \[([\s\S]*?)\];/.exec(page);
  assert.ok(benefits, 'BENEFITS block not found — the scan is blind');

  const catalog = read(join(WEB, 'lib/add-ons-catalog.ts'));
  const entry = /key: 'website-pro',[\s\S]*?blurb: '([^']*)'/.exec(catalog);
  assert.ok(entry, "the website-pro catalogue blurb was not found — the scan is blind");

  const migrations = join(WEB, '../../supabase/migrations');
  const migFile = readdirSync(migrations).find((f) =>
    f.includes('the_catalogue_forgets_what_it_retired'),
  );
  assert.ok(migFile, 'the description migration was not found');
  const mig = read(join(migrations, migFile));
  const desc = /UPDATE public\.platform_retail_catalog_v2[\s\S]*?SET description =([\s\S]*?)updated_at/.exec(mig);
  assert.ok(desc, 'the stored description was not found in the migration');

  return [
    { where: 'the buy page', text: benefits[1]! },
    { where: 'the Studio catalogue blurb', text: entry[1]! },
    { where: 'the description on the public pricing page', text: desc[1]! },
  ];
}

/** Is Editorial PRO free for every couple, paid or not? */
function editorialProIsFreeForEveryone(): boolean {
  const src = read(join(WEB, 'lib/entitlements.ts'));
  const set = /FREE_FOR_ALL_SKUS[^=]*=[\s\S]*?new Set\(\[([\s\S]*?)\]\)/.exec(src);
  assert.ok(set, 'FREE_FOR_ALL_SKUS not found — the scan is blind');
  const codes = [...set[1]!.matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]!);
  assert.ok(codes.length > 0, 'FREE_FOR_ALL_SKUS scanned empty');
  return codes.includes('EDITORIAL_PRO');
}

/** Every guest-facing use of this SKU, with the name it is assigned to. */
function guestSideGateUses(): Array<{ file: string; line: string }> {
  const root = join(WEB, 'app/[slug]');
  const out: Array<{ file: string; line: string }> = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !name.includes('.test.')) {
        for (const line of read(p).split('\n')) {
          // The CALL, not the import and not a comment mentioning it.
          if (line.includes(`${GATE}(`) && !line.trimStart().startsWith('//') && !line.includes('import')) {
            out.push({ file: relative(WEB, p), line: line.trim() });
          }
        }
      }
    }
  };
  walk(root);
  return out;
}

test('the scans found something — none of these assertions is vacuous', () => {
  const surfaces = claimSurfaces();
  assert.equal(surfaces.length, 3, 'all three claim surfaces must be readable');
  for (const s of surfaces) assert.ok(s.text.length > 40, `${s.where} scanned nearly empty`);
  assert.ok(guestSideGateUses().length > 0, 'no guest-side use of the SKU found — the scan is blind');
});

test('Editorial PRO is not sold as an inclusion while it is free for everyone', () => {
  const free = editorialProIsFreeForEveryone();
  for (const { where, text } of claimSurfaces()) {
    const claims = /editorial/i.test(text);
    if (free) {
      assert.ok(
        !claims,
        `${where} sells Editorial PRO, but it is in FREE_FOR_ALL_SKUS — every couple already has it, ` +
          `so it is not something this upgrade buys.`,
      );
    } else {
      assert.ok(
        claims,
        `Editorial PRO has left FREE_FOR_ALL_SKUS, so it is a real inclusion again — put it back into ${where}.`,
      );
    }
  }
});

test('nothing guest-facing is gated on this SKU except the watermark', () => {
  // This is the measurement behind dropping the "RSVP" and "on-the-day" claims.
  // If it ever stops holding, those claims may have become true again.
  for (const { file, line } of guestSideGateUses()) {
    assert.match(
      line,
      /atermark/,
      `${file} gates something guest-facing on ${SKU} that is not a watermark — ` +
        `re-check what Event Hub PRO advertises; it may now include more than it says.`,
    );
  }
});

test('the copy does not promise RSVP or the on-the-day page', () => {
  // Held only while the test above holds: no guest-side gate, so no claim.
  for (const { where, text } of claimSurfaces()) {
    assert.doesNotMatch(text, /\bRSVP\b/i, `${where} promises RSVP, which no gate withholds`);
    assert.doesNotMatch(
      text,
      /on-the-day|on the day/i,
      `${where} promises the on-the-day page, which no gate withholds`,
    );
  }
});

test('the reveal — the one real exclusive — is still aliased to this SKU', () => {
  const src = read(join(WEB, 'lib/entitlements.ts'));
  const aliases = /SKU_OWNERSHIP_ALIASES[\s\S]*?\}\);/.exec(src);
  assert.ok(aliases, 'SKU_OWNERSHIP_ALIASES not found — the scan is blind');
  assert.match(
    aliases[0]!,
    new RegExp(`STD_PREMIUM_OPENINGS: Object\\.freeze\\(\\['${SKU}'\\]\\)`),
    'the cinematic reveal is no longer granted by Event Hub PRO — the copy claims it is the only way to get it',
  );
});
