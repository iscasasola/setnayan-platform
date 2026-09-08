/**
 * csp-r2-media-host-consistency.test.ts — S14
 * (build-sessions/encoder/S14.md).
 *
 * `next.config.ts`'s report-only `connect-src`, `img-src` and `media-src`
 * each name the R2 media hosts independently — three copies of the same
 * fact, and a copy is a drift waiting to happen (the same lesson
 * `csp-embeds-are-allowed.test.ts` already learned about `frame-src`). A
 * host present in `connect-src` but missing from `img-src` fetches fine but
 * renders as a broken image the moment this draft is enforced — same
 * failure family as the OpenStreetMap grey box: nothing thrown, nothing
 * logged, just an absence.
 *
 * S14's own defect was exactly this shape one level up: `media.setnayan.com`
 * is named in all three directives, but the host production actually serves
 * from (`pub-37d64fe618584c2981a88610a55dd439.r2.dev` — the `setnayan-media`
 * bucket's `r2.dev` dev subdomain, measured live against `/download` and the
 * homepage's own rendered asset URLs) was in NONE of them.
 *
 * ⚠ ANCHORED ON THE PARSED DIRECTIVE VALUE, NOT ON THE HOST STRING APPEARING
 * ANYWHERE IN THE FILE. A retired-host comment (this very file's own prose,
 * or `updater.rs`'s doc comments) satisfies a bare `.includes(host)` over
 * the whole config text without the CSP actually allowing anything — so
 * every check here extracts the named directive first, then tokenizes it,
 * exactly like `csp-embeds-are-allowed.test.ts`'s `allowsHost`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = () => readFileSync(join(WEB, 'next.config.ts'), 'utf8');

/**
 * Extracts one named directive's full string from the draft `CSP_REPORT_ONLY`
 * array. Anchored inside the array literal (same technique as
 * `csp-embeds-are-allowed.test.ts` / `csp-encoder-ipc.test.ts`) so this can
 * never accidentally read the separate enforced header, and a comment line
 * mentioning the directive name is skipped rather than matched.
 */
function draftDirective(config: string, name: string): string | null {
  const block = /const CSP_REPORT_ONLY = \[([\s\S]*?)\]\.join/.exec(config);
  if (!block?.[1]) return null;
  const re = new RegExp(`^"(${name} [^"]*)"`);
  for (const line of block[1].split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;
    const m = re.exec(trimmed);
    if (m?.[1]) return m[1];
  }
  return null;
}

function directive(name: string): string {
  const found = draftDirective(CONFIG(), name);
  assert.notEqual(found, null, `no report-only ${name} directive found in next.config.ts`);
  return found!;
}

/**
 * Exact-host membership within an ALREADY-EXTRACTED directive string — a
 * host counts only as one of the directive's own space-separated sources,
 * never as a substring of the directive (which the pubkey-style noise or an
 * unrelated host sharing a suffix could satisfy by accident).
 */
function directiveHasHost(dir: string, host: string): boolean {
  return dir
    .split(/\s+/)
    .some((source) => source.replace(/^https?:\/\//, '').replace(/\/.*$/, '') === host);
}

const MEDIA_DIRECTIVES = ['connect-src', 'img-src', 'media-src'] as const;

/**
 * Every host this app's R2-served media has ever been reachable from. Kept
 * as a short, hand-maintained list for the same reason
 * `FRAME_CREATING_SCRIPT_HOSTS` in `csp-embeds-are-allowed.test.ts` is
 * hand-kept: which hosts serve R2 media is a fact about our own
 * infrastructure, not something derivable from parsing this file.
 */
const R2_MEDIA_HOSTS = [
  'media.setnayan.com',
  'pub-37d64fe618584c2981a88610a55dd439.r2.dev',
];

test('every R2 media host is named in connect-src, img-src AND media-src together', () => {
  const directives = Object.fromEntries(MEDIA_DIRECTIVES.map((name) => [name, directive(name)]));

  const offenders: string[] = [];
  for (const host of R2_MEDIA_HOSTS) {
    const present = MEDIA_DIRECTIVES.filter((name) => directiveHasHost(directives[name]!, host));
    const missing = MEDIA_DIRECTIVES.filter((name) => !present.includes(name));
    if (present.length > 0 && missing.length > 0) {
      offenders.push(`${host} — present in ${present.join(', ')}, missing from ${missing.join(', ')}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `A media/R2 host is named in some of connect-src/img-src/media-src but not all ` +
      `three. The missing directive silently blocks that host's fetch or render the ` +
      `moment this report-only policy is enforced — the OpenStreetMap grey-box failure, ` +
      `one directive over.\n\n${offenders.join('\n')}`,
  );
});

test('the host production actually serves R2 media from (r2.dev) is present in all three directives', () => {
  const liveHost = 'pub-37d64fe618584c2981a88610a55dd439.r2.dev';
  for (const name of MEDIA_DIRECTIVES) {
    assert.ok(
      directiveHasHost(directive(name), liveHost),
      `${name} is missing ${liveHost} — the host production actually serves R2 media ` +
        `from today (media.setnayan.com never resolves and is ruled out, S14)`,
    );
  }
});

test('REGRESSION GUARD — dropping the live host from one directive must fail the consistency check', () => {
  // Proves the extractor + assertions really read the live file rather than
  // a synthetic string that happens to already agree with itself.
  const original = CONFIG();
  const mutated = original.replace(
    '"img-src \'self\' data: blob: https://media.setnayan.com https://pub-37d64fe618584c2981a88610a55dd439.r2.dev',
    '"img-src \'self\' data: blob: https://media.setnayan.com',
  );
  assert.notEqual(mutated, original, 'the mutation string did not match img-src — test is stale');

  const imgSrc = draftDirective(mutated, 'img-src');
  assert.notEqual(imgSrc, null);
  assert.equal(
    directiveHasHost(imgSrc!, 'pub-37d64fe618584c2981a88610a55dd439.r2.dev'),
    false,
    'the mutated img-src should no longer carry the r2.dev host',
  );

  const connectSrc = draftDirective(mutated, 'connect-src');
  assert.notEqual(connectSrc, null);
  assert.equal(
    directiveHasHost(connectSrc!, 'pub-37d64fe618584c2981a88610a55dd439.r2.dev'),
    true,
    'connect-src should be untouched by the img-src-only mutation',
  );
});

test('REGRESSION GUARD — a host matching only as a substring of the directive must not count', () => {
  // ⚠ THE DECORATION FAILURE MODE. A naive `.includes(host)` over the whole
  // directive string would be satisfied by the host appearing inside a
  // DIFFERENT source's path or a comment fragment, without the directive
  // actually admitting it as a source. `directiveHasHost` must reject that.
  const decorative =
    "connect-src 'self' https://not-the-real-host.example/pub-37d64fe618584c2981a88610a55dd439.r2.dev/looks-like-it-but-isnt";
  assert.equal(
    directiveHasHost(decorative, 'pub-37d64fe618584c2981a88610a55dd439.r2.dev'),
    false,
    'the host merely appearing inside another source\'s path must not count as present',
  );
});
