import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * WHERE A SIGN-IN LANDS YOU — and the two doors agreeing about it.
 *
 * Owner, 2026-08-13, having signed in and arrived in the ops console: "i thought
 * that once we log in, it still looks like the public website, but we have added
 * sidebar". That is what the approved drawing shows, and the in-place panel
 * (_components/auth/sign-in-here-panel.tsx → router.refresh()) already does it.
 *
 * The WHOLE-PAGE doors did not. Both rewrote an absent-or-`/` destination to
 * `/dashboard` and then handed it to accountHomePath(), so a cold sign-in went
 * vendor → /vendor-dashboard · admin → /admin · else /dashboard, and never back
 * to the page you started on.
 *
 * That rule was correct when it was written: `/` was the ELN cinematic homepage,
 * which had NOTHING for a signed-in person. `/` became the front door on
 * 2026-08-13 and grew a signed-in state, so the premise expired.
 *
 * ⚠ WHY THIS IS A SOURCE SCAN AND NOT A BEHAVIOUR TEST. Both destinations are
 * computed inside a server action / route handler that exchanges credentials
 * with Supabase — neither is importable by the unit runner without a live
 * session. The property that actually matters is a SHAPE ("neither door rewrites
 * `/` away, and neither picks a destination by account type"), and a scan can
 * hold that shape. It cannot prove the redirect fires, so it is deliberately
 * paired with the two assertions below that pin the FILES rather than trusting
 * the walk — point a file-walking guard at the wrong path and it scans nothing
 * and passes forever.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..');

const DOORS = [
  join(APP, 'login', 'actions.ts'),
  join(APP, 'auth', 'callback', 'route.ts'),
] as const;

/** Strip comments — the explanation of a retired rule quotes the rule itself,
 *  and a scan that reads prose finds the thing it is banning in the note that
 *  says it was removed. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n');
}

test('both sign-in doors exist and are non-trivial — the walk cannot silently scan nothing', () => {
  for (const path of DOORS) {
    const raw = readFileSync(path, 'utf8');
    assert.ok(
      raw.length > 500,
      `${path} is missing or a stub. A guard pointed at the wrong file passes forever.`,
    );
  }
});

test('neither door rewrites an absent-or-"/" destination to /dashboard', () => {
  for (const path of DOORS) {
    const src = code(readFileSync(path, 'utf8'));
    assert.ok(
      !/rawNext\s*===\s*['"]\/['"]\s*\?/.test(src),
      `${path} still rewrites the destination when next is "/". Signing in from ` +
        `the front door must return to the front door — safeNext() already ` +
        `collapses an absent or unsafe next to "/", so this branch is the one ` +
        `that used to throw the owner into the ops console.`,
    );
  }
});

test('neither door picks a destination by account type', () => {
  for (const path of DOORS) {
    const src = code(readFileSync(path, 'utf8'));
    assert.ok(
      !/accountHomePath\s*\(/.test(src),
      `${path} calls accountHomePath() in its destination path. next must win ` +
        `for every origin. accountHomePath itself is NOT retired — callers that ` +
        `genuinely want an account home still use it — but a sign-in door is ` +
        `not one of them.`,
    );
  }
});

test('the two doors agree — a difference is two answers to one question', () => {
  const shapes = DOORS.map((path) => {
    const src = code(readFileSync(path, 'utf8'));
    return {
      rewrites: /rawNext\s*===\s*['"]\/['"]\s*\?/.test(src),
      byAccountType: /accountHomePath\s*\(/.test(src),
    };
  });
  assert.deepEqual(
    shapes[0],
    shapes[1],
    'The password door and the OAuth callback disagree about where a sign-in ' +
      'lands. Fix both or neither — this repo has already paid for one surface ' +
      'answering a question differently from another (the wizard previewing a ' +
      'safe address while the mint handed out a colliding one).',
  );
});
