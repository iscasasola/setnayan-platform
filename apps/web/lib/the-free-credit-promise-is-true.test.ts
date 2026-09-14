/**
 * THE FREE-CREDIT PROMISE IS TRUE — /papic may only say what
 * `papic_claim_free_pool()` actually does.
 *
 * ── THE DEFECT (MONEY-1, 2026-09-14) ────────────────────────────────────────
 * The public Papic page told a stranger, in four places, that they get free
 * credits **on every celebration**. Measured against the function running in
 * production, that is technically true and materially false: an ACCOUNT claims
 * the free pool exactly once (`papic_free_grant_claims` PRIMARY KEY on
 * `user_id`, arbitrated by `ON CONFLICT (user_id) DO NOTHING`), the first
 * celebration gets `free_grant_points`, and every celebration after it gets a
 * `free_grant` row worth **1 point** — one photograph, a fencing floor so
 * `papic_event_pool_status()` does not read the event as unmetered.
 *
 * ── WHY A STRING BAN WOULD NOT HAVE BEEN ENOUGH ─────────────────────────────
 * Banning the phrase "every celebration" pins the COPY to itself. It stays
 * green on the day somebody makes the grant per-event and leaves the narrow
 * sentence in place — the copy would then be needlessly modest, which is a
 * smaller fault but the same class: the page and the mechanism disagreeing with
 * nothing to notice. So this file pins BOTH ENDS:
 *
 *   1 · THE MECHANISM, read out of the migration that is live in prod. If the
 *       one-claim-per-account arbiter goes away, or the repeat branch stops
 *       being the 1-point floor, or the switched-off early return disappears,
 *       these tests go red and whoever changed it has to come back for the copy.
 *   2 · THE SENTENCE, resolved through the one pure function both the page and
 *       this file import — so the string a customer reads and the string CI
 *       checks are the same string by construction.
 *   3 · THE SWITCHED-OFF BRANCH, BY RENDER. Not by grep: a source scan cannot
 *       see what a component returns. The three free-credit components are
 *       rendered at `{ kind: 'off' }` and the markup must be EMPTY — not "0
 *       free credits", and (the case that was actually live) not "50 free
 *       credits", which is what the page printed before this build because
 *       `fetchPapicFreeGrantPoints` folds a deliberate 0 onto the seed
 *       fallback. The page's existing `free > 0 ?` guards were unreachable.
 *
 * ⛔ AND THE FLOOR IS NOT A FEATURE. Nothing may add "and 1 credit on every
 * celebration after" — that is a second materially-false sentence pointing the
 * other way. There is a test below that says so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from './strip-comments';
import { PAPIC_FREE_GRANT_POINTS_FALLBACK, type PapicFreeGrantRead } from './papic-tier-copy';
import {
  PAPIC_FREE_CREDIT_CONDITION,
  papicFreeCreditPoints,
  papicFreeCreditPromise,
} from './papic-free-credit-promise';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

/** The house pattern for rendering a component under `tsx --test`. */
(globalThis as unknown as { React: unknown }).React = React;

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/**
 * Every file that renders a word about the free pool on the public page. A
 * claim moved one file over is how a copy guard is defeated without meaning to.
 */
const PAPIC_PUBLIC_FILES = [
  'app/(shell)/papic/page.tsx',
  'app/(shell)/papic/_papic-dial.tsx',
  'app/(shell)/papic/_papic-free-credits.tsx',
  'app/(shell)/papic/_papic-sections.tsx',
] as const;

// ── 1 · THE MECHANISM, out of the migration that is live ────────────────────

/**
 * Resolved by SLUG and taken as the LAST definition in filename order, not by a
 * hard-coded prefix: a later migration is free to redefine the function, and if
 * one does, THAT is the file this guard must read. Pinning a prefix would leave
 * the guard reading a superseded body and passing on a mechanism nobody runs.
 */
