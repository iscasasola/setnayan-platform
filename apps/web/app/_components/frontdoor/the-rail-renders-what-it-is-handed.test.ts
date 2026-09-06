import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { plannerDoorwayRows, togetherDoorwayRows } from '@/lib/studio-rail';

/**
 * THE SHELL RENDERS WHAT IT IS HANDED. IT DOES NOT RE-DECIDE.
 *
 * 🔴 THE INCIDENT THIS GUARD IS MADE OF (2026-09-06, found on the live site).
 * The six free doorway rows — Marketplace, Guest list, Seat plan, Budget,
 * Schedule, Samahan — shipped to production and rendered in NO rail group at
 * all for a signed-out visitor. Every list function was right; every caller was
 * right; the rows reached the shell and the shell threw them away, because its
 * render conditions still read:
 *
 *     account.signedIn && insideEvent && plannerTools.length > 0
 *     account.signedIn && togetherTools.length > 0
 *
 * Those gates were written when the ONLY rows in these slots were the in-event
 * ones, and they were correct then. The doorway rows are gated the OPPOSITE
 * way by construction — `plannerDoorwayRows` returns `[]` INSIDE an event,
 * `togetherDoorwayRows` returns `[]` when SIGNED IN — so the two decisions
 * cancelled to nothing for exactly the strangers the doorways exist to greet.
 * Two of those rows (Marketplace, Guest list) had been visible in Studio the
 * day before, so the change was a net loss for a visitor, not a neutral one.
 *
 * 🔑 WHY NOTHING ELSE CAUGHT IT. A group that renders nothing is
 * indistinguishable from a group with nothing to render. Every unit test of the
 * list functions passed — they returned the right rows. The typechecker was
 * happy — the rows were passed. The only signal was a person opening the site.
 *
 * ⚠ A SOURCE SCAN, DELIBERATELY. `front-door-shell.tsx` is a client component
 * pulling `next/link`, icons and hooks; the unit runner cannot render it and
 * this repo carries no DOM harness. The property that matters is a SHAPE — "the
 * only question asked at the group boundary is *are there rows*" — and a scan
 * holds a shape. It is paired with the behavioural half below (the rows really
 * are non-empty in the state that was broken) and with a non-triviality
 * assertion, because a file-reading guard pointed at the wrong path reads
 * nothing and passes forever.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = join(HERE, 'front-door-shell.tsx');

/** The three group slots whose condition this guard owns. */
const GROUPS = ['plannerTools', 'builderTools', 'togetherTools'] as const;

function shellCode(): string {
  return stripComments(readFileSync(SHELL, 'utf8'));
}

test('the shell exists and is non-trivial — the guard cannot silently read nothing', () => {
  assert.ok(
    readFileSync(SHELL, 'utf8').length > 1000,
    `${SHELL} is missing or a stub. A guard pointed at the wrong file passes forever.`,
  );
});

test('each rail group asks one question: are there rows', () => {
  const src = shellCode();
  for (const group of GROUPS) {
    /*
      The render condition is the JSX guard `{... ? (` that opens the group.
      Matching from the start of the line up to `${group}.length` captures
      everything ANDed in front of it, which is precisely what must be empty.
    */
    const gate = new RegExp(String.raw`\{([^{}\n]*?)${group}\.length\s*>\s*0\s*\?`).exec(src);
    assert.ok(
      gate,
      `No render condition found for \`${group}\` in front-door-shell.tsx. Either ` +
        'the group was removed (in which case delete its entry here and say why) ' +
        'or it is now gated some other way — which is the thing this guard exists ' +
        'to stop.',
    );
    /* `?? ''` because the capture is typed optional under
       `noUncheckedIndexedAccess`; a matched group-1 can only be a string here. */
    const alsoGatedOn = (gate[1] ?? '').trim();
    assert.equal(
      alsoGatedOn,
      '',
      `\`${group}\` is gated on "${alsoGatedOn}" as well as having rows. That is a ` +
        'SECOND copy of a decision the caller already made, and a second copy can ' +
        'only ever disagree with the first. On 2026-09-06 it did: six free doorway ' +
        'rows shipped to production visible to nobody, because the shell demanded ' +
        '`signedIn`/`insideEvent` while the doorway lists are built for exactly the ' +
        'opposite state. If a group truly must not appear somewhere, return `[]` ' +
        'from its list function — that is how the caller says "not here", and it ' +
        'says it in the one place that knows.',
    );
  }
});

test('the doorway rows really are non-empty in the state that was broken', () => {
  /*
    The behavioural half. Without it the scan above could keep passing over an
    empty promise — three ungated groups that are never handed anything.
  */
  const plannerOutsideEvent = plannerDoorwayRows(false);
  assert.ok(
    plannerOutsideEvent.length >= 5,
    `plannerDoorwayRows(false) returned ${plannerOutsideEvent.length} rows. The signed-out ` +
      'Planner group is what the shell fix restored; if it is empty there is nothing ' +
      'left to restore and the ungated render above is meaningless.',
  );
  assert.equal(
    plannerDoorwayRows(true).length,
    0,
    'plannerDoorwayRows still returns rows INSIDE an event. The shell no longer ' +
      'gates on `insideEvent`, so this function is now the only thing stopping the ' +
      'event rail from carrying Marketplace, Guests and Seat plan twice — the ' +
      'doubling the owner ruled out on 2026-09-05.',
  );

  assert.ok(
    togetherDoorwayRows(false).length >= 1,
    'togetherDoorwayRows(false) is empty — the signed-out Samahan doorway is gone.',
  );
  assert.equal(
    togetherDoorwayRows(true).length,
    0,
    'togetherDoorwayRows still returns rows when SIGNED IN. The shell no longer ' +
      'gates on `signedIn`, so this function alone prevents "Samahan groups" ' +
      'appearing twice with the same label and two different destinations.',
  );
});
