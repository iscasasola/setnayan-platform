/**
 * A COUPLE'S CREDIT BALANCE IS NOT A GUEST'S BUSINESS (owner-locked, PRIV-1).
 *
 * ── WHAT WAS TRUE BEFORE THIS GUARD ─────────────────────────────────────────
 * Three surfaces printed the celebration's remaining Papic credits to somebody
 * who is NOT a member of that celebration:
 *
 *   1 · /papic/seat/[token]        — "Running low — about 412 credits left for
 *                                     this event." The page's own comment says
 *                                     "The claimer isn't an event member"; a
 *                                     seat token is what a guest is handed at
 *                                     the table.
 *   2 · /papic/guest               — "412 left for everyone", to a visitor whose
 *                                     entire identity is the setnayan_guest_
 *                                     session cookie. No sign-in at all.
 *   3 · /[slug]                    — the SAME component, mounted inline on the
 *                                     public celebration page.
 *
 * The owner's ruling: a credit balance shown to a stranger must be hidden — it
 * is the couple's money.
 *
 * ── WHY THIS GUARD ASSERTS ON THE SHAPE AND NOT ONLY ON THE JSX ─────────────
 * 🔑 THE PIXELS WERE NEVER THE WHOLE LEAK. On (2) and (3) the figure was a prop
 * on a client component, so it was serialized into the RSC payload of a public
 * page on EVERY render — healthy pot or low one, drawn or not — and readable
 * from view-source on the days the pill never appeared. On (1) it came back in
 * the server-action response on every successful capture. Deleting the `{…}`
 * would have moved the disclosure from the screen to the network tab.
 *
 * So the load-bearing assertion here is: NO POOL-SHAPED NUMBER MAY ENTER THESE
 * SURFACES AT ALL. Four shapes sit on the path — `EventPoolSignal`,
 * `GuestQuota`, `GuestPapicCamera`, and the camera's own `Props` — and each may
 * carry exactly one pool field, `soft`/`poolLow`, which is a boolean. A figure
 * that cannot arrive cannot be printed, by any future edit to any JSX.
 *
 * ── AND THE WARNING IS NOT THE BALANCE ──────────────────────────────────────
 * "Running low" stays on all three surfaces and is asserted present below. A
 * guest needs to know to wind down; that is theirs. How much money the couple
 * has left is not. Every test here would still pass if the warning were the
 * only thing that ever appeared, and FAIL if the warning were deleted — the two
 * halves are pinned separately on purpose, so "fixing" a red by removing the
 * warning is not available.
 *
 * ── ⚠ NOT AN ORACLE ─────────────────────────────────────────────────────────
 * The figure is removed UNCONDITIONALLY, never suppressed while the pot is low.
 * A number withheld only in one state makes its own absence the answer — the
 * reader infers "healthy" from the silence and the disclosure survives as an
 * inference. `no pool figure exists in either state` below is that property,
 * asserted as a property rather than asserted twice.
 *
 * ── WHO STILL SEES THE REAL NUMBER ──────────────────────────────────────────
 * The couple and their coordinator, on /dashboard/[eventId]/studio/papic, which
 * is theirs. `couple-challenges-manager.tsx`, `papic-pool-card.tsx` and
 * `papic-standings.ts` are deliberately NOT in the table below. ⛔ Do not add
 * them — a legitimate reader is not a leak, and pinning one here would be a
 * guard demanding a bug.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();
/** Comment-stripped, ALWAYS: every file here explains the removed figure in
 *  prose, and prose about a banned construct must never satisfy — or trip — a
 *  check about the construct. */
const src = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;

/**
 * The text of every argument list passed to `name(...)`, by paren balancing.
 *
 * A regex cannot do this: the arguments here are template literals containing
 * their own punctuation. Balancing is what lets the seat test assert about the
 * SENTENCE rather than about the line it happens to sit on.
 */
