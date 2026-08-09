/**
 * vendor-publish-guard.test.ts — a shop cannot unpublish itself by accident.
 *
 * ─── The bug this exists to prevent ──────────────────────────────────────
 * `saveVendorProfile` (app/vendor-dashboard/actions.ts) built a FULL payload
 * from FormData and wrote:
 *
 *     is_published: formData.get('is_published') === 'on'
 *
 * A checkbox that is not ticked posts NOTHING. So does a checkbox that was
 * never rendered — the two are the identical FormData, and this line reads
 * both as FALSE. There has never been a `name="is_published"` control in the
 * vendor UI (the app's only one is ADMIN: app/admin/vendors/[id]/edit), so
 * EVERY form that could ever have been wired to that action — and it looked
 * exactly like the natural "full form save" — would have unpublished the shop
 * on every submit, and reported success.
 *
 * It never fired only because the action had no caller for five weeks. That is
 * luck, not a guarantee, and luck is not a thing a test can re-run. The action
 * was deleted 2026-08-09; this file is what stops the line coming back.
 *
 * ─── Why the check is a source scan ──────────────────────────────────────
 * The hazard is a line of code that is never executed. There is no runtime to
 * observe, no behavior to assert on — a unit test of the action would have
 * passed on the broken version, because with no `is_published` input the write
 * of `false` IS what the code says to do. Only the source text distinguishes
 * "the vendor cleared the box" from "the form never had one".
 *
 * ─── Comments are stripped before matching, deliberately ─────────────────
 * The tombstone left in actions.ts names `is_published` a dozen times while
 * explaining why the write is gone. A guard that matched raw text would fail
 * on its own documentation, and the fastest way to get a guard deleted is to
 * make it fail on correct code. (Same lesson as the first cut of the
 * `compatible_fields_present` assertion in vendor-compatibility.test.ts: a
 * name appearing is not a name being used.)
 *
 * ─── The same shape, twice more ──────────────────────────────────────────
 * `social_feature_opt_out` and `same_day_available` were blind `=== 'on'`
 * writes in that same payload, with no control anywhere in the app either.
 * They went out with the action. They are NOT scanned here because neither has
 * an admin surface to point a vendor-vs-admin rule at — if a writer is ever
 * built for them it must render a real control, which is the honest fix rather
 * than a lint.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/**
 * Publishing is an ADMIN decision, so admin code is where the write belongs —
 * `app/admin/vendors/actions.ts` reads the checkbox from its own form, which
 * genuinely renders one. Everything else is "vendor-scoped" for this rule.
 */
const ADMIN_PREFIX = 'app/admin/';

/**
 * The only non-admin writes of the column, each with the reason it is not the
 * hazard. A NEW path has to add itself here and say why — which is the point of
 * the list existing rather than the rule being "no writes at all".
 */
const ALLOWED_WRITES: ReadonlyMap<string, string> = new Map([
  [
    'app/vendor/claim/[token]/finalize/page.tsx',
    'INSERT of a brand-new profile row: a creation default, not a form value. ' +
      'A shop that has just been claimed is unpublished until an admin says otherwise.',
  ],
  [
    'lib/erasure/coverage.ts',
    'VENDOR_PROFILE_PII_SCRUB — account erasure. Taking an erased shop off the ' +
      'marketplace is the whole intent, and the value is a constant, not a submission.',
  ],
]);

