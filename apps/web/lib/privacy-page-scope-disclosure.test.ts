/**
 * REGRESSION — the privacy policy's disclosed OAuth scope list must byte-match
 * the scopes the code actually requests (`YOUTUBE_OAUTH_SCOPES` /
 * `DRIVE_OAUTH_SCOPES`). Both `lib/panood-youtube.ts` and the privacy page
 * itself carry a comment saying so, but a comment has never stopped drift:
 * `userinfo.email` and `userinfo.profile` were disclosed on this page for
 * months after they stopped being requested, and were only removed
 * 2026-07-27. This test is the thing that actually stops it recurring.
 *
 * Both source files import `server-only`, so they can't be imported by the
 * tsx test runner — this reads the raw source text instead and regex-extracts
 * the scope array / the disclosed scope, the same way the page itself is
 * text, not a rendered DOM.
 *
 * The extraction is intentionally anchored to the specific disclosure label
 * ("The permission we ask for." / "Scope requested.") rather than any
 * `<code>` tag on the page — a loose match would also catch the "we never
 * request drive / drive.readonly" negative disclosures a few lines below and
 * silently compare the wrong thing. A test that found nothing and compared
 * two empty sets would pass while guarding nothing, so every extraction
 * asserts it found something before any set comparison runs.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
// `assert(cond, msg)` (the strict module's default-callable form) is a TS
// assertion function, so it narrows `string | undefined` after each check —
// `assert.ok` alone does not, and this file needs the narrowing.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..');

const YOUTUBE_SOURCE = readFileSync(
  path.join(ROOT, 'lib/panood-youtube.ts'),
  'utf8',
);
const DRIVE_SOURCE = readFileSync(
  path.join(ROOT, 'lib/papic-drive.ts'),
  'utf8',
);
const PRIVACY_PAGE = readFileSync(
  path.join(ROOT, 'app/(shell)/privacy/page.tsx'),
  'utf8',
);

function extractScopeArray(source: string, exportName: string): string[] {
  const arrayMatch = source.match(
    new RegExp(`export const ${exportName} = \\[([\\s\\S]*?)\\] as const`),
  );
  assert(
    arrayMatch,
    `could not find "export const ${exportName} = [...]" — has the export been renamed?`,
  );
  const scopes = [...arrayMatch[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  assert(
    scopes.length > 0,
    `${exportName} array matched but contained no quoted scope strings`,
  );
  return scopes;
}

// Full https://www.googleapis.com/... form and the page's abbreviated
// .../auth/... form both resolve to the same suffix for comparison.
function normalizeScope(scope: string): string {
  const suffix = scope.match(/\/auth\/([\w.]+)$/);
  assert(suffix, `scope "${scope}" does not look like a Google OAuth scope URL`);
  return suffix[1]!;
}

// Finds the first <code>...</code> block after a given disclosure label and
// returns its normalized scope suffix. Throws (loudly, not vacuously) if the
// label or a following <code> block isn't found.
function extractDisclosedScope(page: string, label: string): string {
  const labelIndex = page.indexOf(label);
  assert(
    labelIndex !== -1,
    `disclosure label "${label}" not found on the privacy page — has the copy been reworded?`,
  );
  const afterLabel = page.slice(labelIndex);
  const codeMatch = afterLabel.match(/<code[^>]*>\s*([^<]+?)\s*<\/code>/);
  assert(
    codeMatch,
    `no <code> block found after disclosure label "${label}"`,
  );
  const disclosed = codeMatch[1]!.trim();
  assert(disclosed.length > 0, `<code> block after "${label}" was empty`);
  return normalizeScope(disclosed);
}

test('privacy page discloses exactly YOUTUBE_OAUTH_SCOPES, no more and no less', () => {
  const codeScopes = extractScopeArray(YOUTUBE_SOURCE, 'YOUTUBE_OAUTH_SCOPES').map(
    normalizeScope,
  );
  const disclosed = extractDisclosedScope(
    PRIVACY_PAGE,
    'The permission we ask for.',
  );

  assert.deepEqual(
    [disclosed],
    codeScopes,
    `privacy page discloses scope "${disclosed}" but YOUTUBE_OAUTH_SCOPES requests [${codeScopes.join(', ')}] — the disclosure must byte-match the request`,
  );
});

test('privacy page discloses exactly DRIVE_OAUTH_SCOPES, no more and no less', () => {
  const codeScopes = extractScopeArray(DRIVE_SOURCE, 'DRIVE_OAUTH_SCOPES').map(
    normalizeScope,
  );
  const disclosed = extractDisclosedScope(PRIVACY_PAGE, 'Scope requested.');

  assert.deepEqual(
    [disclosed],
    codeScopes,
    `privacy page discloses scope "${disclosed}" but DRIVE_OAUTH_SCOPES requests [${codeScopes.join(', ')}] — the disclosure must byte-match the request`,
  );
});
