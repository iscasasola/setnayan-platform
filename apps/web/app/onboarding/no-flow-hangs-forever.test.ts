/**
 * no-flow-hangs-forever.test.ts — the last button must always come back.
 *
 * ─── THE BUG, TWICE ────────────────────────────────────────────────────────
 * Owner, 2026-06-03, on the wedding flow: *"never loaded"*. She pressed finish,
 * the overlay went up, and it never came down. Cause: the awaited server action
 * REJECTED — a 500, a serverless timeout, a dropped RSC transport on a wobbly
 * mobile connection — and the rejection escaped an async click handler with no
 * `catch`. The pending flag is only cleared on the paths BELOW the await, so it
 * stayed locked: a disabled button reading "Creating…" with no error and
 * nothing to tap. **React error boundaries do not catch an unhandled rejection
 * from an async onClick**, so nothing threw, nothing logged, nothing noticed.
 *
 * It was fixed in the wedding shell that day. 🔑 **AND NOT SWEPT.** The generic
 * flow — which serves EVERY OTHER event type: birthday, debut, christening,
 * anniversary, corporate, reunion — carried the identical defect until
 * 2026-08-15, at the end of a NINETEEN-SCREEN flow. The most expensive possible
 * place to lose somebody, on the types the product is trying to grow into.
 *
 * ─── WHY A GUARD AND NOT JUST THE FIX ──────────────────────────────────────
 * 🔑 A FIX APPLIED TO ONE ROUTE AND NOT ITS SIBLINGS IS HALF A FIX
 * ([[feedback_sweep_every_route_with_that_shape]]). This file holds the FAMILY,
 * not the instance, so a third flow written next month is covered on the day it
 * appears rather than after the next owner report.
 *
 * ─── WHAT COUNTS AS A MEMBER OF THE FAMILY ─────────────────────────────────
 * A component that manages its OWN pending flag around an awaited commit. A
 * `<form action={serverAction}>` is NOT one — React owns that pending state and
 * re-enables the form itself, which is why `create-event/_components/
 * event-type-picker.tsx` and `onboarding/simple/page.tsx` are deliberately not
 * listed. Swept 2026-08-15: exactly two files match the shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every flow that awaits a commit behind a pending flag it owns itself. */
const FLOWS = [
  {
    name: 'the wedding flow',
    file: join(HERE, 'wedding', '_components', 'onboarding-shell.tsx'),
    /** The awaited call whose rejection used to strand the customer. */
    commit: /await\s+commitOnboardingWedding\s*\(|await\s+commitOnboardingEvent\s*\(/,
    /** What must be cleared when it rejects, so the button comes back. */
    unwind: /setCommitting\(false\)|setFinishing\(false\)/,
  },
  {
    name: 'every other event type',
    file: join(HERE, '[type]', '_components', 'generic-onboarding.tsx'),
    commit: /await\s+commitOnboardingEvent\s*\(/,
    unwind: /setCommitting\(false\)/,
  },
] as const;

const code = (p: string) => stripComments(readFileSync(p, 'utf8'));

/**
 * The balanced `{…}` block starting at `open` (the index OF the brace).
 *
 * 🪤 WRITTEN AFTER THE REGEX VERSION CRIED WOLF ON CORRECT CODE. The first cut
 * ended a catch body at `/\n\s{0,6}\}/`, which the `void trackFailure({ … });`
 * call inside that very body satisfies — so the body was truncated before
 * `setCommitting(false)` and both flows were reported broken while both were
 * fine. A guard that fires on correct code teaches you to skim past the one
 * time it is right, so this counts braces instead of guessing at indentation.
 */
function block(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return '';
}

/** The `catch` body of every `try` whose own body contains `needle`. */
function catchBodiesGuarding(src: string, needle: RegExp): string[] {
  const out: string[] = [];
  const tryRe = /\btry\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = tryRe.exec(src))) {
    const open = m.index + m[0].length - 1;
    const body = block(src, open);
    if (!needle.test(body)) continue;
    // Walk past the try block's closing brace to its `catch (…) {`.
    const after = src.slice(open + body.length + 2);
    const c = /^\s*catch\s*(?:\([^)]*\))?\s*\{/.exec(after);
    if (!c) continue;
    out.push(block(after, c[0].length - 1));
  }
  return out;
}

test('the anchor: every flow this guard reasons about exists', () => {
  for (const f of FLOWS) {
    assert.ok(
      existsSync(f.file) && readFileSync(f.file, 'utf8').length > 500,
      `${f.file} is missing or a stub — every assertion below would pass vacuously.`,
    );
  }
});

for (const flow of FLOWS) {
  test(`${flow.name}: the awaited commit sits inside a try`, () => {
    const src = code(flow.file);

    // The commit must actually still be there — otherwise this guard is
    // asserting something about a call that no longer exists.
    assert.match(
      src,
      flow.commit,
      'The awaited commit call is gone. If it moved, move this guard with it — ' +
        'do not delete the assertion.',
    );

    /*
      🪤 ANCHORED ON THE SLICE BETWEEN `try {` AND `} catch`, not on the file
      containing both words. A file-level "has a try and has a catch" match is
      satisfied by the UNRELATED `try { localStorage.removeItem(...) } catch {}`
      that already sat in the success path of the broken version — which is
      exactly how this defect read as handled for two months.
    */
    assert.ok(
      catchBodiesGuarding(src, flow.commit).length > 0,
      `${flow.name}: the awaited commit is NOT inside a try/catch. A rejected ` +
        'server action escapes an async click handler, the pending flag never ' +
        'clears, and the final button stays disabled on "Creating…" forever ' +
        'with no error and no retry (owner report 2026-06-03: "never loaded").',
    );
  });

  test(`${flow.name}: the catch gives the button back`, () => {
    const src = code(flow.file);
    /*
      Catching is not enough — a catch that swallows leaves the same dead
      button. The handler must UNWIND the pending flag. Anchored on the catch
      BODY that contains the commit's own try.
    */
    const bodies = catchBodiesGuarding(src, flow.commit);

    assert.ok(bodies.length > 0, 'No catch body found for the commit try.');
    assert.ok(
      bodies.some((b) => flow.unwind.test(b)),
      `${flow.name}: the catch does not clear the pending flag, so the button ` +
        'stays disabled even though the failure was caught. A caught hang is ' +
        'still a hang.',
    );
  });
}

test('a form-action flow is deliberately NOT in this list', () => {
  /*
    Guarding the wrong files is its own failure — a guard that cries wolf
    teaches you to skim past the one time it is right. These two commit through
    `<form action={...}>`, where React owns the pending state and re-enables the
    form on rejection. If either is ever converted to an imperative async
    handler with its own flag, it JOINS `FLOWS` above.
  */
  for (const p of [
    join(HERE, 'simple', 'page.tsx'),
    join(HERE, '..', 'dashboard', '(account)', 'create-event', '_components', 'event-type-picker.tsx'),
  ]) {
    const src = code(p);
    assert.match(
      src,
      /action=\{(commitSimpleEvent|createWeddingEvent)\}/,
      `${p} no longer commits through a form action. If it now manages its own ` +
        'pending flag around an await, add it to FLOWS — it can hang the same way.',
    );
  }
});
