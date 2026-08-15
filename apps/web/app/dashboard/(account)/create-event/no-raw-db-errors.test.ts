/**
 * no-raw-db-errors.test.ts — the database never speaks to the customer.
 *
 * ─── WHAT A PERSON HIT ─────────────────────────────────────────────────────
 * Any refusal the product had not specifically anticipated was printed to the
 * customer exactly as Postgres wrote it — English about rows violating check
 * constraints, or a duplicate key, in a red box on a wedding-planning site. It
 * told them nothing they could act on and read as a broken product rather than
 * a rule they could satisfy.
 *
 * Two halves, and BOTH had to be wrong for it to happen:
 *   1 · the server action redirected with `?error=<the raw DB message>`;
 *   2 · the page rendered `ERROR_COPY[code] ?? code` — falling back to printing
 *       the code itself, which WAS the message.
 *
 * 🔑 A QUERY STRING IS NOT A PRIVATE CHANNEL. Beyond the bad copy, the raw
 * message travelled through the URL — browser history, the referrer of anything
 * the page loads, any analytics that records URLs. Constraint names, column
 * names, sometimes values. The message belongs in the server log.
 *
 * ─── WHY BOTH HALVES ARE GUARDED ───────────────────────────────────────────
 * Fixing only the actions leaves the render fallback armed for the next author
 * who adds a redirect; fixing only the render leaves the leak in the URL. So
 * this holds the ACTIONS (no raw message may leave) and the PAGES (no unknown
 * code may render itself).
 *
 * ⚠ SCOPE, DELIBERATE: the `/admin/*` actions still redirect with real
 * messages, and that is left alone — an operator debugging a queue is the one
 * audience for whom the database's own sentence is the useful answer. This file
 * covers the CUSTOMER-facing create paths only. Named, not forgotten.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const ONBOARDING = join(HERE, '..', '..', '..', 'onboarding');

/** The customer-facing paths that create an event. */
const ACTIONS = [
  { name: 'create-event', file: join(HERE, 'actions.ts') },
  { name: 'simple event', file: join(ONBOARDING, 'simple', 'actions.ts') },
];

const PAGES = [
  { name: 'create-event picker', file: join(HERE, 'page.tsx') },
  { name: 'simple event form', file: join(ONBOARDING, 'simple', 'page.tsx') },
];

const code = (p: string) => stripComments(readFileSync(p, 'utf8'));

/**
 * The balanced `{…}` body of every `if (<cond>) {` in `src`.
 *
 * 🪤 THIS REPLACED A FIXED 900-CHARACTER WINDOW THAT CRIED WOLF ON CORRECT
 * CODE. `stripComments` blanks a comment IN PLACE — it preserves offsets by
 * substituting spaces — so the explanatory docblock inside the branch consumed
 * ~600 of those 900 characters and pushed the very string being asserted to
 * index 1150. The fix was correct; the guard measured a window instead of a
 * block. **Never slice source by a character count.**
 */
function branchBodies(src: string, cond: RegExp): string[] {
  const out: string[] = [];
  const re = new RegExp(cond.source, cond.flags.replace('g', '') + 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = src.indexOf('{', m.index + m[0].length - 1);
    if (open < 0) continue;
    let depth = 0;
    for (let i = open; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          out.push(src.slice(open + 1, i));
          break;
        }
      }
    }
  }
  return out;
}

test('the anchor: every file this guard reasons about exists', () => {
  for (const f of [...ACTIONS, ...PAGES]) {
    assert.ok(
      existsSync(f.file) && readFileSync(f.file, 'utf8').length > 500,
      `${f.file} is missing or a stub — every assertion below would pass vacuously.`,
    );
  }
});

for (const a of ACTIONS) {
  test(`${a.name}: no database message is put into a URL`, () => {
    const src = code(a.file);
    /*
      Anchored on the ACT — interpolating something ending in `.message` into a
      redirect target — not on the word "message" appearing in the file. Catches
      `encodeURIComponent(err.message)`, the `'prefix: ' + err.message` form the
      member-link failures used, and a bare `${insertError.message}`.
    */
    const leaks = [...src.matchAll(/redirect\(\s*[`'"][^`'"]*\$\{[^}]*\}/g)]
      .map((m) => m[0])
      .filter((m) => /\.message\b/.test(m));
    assert.deepEqual(
      leaks,
      [],
      `${a.name}: a redirect carries a raw database message. Send a stable code ` +
        'and console.error the real message instead — the URL reaches browser ' +
        'history, referrers and analytics, and the page may print it verbatim.',
    );
  });

  test(`${a.name}: a failed member link rolls the event back`, () => {
    const src = code(a.file);
    /*
      🚨 THE EVENT EXISTS BEFORE THE OWNER LINK DOES. If the link fails and we
      only redirect, the row survives owned by nobody — unreachable, because the
      dashboard admits members and there are none. Then "please try again"
      mints a SECOND one. A forward step that cannot be undone is half a step.
    */
    const memberFailures = branchBodies(src, /if \(memberError\)\s*\{/);
    assert.ok(
      memberFailures.length > 0,
      'No member-link failure branch found — did the shape change?',
    );
    for (const [i, body] of memberFailures.entries()) {
      assert.match(
        body,
        /\.from\('events'\)\s*\.delete\(\)/,
        `${a.name}: member-link failure #${i + 1} does not delete the event it ` +
          'just created. Retrying then creates another event nobody owns.',
      );
      assert.match(
        body,
        /create_incomplete/,
        `${a.name}: member-link failure #${i + 1} does not distinguish a FAILED ` +
          'rollback. If the orphan survives, the customer must not be told to ' +
          'try again — that is the one instruction that duplicates it.',
      );
    }
  });
}

for (const p of PAGES) {
  test(`${p.name}: an unrecognised code never renders itself`, () => {
    const src = code(p.file);
    /*
      The whole defect was one `??`. `ERROR_COPY[x] ?? x` prints whatever
      arrived — which was the database's sentence. The fallback must be a
      written constant or a string literal, never the lookup key.
    */
    const fallbacks = [...src.matchAll(/ERROR_COPY\[([A-Za-z0-9_.]+)\]\s*\?\?\s*([A-Za-z0-9_.]+)/g)];
    for (const m of fallbacks) {
      assert.notEqual(
        m[2],
        m[1],
        `${p.name}: falls back to rendering the error CODE itself (\`${m[0]}\`). ` +
          'That value is the raw database message. Fall back to written copy.',
      );
    }
    assert.match(
      src,
      /ERROR_COPY\[[^\]]+\]\s*\?\?\s*(?:GENERIC_ERROR|'|"|`|\n)/,
      `${p.name}: expected an ERROR_COPY lookup with a written fallback.`,
    );
  });
}