function callArgs(source: string, name: string): string[] {
  const out: string[] = [];
  const open = new RegExp(`\\b${name}\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = open.exec(source))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      i += 1;
    }
    out.push(source.slice(start, i - 1));
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════
// 1 · THE SHAPES — a figure that cannot arrive cannot be printed
// ═════════════════════════════════════════════════════════════════════════

/**
 * Each row: the shape, where it lives, how its block opens, and the single
 * pool field it is allowed to carry.
 *
 * ⚠ ANCHORED PER SHAPE, NOT PER FILE. A file-level match cannot say WHICH
 * declaration reintroduced a figure, and three of these files legitimately
 * mention pool numbers elsewhere (`remainingPoints` is read in both producers
 * and deliberately not forwarded). The window is the declaration's own braces.
 *
 * 🪤 AND `forbids` IS PER ROW BECAUSE A FLAT "NO NUMBERS" RULE IS WRONG HERE.
 * Three of these shapes carry `total: number` and `remaining: number` — the
 * READER'S OWN allowance, her 150 or the ceiling the couple set on her. Those
 * are hers and PRIV-1 does not touch them; a guard that banned them would be
 * demanding a second privacy bug pointed at the guest. Only `EventPoolSignal`,
 * whose every field is about the pot, forbids numbers outright.
 */
/** Every field of a pot-only shape is about the pot, so any number is a figure. */
const ANY_NUMBER = /\b[A-Za-z]+\??\s*:\s*number\b/g;
/** In a shape that also carries the GUEST'S own numbers, only pot-scoped names. */
const POT_NUMBER = /\b(?:pool[A-Za-z]*|[a-z][A-Za-z]*Points)\??\s*:\s*number\b/g;

const SHAPES = [
  {
    surface: 'the seat camera’s wire shape (EventPoolSignal · app/papic/actions.ts)',
    file: ['app', 'papic', 'actions.ts'],
    opens: /export type EventPoolSignal = \{/,
    keeps: /\bsoft\s*:\s*boolean\b/,
    keepsLabel: 'soft: boolean',
    forbids: ANY_NUMBER,
  },
  {
    surface: 'the guest camera’s server shape (GuestQuota · lib/papic-guest.ts)',
    file: ['lib', 'papic-guest.ts'],
    opens: /export type GuestQuota = \{/,
    keeps: /\bpoolLow\s*:\s*boolean\b/,
    keepsLabel: 'poolLow: boolean',
    forbids: POT_NUMBER,
  },
  {
    surface: 'the inline camera’s shape (GuestPapicCamera · app/[slug]/_lib/types.ts)',
    file: ['app', '[slug]', '_lib', 'types.ts'],
    opens: /export type GuestPapicCamera = \{/,
    keeps: /\bpoolLow\s*:\s*boolean\b/,
    keepsLabel: 'poolLow: boolean',
    forbids: POT_NUMBER,
  },
  {
    surface:
      'the guest camera’s props (Props · app/papic/guest/_components/papic-guest-capture.tsx)',
    file: ['app', 'papic', 'guest', '_components', 'papic-guest-capture.tsx'],
    opens: /\btype Props = \{/,
    keeps: /\bpoolLow\?:\s*boolean\b/,
    keepsLabel: 'poolLow?: boolean',
    forbids: POT_NUMBER,
  },
] as const;

/**
 * The declaration's own body, brace-balanced from its opening `{`.
 *
 * 🪤 NOT "to the next blank line" and NOT "to the next export". Both were
 * available and both face the wrong way: a window that runs past the closing
 * brace starts asserting about the NEXT declaration's fields, and a window that
 * stops short cannot see a field appended at the bottom — which is exactly
 * where a field gets appended.
 */
function block(source: string, opens: RegExp, surface: string): string {
  const m = opens.exec(source);
  assert.ok(m, `${surface}: that declaration is gone — repoint this guard, do not delete it`);
  let i = source.indexOf('{', m!.index);
  const start = i + 1;
  let depth = 1;
  i += 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    i += 1;
  }
  assert.equal(depth, 0, `${surface}: the declaration's braces never close`);
  return source.slice(start, i - 1);
}

for (const shape of SHAPES) {
  test(`no pool FIGURE may enter ${shape.surface}`, () => {
    const body = block(src(...shape.file), shape.opens, shape.surface);

    // The warning must survive. Without this, deleting the whole pool field is
    // a way to make the negative assertion below pass, and a guest would lose
    // the one thing about the pot that IS theirs to know.
    assert.match(
      body,
      shape.keeps,
      `${shape.surface}: lost ${shape.keepsLabel} — the "running low" warning is the ` +
        'half a guest is entitled to; do not remove it to satisfy PRIV-1',
    );

    // The leak, in the only form it can take: a pot-scoped member typed as a
    // number. Counted and reported, so a red says how many came back.
    const figures = body.match(shape.forbids) ?? [];
    assert.deepEqual(
      figures,
      [],
      `${shape.surface}: ${figures.length} pool figure(s) back on the wire ` +
        `(${figures.join(' · ')}) — PRIV-1: that balance is the couple's money and this ` +
        'shape is read by someone who is not a member of the event',
    );
  });
}

// ═════════════════════════════════════════════════════════════════════════
// 2 · THE RENDERS — per surface, and the mounts that feed them
// ═════════════════════════════════════════════════════════════════════════

test('the seat camera warns without naming the balance', () => {
  const S = 'the seat camera (/papic/seat/[token])';
  const s = src('app', 'papic', 'seat', '[token]', '_components', 'papic-seat-capture.tsx');

  // The soft-stop branch is still here — exactly one of it.
  assert.equal(
    count(s, /result\.eventPool\?\.soft/g),
    1,
    `${S}: expected exactly 1 soft-stop branch — the warning must stay, and two ` +
      'branches means one of them is unreviewed',
  );

  // Nothing may reach for a figure off the signal. (The shape test above makes
  // this unconstructible; this says so at the READ site too, because that is
  // where a reviewer looks.)
  const reaches = s.match(/eventPool[\s\S]{0,40}?\.(remaining|total)\b/g) ?? [];
  assert.deepEqual(
    reaches,
    [],
    `${S}: reads a pool figure off the capture result (${reaches.join(' · ')}) — PRIV-1`,
  );

  // The sentence itself: every notice it sets is a fixed string with no
  // interpolation and no digits. This is the assertion the sabotage faces.
  const notices = callArgs(s, 'setPoolNotice').filter((a) => a.trim() !== 'null');
  assert.ok(
    notices.length >= 1,
    `${S}: nothing sets a pool notice any more — the warning was removed, not the figure`,
  );
  for (const arg of notices) {
    assert.doesNotMatch(
      arg,
      /\$\{/,
      `${S}: a pool notice interpolates a value — PRIV-1 forbids a figure here: ${arg.trim()}`,
    );
    assert.doesNotMatch(
      arg,
      /\d/,
      `${S}: a pool notice contains a digit — PRIV-1 forbids a figure here: ${arg.trim()}`,
    );
  }
});

test('the guest camera warns without naming the balance', () => {
  const S = 'the guest camera (/papic/guest and the inline camera on /[slug])';
  const s = src('app', 'papic', 'guest', '_components', 'papic-guest-capture.tsx');

  // The pot branch is still here — exactly one of it. `capApplies`'s branch is
  // a DIFFERENT counter (the reader's OWN allowance) and is untouched by PRIV-1.
  // ⚠ THE FIGURE CHECK GOES FIRST, DELIBERATELY. Restoring the balance also
  // rewrites the branch's condition (`poolLow ?` becomes `poolLow &&
  // poolRemaining != null ?`), so the count assertion below fires too — and its
  // message says "the warning must stay", which is not what went wrong. Ordered
  // this way the red names the actual defect instead of a symptom of it.
  const figures = s.match(/\bpoolRemaining\b/g) ?? [];
  assert.deepEqual(
    figures,
    [],
    `${S}: ${figures.length} reference(s) to the pot's balance are back — PRIV-1: this ` +
      "component's reader is a guest on a cookie, never an event member",
  );

  // 🪤 ANCHOR ON THE TERNARY'S `(`, NOT ON THE BARE NAME. `poolLow?: boolean` in
  // the Props type also reads `poolLow ?` to a regex, so the naive pattern
  // counted 2 and the "exactly 1" would have been satisfied by the DECLARATION
  // plus a deleted branch.
  assert.equal(
    count(s, /:\s*poolLow\s*\?\s*\(/g),
    1,
    `${S}: expected exactly 1 "pot is running low" branch — the warning must stay`,
  );

  // The reader's own number is NOT the couple's money and must survive. Without
  // this, blanking the whole header would turn every assertion above green.
  assert.match(
    s,
    /\{low \? `Running low — \$\{remaining\} left` : `\$\{remaining\} left`\}/,
    `${S}: the guest's PERSONAL counter is gone. That number is the reader's own ` +
      'allowance, not the couple\'s balance — PRIV-1 does not touch it',
  );
});

const MOUNTS = [
  {
    surface: 'the standalone guest camera (app/papic/guest/page.tsx)',
    file: ['app', 'papic', 'guest', 'page.tsx'],
  },
  {
    surface: 'the inline camera on the public page (app/[slug]/_components/site-body.tsx)',
    file: ['app', '[slug]', '_components', 'site-body.tsx'],
  },
  {
    surface: 'the loader that feeds the inline camera (app/[slug]/_lib/loaders.ts)',
    file: ['app', '[slug]', '_lib', 'loaders.ts'],
  },
] as const;

for (const mount of MOUNTS) {
  test(`${mount.surface} hands over the warning and not the balance`, () => {
    const s = src(...mount.file);
    assert.match(
      s,
      /poolLow[=:]/,
      `${mount.surface}: stopped passing poolLow — the warning is the half a guest keeps`,
    );
    const figures = s.match(/poolRemaining/g) ?? [];
    assert.deepEqual(
      figures,
      [],
      `${mount.surface}: ${figures.length} reference(s) to the pot's balance are back — PRIV-1`,
    );
  });
}

// ═════════════════════════════════════════════════════════════════════════
// 3 · THE PROPERTY — sealed and unsealed must be indistinguishable
// ═════════════════════════════════════════════════════════════════════════

test('no pool figure exists in either state, so absence is not an answer', () => {
  // ⚠ THE FIX THAT WOULD HAVE BEEN WRONG: hide the number while the pot is low
  // and leave it otherwise (or the reverse). The reader then learns the pot's
  // state from whether a number is there — a disclosure traded for an
  // inference, which is the same leak wearing a different shape.
  //
  // The property that rules it out is structural: the guest camera's only pool
  // input is a BOOLEAN, and the seat camera's notice is a FIXED STRING. Neither
  // has a number available in ANY state, so the low render and the healthy
  // render differ by the presence of the warning alone — which is the fact the
  // owner agreed a guest may have.
  const guest = src('app', 'papic', 'guest', '_components', 'papic-guest-capture.tsx');
  const guestProps = block(guest, /\btype Props = \{/, 'the guest camera');
  const poolInputs = guestProps.match(/\bpool[A-Za-z]*\??\s*:\s*[^;\n]+/g) ?? [];
  assert.deepEqual(
    poolInputs.map((p) => p.trim()),
    ['poolLow?: boolean'],
    'the guest camera takes a pool input that is not the single boolean warning — ' +
      `got ${poolInputs.length}: ${poolInputs.join(' · ')}`,
  );

  const seat = src('app', 'papic', 'seat', '[token]', '_components', 'papic-seat-capture.tsx');
  const signal = block(
    src('app', 'papic', 'actions.ts'),
    /export type EventPoolSignal = \{/,
    'the seat camera',
  );
  const signalFields = signal.match(/\b[A-Za-z]+\??\s*:\s*[^;\n]+/g) ?? [];
  assert.deepEqual(
    signalFields.map((f) => f.trim()),
    ['soft: boolean'],
    'the seat capture result carries something other than the single boolean warning — ' +
      `got ${signalFields.length}: ${signalFields.join(' · ')}`,
  );
  // And the seat's own notice does not vary by a figure it could still compute.
  assert.doesNotMatch(
    seat,
    /setPoolNotice\([^)]*toLocaleString/,
    'the seat camera formats a number into its pool notice again — PRIV-1',
  );
});
