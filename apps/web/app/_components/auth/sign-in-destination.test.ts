import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * WHERE A SIGN-IN LANDS YOU — and the two doors agreeing about it.
 *
 * ⚠ THIS FILE WAS REWRITTEN 2026-08-28 AND THE OLD RULE IS THE INTERESTING
 * PART. It used to assert that NEITHER door may rewrite a `/` destination —
 * written 2026-08-13, after the owner signed in and arrived in the ops console:
 * *"i thought that once we log in, it still looks like the public website, but
 * we have added sidebar"*.
 *
 * Owner 2026-08-28: *"when you log in, you should go directly to Events"*. So
 * the bare `/` IS rewritten now, to the Events board. That is not the ops
 * console coming back — HQ is what he objected to, and Events is the board he
 * has now asked for by name — and every OTHER origin is still honoured exactly
 * as it was, which is the half of the 2026-08-13 rule that survives untouched.
 *
 * 🔑 IT IS ASSERTED AS A CALL TO ONE SHARED RULE, NOT AS A SHAPE. The old
 * version banned the regex `rawNext === '/' ?`, and `lib/sign-in-landing.ts`
 * would have sailed straight past it — a guard passing while the behaviour it
 * guards is reversed. Requiring the CALL means a door that stops honouring the
 * rule, by any spelling, fails here.
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

test('both doors resolve their destination through the one shared rule', () => {
  for (const path of DOORS) {
    const src = code(readFileSync(path, 'utf8'));
    assert.ok(
      /signInDestination\s*\(/.test(src),
      `${path} no longer calls signInDestination(). Where a sign-in lands is ` +
        `decided in lib/sign-in-landing.ts and nowhere else.`,
    );
    assert.ok(
      !/rawNext\s*===\s*['"]\/['"]\s*\?/.test(src),
      `${path} hand-rolls the "/" branch again. That is how the password door ` +
        `and the OAuth callback became two answers to one question.`,
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
      sharedRule: /signInDestination\s*\(/.test(src),
      handRolled: /rawNext\s*===\s*['"]\/['"]\s*\?/.test(src),
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