/** Strip comments — the tombstone in actions.ts must not read as code. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const VENDOR_SCOPED = ['app', 'lib']
  .flatMap((root) => walk(resolve(WEB, root)))
  .map((p) => ({ rel: relative(WEB, p), src: code(readFileSync(p, 'utf8')) }))
  .filter(({ rel }) => !rel.startsWith(ADMIN_PREFIX));

test('no vendor-scoped code reads is_published out of a form', () => {
  const offenders = VENDOR_SCOPED.filter(({ src }) =>
    /formData\s*\.\s*(?:get|getAll|has)\(\s*['"]is_published['"]/.test(src),
  ).map(({ rel }) => rel);

  assert.deepEqual(
    offenders,
    [],
    'A vendor-scoped action is deriving `is_published` from FormData again. ' +
      'There is no `name="is_published"` control in the vendor UI, so an absent ' +
      'checkbox and an unticked one are the same submission — the write lands as ' +
      'FALSE and silently unpublishes the shop, on a save that reports success. ' +
      'If a vendor really is meant to publish themselves, ship the control FIRST ' +
      'and post an explicit marker alongside it (the `compatible_fields_present` ' +
      'pattern), so "did not ask" stays distinguishable from "answered no". ' +
      `Offending file(s): ${offenders.join(', ')}`,
  );
});

/**
 * Does this file ASSIGN `is_published`, as opposed to declaring its type?
 *
 * The value is captured and inspected rather than excluded with a lookahead.
 * `/is_published\s*:\s*(?!boolean\b)/` looks like it says "not a type
 * declaration" and does not: `\s*` backtracks to zero width, so the lookahead
 * runs against " boolean", sees a space, and passes. The first cut of this
 * guard shipped that regex and flagged two pure type files — which is the
 * benign direction of the same mistake that would have let a real write past.
 */
function assignsIsPublished(src: string): boolean {
  if (/\[\s*['"]is_published['"]\s*\]\s*=/.test(src)) return true;
  for (const m of src.matchAll(/is_published\??\s*:\s*([^\s,;}]+)/g)) {
    const value = m[1];
    if (value === undefined) continue;
    // `boolean`, `boolean | null`, `boolean|null` — a row-shape type, not a write.
    if (!/^boolean/.test(value)) return true;
  }
  return false;
}

test('every non-admin write of is_published is one of the two known, reasoned ones', () => {
  const writers = VENDOR_SCOPED.filter(({ src }) => assignsIsPublished(src)).map(
    ({ rel }) => rel,
  );

  const unexpected = writers.filter((rel) => !ALLOWED_WRITES.has(rel));
  assert.deepEqual(
    unexpected,
    [],
    'A new non-admin write of `is_published` appeared. Publishing is an admin ' +
      'decision (/admin/verify writes `public_visibility` + `verification_state`, ' +
      'which is the live marketplace gate). If this write is legitimate, add it to ' +
      'ALLOWED_WRITES with the reason it is not a blind form value. ' +
      `New writer(s): ${unexpected.join(', ')}`,
  );

  // Fails in the OTHER direction too: an allowlist entry that no longer matches
  // any file is a stale exemption quietly widening what the guard permits.
  const stale = [...ALLOWED_WRITES.keys()].filter((rel) => !writers.includes(rel));
  assert.deepEqual(
    stale,
    [],
    `ALLOWED_WRITES exempts a path that no longer writes is_published: ${stale.join(', ')}. ` +
      'Drop the entry — an exemption nobody re-reads is how the next blind write gets in.',
  );
});

test('the retired full-form vendor save has not come back', () => {
  const src = code(readFileSync(resolve(WEB, 'app/vendor-dashboard/actions.ts'), 'utf8'));
  assert.ok(
    !/export\s+(?:async\s+)?function\s+saveVendorProfile\b/.test(src),
    '`saveVendorProfile` is exported again. It was deleted 2026-08-09 because it ' +
      'wrote a FULL payload from FormData — fifteen columns nulled or falsed by ' +
      'absence, including three booleans with no control anywhere. Per-field ' +
      'actions (`updateVendorProfileField`, `updateVendorWebsiteField`, ' +
      '`shop/venue-match-actions.ts`) replaced it; each writes only what it asked for.',
  );
});

test('the publish control still lives on the admin page, and only there', () => {
  // The cheap way to satisfy every assertion above is to delete publishing
  // outright, or to relocate the control into vendor code. Both would pass the
  // scans and neither is the decision — so pin where the control actually is.
  const admin = readFileSync(
    resolve(WEB, 'app/admin/vendors/[vendorProfileId]/edit/page.tsx'),
    'utf8',
  );
  assert.ok(
    /name="is_published"/.test(admin),
    'The admin publish toggle is gone. If publishing moved, move this guard with ' +
      'it — do not leave the rule pointing at a control that no longer exists.',
  );
});