const CLAIM_FN = (() => {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) =>
      readFileSync(join(MIGRATIONS, f), 'utf8').includes(
        'FUNCTION public.papic_claim_free_pool',
      ),
    );
  const last = files.at(-1);
  if (!last) throw new Error('no migration defines papic_claim_free_pool');
  return { file: last, sql: readFileSync(join(MIGRATIONS, last), 'utf8') };
})();

test('the free pool is claimed ONCE PER ACCOUNT — the page may not say "every"', () => {
  // The arbiter. Without it, or with it keyed on anything but the account, the
  // sentence "on your first celebration" stops being the true one.
  assert.match(
    CLAIM_FN.sql,
    /INSERT INTO public\.papic_free_grant_claims \(user_id, event_id\)[\s\S]{0,160}?ON CONFLICT \(user_id\) DO NOTHING/,
    `${CLAIM_FN.file} no longer arbitrates the free pool on user_id. If the ` +
      `grant became per-EVENT, /papic's "${PAPIC_FREE_CREDIT_CONDITION}" is now ` +
      `understating what we give — fix the copy in ` +
      `lib/papic-free-credit-promise.ts, do not delete this test.`,
  );

  // And the claim must be keyed one-per-account in the table itself. A PK that
  // widened to (user_id, event_id) would let the same account claim per event
  // while the ON CONFLICT above still read as if it could not.
  const table = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS public.papic_free_grant_claims'));
  assert.ok(table, 'papic_free_grant_claims is no longer created by any migration');
  assert.match(
    table,
    /user_id\s+UUID PRIMARY KEY/,
    'papic_free_grant_claims is no longer one row per account',
  );
});

