/**
 * THE WORDING LOCK, ENFORCED ON EVERY ROW.
 *
 * Owner, 2026-08-10: the story challenges must be "fun to share but still
 * memorable and safe enough to share". That was a ruling about 20 prompts. The
 * pool is now 631, so it can no longer be held by a person reading them.
 *
 * 🔒 "SAFE ENOUGH TO SHARE" IS A CONSTRAINT ON THE WORDING, NOT A DISCLAIMER.
 * The capture route's blocklist stops DARES. It does not stop tactlessness, and
 * an answer that embarrasses somebody in front of both families is unsafe
 * though every word passes. These tests are the half a runtime blocklist cannot
 * do: they read the prompts at build time and refuse the shapes that produce
 * those answers.
 *
 * ⚠ THIS FILE PROVES NOTHING ABOUT TASTE. A prompt can clear every check here
 * and still be a bad question. The banned list is a floor under the wording,
 * not a substitute for reading them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  CHALLENGE_POOL,
  CHALLENGE_POOL_FLOOR,
  slugifyTitle,
  fitsEventType,
  ID_BLOCKS,
} from './papic-challenge-pool';
import { CATEGORY_LABELS, CATEGORY_ORDER } from './papic-challenge-categories';
import { emitChallengeSeedSql, CHALLENGE_SEED_MIGRATION } from './papic-challenge-sql';

// ── The owner's number ─────────────────────────────────────────────────────

test('the pool is over five hundred challenges', () => {
  assert.ok(
    CHALLENGE_POOL.length > CHALLENGE_POOL_FLOOR,
    `${CHALLENGE_POOL.length} challenges; the owner asked for over ${CHALLENGE_POOL_FLOOR}`,
  );
});

test('both halves of "photos or videos combined" are real', () => {
  const photos = CHALLENGE_POOL.filter((r) => r.captureKind === 'photo').length;
  const videos = CHALLENGE_POOL.filter((r) => r.captureKind !== 'photo').length;
  // Not a ratio anybody ruled on — a floor against a pool that drifts into one
  // medium. A guest who cannot hold a camera steady still has 300 photo options.
  assert.ok(photos > 200, `only ${photos} photo challenges`);
  assert.ok(videos > 200, `only ${videos} video challenges`);
});

// ── Identity: nothing may collide, nothing may silently renumber ───────────

test('every library id, slug, title and prompt is unique', () => {
  for (const key of ['libraryId', 'slug', 'title', 'prompt'] as const) {
    const seen = new Map<unknown, string>();
    for (const row of CHALLENGE_POOL) {
      const v = row[key];
      assert.ok(
        !seen.has(v),
        `duplicate ${key}: ${String(v)} — ${row.slug} collides with ${seen.get(v)}`,
      );
      seen.set(v, row.slug);
    }
  }
});

test('a slug is derived from its title and stays derived', () => {
  // Catches the case where somebody edits a title and the slug quietly follows
  // it — which is fine for a row nobody has picked and a live-board re-point for
  // a row somebody has. The 60 shipped rows carry explicit slugs from
  // production and are exempt by construction: their ids are below 100.
  for (const row of CHALLENGE_POOL) {
    if (row.libraryId < ID_BLOCKS.selfie!) continue;
    assert.equal(
      row.slug,
      slugifyTitle(row.title),
      `${row.slug} is not the slug of "${row.title}"`,
    );
  }
});

test('priority_rank is unique and inside 1..20 — a rank is a board POSITION', () => {
  // Two rows claiming one position turns a guarantee into a coin flip: the
  // board's ORDER BY would break the tie by library_id and the couple would
  // have no way to know why.
  const ranks = new Map<number, string>();
  for (const row of CHALLENGE_POOL) {
    if (row.priorityRank === null) continue;
    assert.ok(row.priorityRank >= 1 && row.priorityRank <= 20, `${row.slug}: rank out of range`);
    assert.ok(!ranks.has(row.priorityRank), `rank ${row.priorityRank} claimed twice`);
    ranks.set(row.priorityRank, row.slug);
  }
});

test('the 571 new rows are all above library_id 99 and none is ranked', () => {
  // 🔒 THIS IS WHAT KEEPS EVERY EXISTING WEDDING BOARD WHERE IT IS. The Setnayan
  // lane backfills `ORDER BY priority_rank NULLS LAST, library_id`, so as long
  // as new rows are unranked and numbered above the shipped sixty, the shipped
  // sixty win every slot they won yesterday. Rank a new row and a couple who
  // curated their board last week silently gets a different one.
  for (const row of CHALLENGE_POOL) {
    if (row.libraryId <= 60) continue;
    assert.ok(row.libraryId >= 100, `${row.slug} sits in the shipped id range`);
    assert.equal(row.priorityRank, null, `${row.slug} is ranked; that moves live boards`);
  }
});

test('the prompt fits the column', () => {
  for (const row of CHALLENGE_POOL) {
    assert.ok(row.prompt.length >= 1 && row.prompt.length <= 280, `${row.slug}: ${row.prompt.length} chars`);
  }
});

// ── The wording lock ───────────────────────────────────────────────────────

/**
 * Never point a camera-answer at these. Each one reliably produces the shape of
 * answer the owner ruled out: something that is fun to record and unkind to
 * play back in front of two families.
 */
