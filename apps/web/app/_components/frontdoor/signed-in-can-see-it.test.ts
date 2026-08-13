import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A SIGNED-IN VISITOR MAY SEE THE FRONT DOOR.
 *
 * Owner 2026-08-13, after the sign-in destination was already fixed: "still
 * directed here". #4424 fixed where a SIGN-IN sends you; the middleware then
 * sent you away again on the very next request — `if (user && pathname === '/')
 * redirect('/dashboard')` — and on every later visit to `/` while signed in.
 *
 * IT ALSO MADE FINISHED WORK UNREACHABLE: front-door-shell.tsx carries four
 * `account.signedIn` branches (My Home with Events + Alaala, the Marketplace
 * group, the account cluster) and none of them could ever render.
 *
 * Its justification had expired: it kept `/` "fully static" while `/` was the
 * marketing homepage that "does not read the session at all". The front door
 * reads the session by construction, so the static render it protected no
 * longer existed.
 *
 * ⚠ A SOURCE SCAN, DELIBERATELY. middleware.ts is not importable by the unit
 * runner (it pulls the Next request/response runtime and a Supabase server
 * client). The property that matters is a SHAPE — "nothing redirects an
 * authenticated request away from `/`" — and a scan holds a shape. It cannot
 * prove the request succeeds, so it is paired with a non-triviality assertion:
 * point a file-reading guard at the wrong path and it reads nothing and passes
 * forever.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..');
const MIDDLEWARE = join(APP, '..', 'middleware.ts');
const SHELL = join(HERE, 'front-door-shell.tsx');

/** Strip comments — the note explaining a removed redirect quotes the redirect,
 *  and a scan that reads prose finds the thing it bans in the sentence saying
 *  it is gone. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n');
}

test('the files exist and are non-trivial — the guard cannot silently read nothing', () => {
  for (const path of [MIDDLEWARE, SHELL]) {
    assert.ok(
      readFileSync(path, 'utf8').length > 1000,
      `${path} is missing or a stub. A guard pointed at the wrong file passes forever.`,
    );
  }
});

test('middleware does not bounce an authenticated request away from "/"', () => {
  const src = code(readFileSync(MIDDLEWARE, 'utf8'));
  assert.ok(
    !/user\s*&&\s*pathname\s*===\s*['"]\/['"]/.test(src),
    'middleware.ts redirects a signed-in visitor off "/". That makes the front ' +
      "door's signed-in state unreachable — the owner reported it as \"still " +
      'directed here\" AFTER the sign-in destination was fixed, because the two ' +
      'are different layers and only one had been corrected.',
  );
  assert.ok(
    !/pathname\s*===\s*['"]\/['"][\s\S]{0,120}?redirect\(\s*new URL\(\s*['"]\/dashboard/.test(src),
    'middleware.ts still sends "/" to /dashboard. `/` is the front door and it ' +
      'has a signed-in state; sending members away is what this guard exists to stop.',
  );
});

test('the front door still HAS a signed-in state worth reaching', () => {
  const src = code(readFileSync(SHELL, 'utf8'));
  const branches = src.match(/account\.signedIn/g)?.length ?? 0;
  assert.ok(
    branches >= 3,
    `front-door-shell.tsx has ${branches} signed-in branches. If this drops, the ` +
      'reason the middleware bounce was removed has gone with it — either the ' +
      'signed-in front door is being dismantled, or this guard is pointed at the ' +
      'wrong file.',
  );
});
