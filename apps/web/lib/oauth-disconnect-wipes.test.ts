import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A revoked OAuth grant must never still hold the key.
 *
 * WHY THIS EXISTS. The wipe-on-disconnect was added to the YouTube route on
 * 2026-07-27 and NOT to the Drive route, which went on setting `revoked_at`
 * alone for eleven days. Its comment even argued that was sufficient, because
 * revoked_at is "the source of truth for whether we'll ever use this token
 * again" — the wrong test. The question is not whether WE would use it; it is
 * whether we are still holding a key to someone's Google account after they
 * asked us to let go. Live prod carried exactly that: a grant revoked
 * 2026-07-26 still holding a 103-char refresh token.
 *
 * 🔑 ONE FACT IN TWO PLACES, AND ONE COPY NEVER GOT THE UPDATE. That is this
 * project's most expensive defect shape, and a third provider route would have
 * repeated it silently. This test is the thing that notices.
 *
 * WHAT IT CHECKS. Source text, not behaviour: any `oauth_grants` /
 * `live_studio_channel_grants` update that sets `revoked_at` must set
 * `refresh_token` and `access_token` in the SAME update object.
 *
 * ⚠ It is deliberately a UNIT test, not a new `lint-*.mjs`. Wiring a lint
 * script into ci.yml takes three separate edits (the step, the env binding, and
 * the `check` call) and missing any one makes the guard run but never fail the
 * job. `test:unit` is already wired.
 *
 * ⚠ It is also deliberately NOT a db test: the PGlite replay has no production
 * rows, so "no revoked grant holds a token" would pass vacuously there.
 */

// ⚠ SCOPE WAS `app/api/oauth` AND THAT WAS TOO NARROW — it missed
// `app/api/photo-delivery/disconnect/route.ts`, a THIRD route that revokes an
// oauth_grants row and cleared only the short-lived access token, leaving the
// refresh token behind. A guard that scans the folder you expect the code to be
// in will miss the copy that lives somewhere else — which is the same mistake
// the bug itself is. Scan by TABLE NAME across the whole app + lib tree.
const SCAN_DIRS = [join(process.cwd(), 'app'), join(process.cwd(), 'lib')];
// ⚠ THIS LIST WAS TOO SHORT, TWICE. First the SCOPE was wrong (app/api/oauth
// only), which hid two Google routes. Then the TABLE list was wrong: TikTok
// stores its grant in `patiktok_oauth_grants`, so the fifth leaking disconnect
// path was invisible to a guard written the same hour. A hand-typed list of
// tables is silent about the table nobody typed into it — when a new credential
// store appears, it MUST be added here or it is unguarded.
const CREDENTIAL_TABLES = [
  'oauth_grants',
  'live_studio_channel_grants',
  'patiktok_oauth_grants',
];

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Pull every `.update({...})` object literal that mentions `revoked_at`, along
 * with enough preceding text to tell which table it targets. Crude on purpose —
 * a parser would be a second thing to keep in sync.
 */
function revokingUpdates(src: string): string[] {
  const found: string[] = [];
  const re = /\.update\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    // Walk braces from the opening `{` to find the matching close.
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = src.slice(m.index, i + 1);
    if (body.includes('revoked_at')) {
      // 600 chars back is comfortably more than any .from(...).update(...) chain.
      found.push(src.slice(Math.max(0, m.index - 600), i + 1));
    }
  }
  return found;
}

test('a disconnect that revokes an OAuth grant also wipes the credential', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(d));
  // Self-check: a guard that scans nothing passes forever.
  assert.ok(files.length >= 200, `scanned only ${files.length} source files — the paths are wrong`);

  const offenders: string[] = [];
  let checked = 0;

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const chunk of revokingUpdates(src)) {
      const table = CREDENTIAL_TABLES.find((t) => chunk.includes(`'${t}'`));
      if (!table) continue; // revoking something that is not a credential store
      checked++;
      const wipesRefresh = /refresh_token\s*:/.test(chunk);
      const wipesAccess = /access_token\s*:/.test(chunk);
      if (!wipesRefresh || !wipesAccess) {
        offenders.push(
          `${file.replace(process.cwd() + '/', '')} — sets revoked_at on ${table} without ` +
            `${!wipesRefresh ? 'refresh_token' : ''}${!wipesRefresh && !wipesAccess ? ' and ' : ''}` +
            `${!wipesAccess ? 'access_token' : ''}`,
        );
      }
    }
  }

  // Second self-check: if this found no revoking update at all, the matcher is
  // broken and its green means nothing.
  assert.ok(
    checked >= 4,
    `matched only ${checked} credential-revoking updates — expected at least the drive, youtube and ` +
      `photo-delivery disconnect routes. The matcher has drifted; fix it rather than trusting this pass.`,
  );

  assert.deepEqual(
    offenders,
    [],
    'A revoked grant must not still hold the key. Set refresh_token to \'\' (the column is NOT NULL) ' +
      'and access_token to null in the SAME update that sets revoked_at:\n  ' +
      offenders.join('\n  '),
  );
});