const BANNED = [
  'wildest',
  'most embarrassing',
  'embarrassing',
  'secret',
  'never told',
  'worst dressed',
  'rate the',
  'rank the',
  'drunk',
  'your ex',
  'their ex',
  'how much did',
  'who is better',
  'who is funnier',
  'wears the trousers',
];

/**
 * STRICTER STILL, AND ONLY FOR THE CONFESSION BOX. These come from the shipped
 * `papic-story-challenges.db.test.ts`, which has held the story set since
 * 2026-08-10 — this file must never be the LOOSER of the two guards on the same
 * rows, or adding a story here would quietly pass a bar the older test then
 * fails in CI. They are scoped to the story categories on purpose: "Worst
 * Angle" is a fine photo challenge and a terrible question.
 */
const BANNED_IN_STORIES = [
  /\bembarrass/i, /\bwildest\b/i, /\bsecret/i, /\bnever told\b/i, /\bworst\b/i,
  /\bregret/i, /\bex[- ]/i, /\bcheat/i, /\bdirt\b/i, /\bconfess/i,
];

test('a story asks for nothing the older, stricter guard would refuse', () => {
  for (const row of CHALLENGE_POOL) {
    if (row.category !== 'stories' && row.category !== 'stories_couple') continue;
    for (const bad of BANNED_IN_STORIES) {
      assert.ok(!bad.test(row.prompt), `${row.slug} invites an unsafe answer (${bad}): ${row.prompt}`);
    }
    // The shipped guard also pins these two, and a story that misses either
    // reaches a guest as a question with no way to answer it.
    assert.equal(row.captureKind, 'clip', `${row.slug} must be answered to camera`);
    assert.match(row.prompt, /[Tt]en seconds/, `${row.slug} must state the length`);
  }
});

test('no prompt asks for the answer nobody wants played back', () => {
  for (const row of CHALLENGE_POOL) {
    const lower = row.prompt.toLowerCase();
    for (const word of BANNED) {
      assert.ok(!lower.includes(word), `"${word}" in ${row.slug}: ${row.prompt}`);
    }
  }
});

test('every clip that asks a guest to SPEAK names the ten seconds', () => {
  // ⚠ A CLIP IS CUT AT 10 000 ms AND THE GUEST IS TOLD THEY SUCCEEDED. A story
  // prompt that does not name the length gets somebody cut off mid-sentence and
  // shown a tick. There is no text-answer path and none was invented.
  const SPEAKS =
    /\b(say|says|tell|share|describe|name|sing|review|introduce|interview|teach|toast|brag|promise|narrate|explain|ask|answer|welcome|thank|congratulat|guess)/i;
  const NAMES_LENGTH = /\bten seconds\b|\b10[- ]second/i;
  for (const row of CHALLENGE_POOL) {
    if (row.captureKind !== 'clip') continue;
    if (!SPEAKS.test(row.prompt) && !row.prompt.includes('?')) continue;
    assert.ok(NAMES_LENGTH.test(row.prompt), `${row.slug} asks for words with no length: ${row.prompt}`);
  }
});

// ── The tokens ─────────────────────────────────────────────────────────────

test('only the four known tokens appear', () => {
  for (const row of CHALLENGE_POOL) {
    for (const m of row.prompt.matchAll(/\{[a-z_]+\}/g)) {
      assert.ok(
        ['{who}', '{host}', '{hosts}', '{event}'].includes(m[0]),
        `unknown token ${m[0]} in ${row.slug} — nothing resolves it, so a guest reads it raw`,
      );
    }
  }
});

test('{who} only ever appears on a wedding-scoped row', () => {
  // {who} resolves from `guests.side`, whose values are bride · groom · both.
  // At a birthday it falls through to "the couple" and names two people who do
  // not exist.
  for (const row of CHALLENGE_POOL) {
    if (!row.prompt.includes('{who}')) continue;
    assert.deepEqual(row.eventTypes, ['wedding'], `${row.slug} carries {who} outside a wedding`);
  }
});

test('{host} is never the subject of a verb', () => {
  // 🔑 'the couple' takes a plural verb and 'the celebrant' a singular one, so
  // "{host} is dancing" is wrong for half the event types no matter which way it
  // is written. Only ever an OBJECT: "A photo with {host}" is right for all.
  for (const row of CHALLENGE_POOL) {
    assert.ok(
      !/\{hosts?\}\s+(is|are|has|have|was|were|does|do)\b/i.test(row.prompt),
      `${row.slug} makes {host} a subject: ${row.prompt}`,
    );
  }
});