test('a repeat celebration gets the 1-point FLOOR, not another pool', () => {
  // This is the half the old sentence hid. The full allowance is fenced behind
  // v_first; the else-branch is a single point.
  assert.match(
    CLAIM_FN.sql,
    /IF v_first THEN[\s\S]*?VALUES \(p_event_id, v_pts, 'free_grant'[\s\S]*?ELSE[\s\S]*?VALUES \(p_event_id, 1, 'free_grant'/,
    `${CLAIM_FN.file}: the full allowance is no longer fenced behind the first ` +
      `claim, or the repeat branch is no longer the 1-point floor. Either way ` +
      `the public sentence has to change with it.`,
  );
});

test('a switched-off allowance grants NOTHING — which is why the page can fall silent', () => {
  assert.match(
    CLAIM_FN.sql,
    /IF v_pts <= 0 THEN\s*\n\s*RETURN;/,
    `${CLAIM_FN.file} no longer returns before the claim on a non-positive ` +
      `free_grant_points. The page's silent branch is built on this: if 0 ` +
      `started minting something, silence would be hiding a real grant.`,
  );
  // …and a MISSING row still mints the seed, which is why "unknown" is not
  // silence. The TS fallback below must be the same literal.
  assert.match(
    CLAIM_FN.sql,
    new RegExp(`v_pts := COALESCE\\(v_pts, ${PAPIC_FREE_GRANT_POINTS_FALLBACK}\\);`),
    `The SQL's fallback and PAPIC_FREE_GRANT_POINTS_FALLBACK have drifted. An ` +
      `unreadable config row makes the page quote one number while SQL mints ` +
      `another.`,
  );
});

// ── 2 · THE SENTENCE ────────────────────────────────────────────────────────

const OFF: PapicFreeGrantRead = { kind: 'off' };
const UNKNOWN: PapicFreeGrantRead = { kind: 'unknown' };
const fifty: PapicFreeGrantRead = { kind: 'value', points: 50 };

test('the sentence names the SIZE and the CONDITION, and is derived from the column', () => {
  const p = papicFreeCreditPromise({ kind: 'value', points: 90 });
  assert.ok(p, 'a positive allowance must produce a promise');
  assert.equal(p.sentence, '90 free credits on your first celebration');
  assert.equal(p.size, '90 free credits');
  assert.equal(p.count, '90');

  // DERIVED, not typed: move the column and the sentence moves with it.
  assert.equal(
    papicFreeCreditPromise(fifty)?.sentence,
    '50 free credits on your first celebration',
  );
  assert.notEqual(
    papicFreeCreditPromise(fifty)?.sentence,
    papicFreeCreditPromise({ kind: 'value', points: 90 })?.sentence,
  );
});

test('no free-credit sentence claims a frequency', () => {
  for (const n of [1, 50, 90, 1200]) {
    const p = papicFreeCreditPromise({ kind: 'value', points: n });
    assert.ok(p);
    for (const banned of ['every celebration', 'every event', 'each celebration']) {
      assert.equal(
        p.sentence.toLowerCase().includes(banned),
        false,
        `"${p.sentence}" claims a frequency. The pool is claimed once per ACCOUNT.`,
      );
    }
    // The badge is a SIZE. "left" made it a countdown for a reader who has no
    // celebration and therefore nothing that could be counting down.
    assert.equal(p.size.includes('left'), false, `"${p.size}" reads as a meter`);
    assert.equal(p.size.includes('every'), false);
  }
});

test('the floor is never sold as a feature', () => {
  // 1 credit on a repeat celebration is a fence, not a perk. Selling it would
  // be a second false sentence pointing the other way.
  const all = [
    ...PAPIC_PUBLIC_FILES.map(read),
    stripComments(readFileSync(join(WEB, 'lib', 'papic-free-credit-promise.ts'), 'utf8')),
  ].join('\n');
  for (const shape of [
    /1 credit on every/i,
    /one credit on every/i,
    /a credit on every celebration/i,
    /free credit on every celebration/i,
  ]) {
    assert.equal(
      shape.test(all),
      false,
      `The 1-point minimum is being advertised (${shape}). It exists so ` +
        `papic_event_pool_status() does not read a repeat event as unmetered.`,
    );
  }
});

test('the three outcomes of the column map exactly onto what SQL mints', () => {
  // value → that number · off → nothing at all · unknown → the seed SQL itself
  // COALESCEs to. Any other mapping is the page and the database disagreeing.
  assert.equal(papicFreeCreditPoints({ kind: 'value', points: 90 }), 90);
  assert.equal(papicFreeCreditPoints(OFF), null);
  assert.equal(papicFreeCreditPoints(UNKNOWN), PAPIC_FREE_GRANT_POINTS_FALLBACK);
  assert.equal(papicFreeCreditPromise(OFF), null);
  // A 'value' that is somehow not positive is the off case too — belt and
  // braces, because `points` is a plain number in the type.
  assert.equal(papicFreeCreditPoints({ kind: 'value', points: 0 }), null);
  assert.equal(papicFreeCreditPoints({ kind: 'value', points: -5 }), null);
});

// ── 3 · THE RENDER — the branch a grep cannot see ───────────────────────────

/**
 * The REAL components the page mounts, not stand-ins — imported lazily, after
 * the React global above is set, which is the house pattern
 * (`a-finding-reaches-the-admin.test.ts`).
 */
type FreeCreditMount = (props: { read: PapicFreeGrantRead }) => React.ReactNode;
async function mounts(): Promise<readonly (readonly [string, FreeCreditMount])[]> {
  const m = await import('../app/(shell)/papic/_papic-free-credits');
  return [
    ['the hero badge', m.PapicFreeCreditBadge as FreeCreditMount],
    ['the fact bullet', m.PapicFreeCreditFact as FreeCreditMount],
    ['the closing line', m.PapicFreeCreditClosing as FreeCreditMount],
  ] as const;
}
const draw = (C: FreeCreditMount, read: PapicFreeGrantRead) =>
  renderToStaticMarkup(React.createElement(C as never, { read }));
/**
 * The words a reader sees, with the markup taken out.
 *
 * 🪤 NOT OPTIONAL, AND IT CAUGHT ITSELF ON THE FIRST RUN. Asserting "the badge
 * does not say 'left'" against raw HTML fails on the Tailwind class `left-3`.
 * A guard that reads class names is reading the wrong thing — the claim is the
 * TEXT.
 */
const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

test('a switched-off allowance renders NOTHING — not "0 free credits", not 50', async () => {
  for (const [name, C] of await mounts()) {
    const html = draw(C, OFF);
    assert.equal(
      html,
      '',
      `${name} still draws something when free_grant_points is 0. It rendered ` +
        `${JSON.stringify(html)}. A switched-off allowance must be SILENT — ` +
        `"0 free credits" advertises an absence, and the seed 50 (what this ` +
        `page printed before MONEY-1) advertises a grant SQL refuses to make.`,
    );
  }
});

test('a live allowance reaches the pixels, with its condition', async () => {
  const all = await mounts();
  for (const [name, C] of all) {
    const words = text(draw(C, fifty));
    assert.notEqual(words, '', `${name} renders nothing on a live allowance`);
    assert.ok(words.includes('50'), `${name} lost the figure`);
    assert.equal(
      words.toLowerCase().includes('every celebration'),
      false,
      `${name} still claims the pool arrives on every celebration`,
    );
  }

  // The badge is the SIZE; the other two carry the condition in words.
  const badge = text(draw(all[0]![1], fifty));
  assert.ok(badge.includes('50 free credits'), `the hero badge lost its unit: ${badge}`);
  assert.equal(
    /\bleft\b/.test(badge),
    false,
    `the hero badge is a countdown again: ${badge}`,
  );

  for (const [name, C] of all.slice(1)) {
    const words = text(draw(C, fifty));
    assert.ok(
      words.includes(PAPIC_FREE_CREDIT_CONDITION),
      `${name} does not name the condition. "${PAPIC_FREE_CREDIT_CONDITION}" is ` +
        `the half the old sentence hid, and it is what makes the claim honest.`,
    );
  }
});

test('the figure a live allowance renders is the COLUMN, not a literal', async () => {
  const [, fact] = (await mounts())[1]!;
  const words = text(draw(fact, { kind: 'value', points: 137 }));
  assert.ok(words.includes('137'), 'the bullet does not follow the admin column');
  assert.equal(words.includes('50'), false, 'a seed literal survived into the render');
});

// ── 4 · THE PAGE ACTUALLY MOUNTS IT, AND OFF THE RIGHT READER ───────────────

test('every free-credit word on /papic goes through the shared promise', () => {
  for (const rel of PAPIC_PUBLIC_FILES) {
    const src = read(rel);
    assert.equal(
      /every celebration/i.test(src),
      false,
      `${rel} says "every celebration". The free pool is claimed ONCE PER ` +
        `ACCOUNT; celebration two gets one photograph.`,
    );
    assert.equal(
      /credits left/i.test(src),
      false,
      `${rel} renders the allowance as a countdown. It is the size the pool ` +
        `opens at, and the reader has no celebration yet.`,
    );
  }

  const page = read('app/(shell)/papic/page.tsx');
  for (const mount of [
    '<PapicFreeCreditBadge',
    '<PapicFreeCreditFact',
    '<PapicFreeCreditClosing',
    'buildAppLd(',
  ]) {
    assert.ok(
      page.includes(mount),
      `${mount} is no longer mounted on /papic. The sentence is back to being ` +
        `hand-typed at that site, and nothing above can see it.`,
    );
  }
});

test('/papic reads the grant with the reader that can say "off"', () => {
  const page = read('app/(shell)/papic/page.tsx');
  assert.ok(
    page.includes('readPapicFreeGrantRead'),
    '/papic no longer reads papic_event_pool_config through the display reader',
  );
  assert.equal(
    page.includes('readPapicFreeGrantPoints'),
    false,
    '/papic is back on readPapicFreeGrantPoints. That reader folds a deliberate ' +
      'free_grant_points = 0 onto the seed fallback of 50, so the page would ' +
      'advertise 50 free credits at the exact moment papic_claim_free_pool has ' +
      'stopped granting any. That was the live defect, not a hypothetical.',
  );
});
