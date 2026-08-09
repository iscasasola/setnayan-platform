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
 * vendor UI (the app's only one is ADMIN: app/admin/vendors/[vendorProfileId]/edit),
 * so EVERY form that could ever have been wired to that action — and it looked
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
 * ─── ⚠ THIS FILE SHIPPED BROKEN ONCE. READ BEFORE EDITING. ───────────────
 * The first version (PR #4274) rolled its own comment stripper —
 * `.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'')` — and matched
 * `is_published` only as a BARE key. Three independent evasions were then
 * reproduced against it, all of them leaving all four tests green:
 *
 *   1. `accept="image/*"` in any scanned file opens a comment that never
 *      existed, blanking everything up to the next real `*​/` — 5,104 lines of
 *      real code across 1,031 files were being deleted before the scan. The
 *      verbatim hazard line, pasted into one of those windows in
 *      `lib/papic-fullres-drop.ts`, was invisible to all four tests.
 *   2. A quoted key — `{ 'is_published': fd.get('publish') === 'on' }`, the
 *      normal spelling when an object is pasted from a column list or from
 *      generated types — matched neither regex.
 *   3. Shorthand — `{ is_published }` — matched neither regex.
 *
 * The lessons are now structural, not advisory:
 *   • Stripping goes through `lib/strip-comments.ts`, a real lexer. Do not
 *     inline a regex here again; that module's docblock has the measurements.
 *   • The detectors are pure functions tested against KNOWN-BAD INPUT below
 *     ("the detectors catch what they are for"). A scan whose sensitivity is
 *     assumed rather than proven is how all three evasions survived review.
 *     ANY new evasion you think of belongs in that battery first.
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

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/**
 * Publishing is an ADMIN decision, so admin code is where the write belongs —
 * `app/admin/vendors/actions.ts` reads the checkbox from its own form, which
 * genuinely renders one. Everything else is "vendor-scoped" for this rule.
 */
const ADMIN_PREFIX = `app${'/'}admin/`;

/**
 * The only non-admin writes of the column, each with the reason it is not the
 * hazard. A NEW path has to add itself here and say why — which is the point of
 * the list existing rather than the rule being "no writes at all".
 *
 * Keys are POSIX-style repo-relative paths; `toPosix` normalises the separator
 * so the list is not silently empty on Windows.
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

const toPosix = (p: string) => p.split('\\').join('/');

// ── THE DETECTORS ──────────────────────────────────────────────────────────
// Pure, exported to the battery below. Both accept COMMENT-STRIPPED source.

/**
 * Does this source read `is_published` out of a submitted form?
 *
 * The RECEIVER IS NOT NAMED. The first cut required the literal identifier
 * `formData`, and a second attempt required one merely containing "form" — the
 * battery below caught that one on `fd.has('is_published')`, which is how half
 * this repo spells it. Nothing in vendor-scoped code has any business pulling
 * this column out of a `.get()/.getAll()/.has()` bag under ANY name: not a
 * FormData, not searchParams, not a header map. So match the call shape and let
 * `assignsIsPublished` back it up from the other end.
 */
export function readsIsPublishedFromForm(src: string): boolean {
  return /\.\s*(?:get|getAll|has)\(\s*['"`]is_published['"`]/.test(src);
}

/**
 * Does this source ASSIGN `is_published`, as opposed to declaring its type?
 *
 * Covers the three spellings an object key can take — bare, quoted, and
 * shorthand — plus bracket assignment. The value is captured and inspected
 * rather than excluded with a lookahead: `/is_published\s*:\s*(?!boolean\b)/`
 * looks like it says "not a type declaration" and does not, because `\s*`
 * backtracks to zero width so the lookahead runs against " boolean", sees a
 * space, and passes. That was the first cut, and it flagged two pure type files.
 */
export function assignsIsPublished(src: string): boolean {
  // patch['is_published'] = x
  if (/\[\s*['"`]is_published['"`]\s*\]\s*=/.test(src)) return true;
  // `{ is_published }` — ES6 shorthand. Braces are required so a bare mention
  // in an import list or inside a `.select('… is_published …')` string is not a
  // hit. The hard part is that DESTRUCTURING wears the same clothes:
  // `const { is_published } = row` is a READ. The two are told apart by their
  // neighbours — a declaration keyword before the brace, or an `=` after it.
  for (const m of src.matchAll(/\{([^{}]*)\}/g)) {
    const inner = m[1];
    if (inner === undefined || m.index === undefined) continue;
    if (!/(?:^|[,\s])is_published\s*(?:,|$)/.test(inner)) continue;
    const before = src.slice(Math.max(0, m.index - 12), m.index);
    if (/\b(?:const|let|var)\s*$/.test(before)) continue; // const { is_published } = row
    const after = src.slice(m.index + m[0].length);
    if (/^\s*=[^=]/.test(after)) continue; // ({ is_published } = row)
    return true;
  }
  // is_published: value  /  'is_published': value  /  "is_published": value
  for (const m of src.matchAll(/['"`]?is_published['"`]?\??\s*:\s*([^\s,;}]+)/g)) {
    const value = m[1];
    if (value === undefined) continue;
    // `boolean`, `boolean | null`, `boolean|null` — a row-shape type, not a write.
    if (!/^boolean/.test(value)) return true;
  }
  return false;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(p).isDirectory();
    } catch {
      continue; // broken symlink — not source, and must not crash the guard
    }
    if (isDir) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const VENDOR_SCOPED = ['app', 'lib']
  .flatMap((root) => walk(resolve(WEB, root)))
  .map((p) => ({ rel: toPosix(relative(WEB, p)), src: stripComments(readFileSync(p, 'utf8')) }))
  .filter(({ rel }) => !rel.startsWith(ADMIN_PREFIX));

// ── THE BATTERY: prove the detectors are sensitive before trusting them ────

test('the detectors catch what they are for', () => {
  const MUST_CATCH_READ = [
    `is_published: formData.get('is_published') === 'on'`,
    `is_published: formData.getAll("is_published").length > 0`,
    `const p = fd.has('is_published');`, // variable not named formData
    `theForm.get('is_published')`,
  ];
  for (const s of MUST_CATCH_READ) {
    assert.ok(
      readsIsPublishedFromForm(s) || assignsIsPublished(s),
      `a form-read of is_published slipped both detectors: ${s}`,
    );
  }

  // The three evasions that were REPRODUCED against the first version.
  const MUST_CATCH_WRITE = [
    `update({ is_published: formData.get('is_published') === 'on' })`,
    `update({ 'is_published': fd.get('publish') === 'on' })`, // quoted key
    `update({ "is_published": true })`,
    `update({ is_published })`, // ES6 shorthand
    `patch['is_published'] = value;`,
    `is_published: someHelper(data)`, // no 'formData' anywhere
  ];
  for (const s of MUST_CATCH_WRITE) {
    assert.ok(assignsIsPublished(s), `a write of is_published slipped the detector: ${s}`);
  }

  // …and does NOT fire on the things that are not writes, or CI goes red on
  // correct code, which is the fastest way to get a guard deleted.
  const MUST_NOT_CATCH = [
    `is_published: boolean;`,
    `is_published?: boolean;`,
    `is_published: boolean | null;`,
    `is_published: boolean|null;`,
    `.select('vendor_profile_id, is_published, tier_state')`,
    `.eq('is_published', true)`,
    `if (profile.is_published) return null;`,
    // Destructuring is a READ wearing shorthand's clothes — both spellings.
    `const { is_published } = row;`,
    `let { is_published, tier_state } = row;`,
    `({ is_published } = row);`,
  ];
  for (const s of MUST_NOT_CATCH) {
    assert.ok(
      !assignsIsPublished(s) && !readsIsPublishedFromForm(s),
      `the detector fires on something that is not a write: ${s}`,
    );
  }
});

test('the scan reads real code — a string like accept="image/*" cannot blind it', () => {
  // Reproduction of evasion #1, as a unit rather than as a file on disk: the
  // regex stripper blanked everything from the string to the next `*​/`.
  const src = [
    '<input accept="image/*" />',
    `const hazard = { is_published: formData.get('is_published') === 'on' };`,
    '/** a real docblock */',
  ].join('\n');
  const cleaned = stripComments(src);
  assert.ok(readsIsPublishedFromForm(cleaned), 'the hazard was eaten by a fake comment window');
  assert.ok(assignsIsPublished(cleaned));
});

test('prose about the banned line does not fail the guard, wherever it sits', () => {
  // Reproduction of evasion #2's mirror image — the false-POSITIVE direction.
  // Both a full-line and a TRAILING comment must be invisible to the scan.
  for (const src of [
    `// never write is_published: formData.get('is_published') === 'on'\nconst a = 1;`,
    `const a = 1; // never write is_published: formData.get('is_published') === 'on'`,
    `/* is_published: formData.get('is_published') === 'on' */\nconst a = 1;`,
  ]) {
    const cleaned = stripComments(src);
    assert.ok(!readsIsPublishedFromForm(cleaned), `comment read as code: ${src}`);
    assert.ok(!assignsIsPublished(cleaned), `comment read as code: ${src}`);
  }
});

// ── THE SCANS ──────────────────────────────────────────────────────────────

test('no vendor-scoped code reads is_published out of a form', () => {
  const offenders = VENDOR_SCOPED.filter(({ src }) => readsIsPublishedFromForm(src)).map(
    ({ rel }) => rel,
  );

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

test('every non-admin write of is_published is one of the two known, reasoned ones', () => {
  const writers = VENDOR_SCOPED.filter(({ src }) => assignsIsPublished(src)).map(({ rel }) => rel);

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

test('the scan actually covers the tree — not silently zero files', () => {
  // An empty corpus passes every assertion above. That is the failure mode a
  // path bug, a bad filter or a thrown statSync would produce, and it looks
  // exactly like success.
  assert.ok(
    VENDOR_SCOPED.length > 500,
    `the vendor-scoped scan found only ${VENDOR_SCOPED.length} files — it is not ` +
      'reading the tree it claims to read',
  );
  assert.ok(
    VENDOR_SCOPED.some(({ rel }) => rel === 'app/vendor-dashboard/actions.ts'),
    'the file this guard was written for is not in the scanned set',
  );
});

test('the retired full-form vendor save has not come back', () => {
  const src = stripComments(
    readFileSync(resolve(WEB, 'app/vendor-dashboard/actions.ts'), 'utf8'),
  );
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