test('no row mixes {who} with {host}', () => {
  for (const row of CHALLENGE_POOL) {
    assert.ok(
      !(row.prompt.includes('{who}') && /\{hosts?\}/.test(row.prompt)),
      `${row.slug} asks about a side AND the host in one sentence`,
    );
  }
});

// ── Scope ──────────────────────────────────────────────────────────────────

test('every event type Setnayan runs can fill a board', () => {
  // 20 slots. A type with fewer than 20 fitting challenges would produce a
  // short board and no error anywhere.
  const TYPES = [
    'wedding', 'birthday', 'debut', 'christening', 'gender_reveal', 'celebration',
    'travel', 'corporate', 'tournament', 'anniversary', 'graduation', 'reunion',
    'date', 'hangout', 'gala_night', 'simple_event',
  ];
  for (const type of TYPES) {
    const fits = CHALLENGE_POOL.filter((r) => fitsEventType(r, type)).length;
    assert.ok(fits >= 20, `only ${fits} challenges fit a ${type}; a board needs 20`);
  }
});

test('a wedding-only row is genuinely wedding-only', () => {
  const weddingOnly = CHALLENGE_POOL.filter(
    (r) => r.eventTypes?.length === 1 && r.eventTypes[0] === 'wedding',
  );
  assert.ok(weddingOnly.length > 50, 'the shipped sixty should all be wedding-scoped');
  for (const row of weddingOnly) {
    assert.equal(fitsEventType(row, 'birthday'), false, `${row.slug} leaks into a birthday`);
  }
});

test('every scoped row names a real event type', () => {
  const KNOWN = new Set([
    'wedding', 'birthday', 'debut', 'christening', 'gender_reveal', 'celebration',
    'travel', 'corporate', 'tournament', 'anniversary', 'graduation', 'reunion',
    'date', 'hangout', 'gala_night', 'simple_event',
  ]);
  for (const row of CHALLENGE_POOL) {
    for (const t of row.eventTypes ?? []) {
      // A typo here does not error — it produces a row that fits NO event and is
      // therefore invisible forever. Same shape as a library row with no rank.
      assert.ok(KNOWN.has(t), `${row.slug} is scoped to "${t}", which is not an event type`);
    }
  }
});

// ── Categories ─────────────────────────────────────────────────────────────

test('every category is used, labelled and ordered', () => {
  const used = new Set(CHALLENGE_POOL.map((r) => r.category));
  for (const cat of CATEGORY_ORDER) {
    assert.ok(used.has(cat), `${cat} is offered as a filter chip and has no challenges`);
    assert.ok(CATEGORY_LABELS[cat], `${cat} has no label`);
  }
  for (const cat of used) {
    assert.ok(CATEGORY_ORDER.includes(cat), `${cat} has challenges and no filter chip`);
  }
});

test('the seven shapes the owner named each have real depth', () => {
  // Owner, 2026-08-21: a confession box · an on-the-spot anywhere challenge ·
  // one with the host · one with other people · a selfie · a flex of what they
  // wore or brought · a special message. A category with four rows in it is a
  // chip that opens onto an almost-empty page.
  const MIN = 30;
  for (const cat of ['stories', 'anywhere', 'couple_family', 'meet_room', 'selfie', 'fashion_candids', 'greeting'] as const) {
    const n = CHALLENGE_POOL.filter((r) => r.category === cat).length;
    assert.ok(n >= MIN, `${cat} has only ${n} challenges; the owner asked for this one by name`);
  }
});

// ── The migration and this file cannot drift ───────────────────────────────

test('the migration that seeds the library still matches this pool', () => {
  // 🔑 A GUARD COMPARING TWO HAND-TYPED THINGS IS NOT A GUARD. `llms.txt`
  // drifted for three weeks with green CI doing exactly that. Six hundred rows
  // cannot be kept in step with a hand-written seed by care alone, so the
  // migration is GENERATED from this array and this test re-generates it with
  // THE SAME FUNCTION and compares. They can only agree.
  //
  // ⚠ IT LIVED AS ITS OWN ci.yml STEP FIRST AND COULD NOT RUN — `tsx` is a
  // devDependency of `apps/web`, not of the repo root. All three ci.yml edits
  // were correct; the runtime was not there. A guard that cannot execute is
  // worse than no guard.
  // ⚠ AND ITS FIRST HOME HERE BROKE TYPECHECK: importing the untyped `.mjs`
  // script from TypeScript is TS7016. The generator moved into
  // `papic-challenge-sql.ts` for that reason — which is also the better shape,
  // because this test now calls the function the migration was built with
  // rather than a parallel implementation of it.
  const { sql, count } = emitChallengeSeedSql();
  const migration = readFileSync(
    fileURLToPath(new URL(`../../../${CHALLENGE_SEED_MIGRATION}`, import.meta.url)),
    'utf8',
  );
  assert.equal(count, CHALLENGE_POOL.length);
  assert.ok(
    migration.includes(sql.trim()),
    'the migration no longer matches the pool. Regenerate it:\n' +
      '  node --import tsx scripts/emit-papic-challenge-pool.mjs',
  );
});
