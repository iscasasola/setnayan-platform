/**
 * guest-columns-byline.test.ts — DPO rulings 03 and 04, owner-decided 2026-08-06.
 *
 * RULING 03: a guest's real name is published beside their public message only
 * if the guest asked for it. The byline is their ROSTER name, typed by the
 * couple — publishing it on the open web is a disclosure the guest never made
 * about themselves.
 *
 * 🪤 THE TRAP THIS FILE EXISTS FOR. `author_publicly_hidden` reads like a byline
 * switch and is not: every read path filters `author_publicly_hidden = false`,
 * so setting it removes the WHOLE MESSAGE from publication. The obvious
 * implementation — "flip its default to true" — would have silently unpublished
 * every guest message instead of anonymising it, and the ruling would have
 * looked delivered. The product had NO way to publish a message without a name;
 * that capability is `author_named_publicly`, and the two answer different
 * questions.
 *
 * RULING 04: a guest we already know to be a child may not author one. Enforced
 * by a trigger on the table rather than in the route or the submit RPC, so it
 * holds for writers that do not exist yet.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bylineFor } from './guest-columns';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const REPO = join(WEB, '..', '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const MIGRATION = readFileSync(
  join(REPO, 'supabase', 'migrations', '20271116990067_dpo_rulings_guest_column_byline_and_minors.sql'),
  'utf8',
);

/**
 * Every PUBLIC surface that publishes a GUEST COLUMN byline.
 *
 * ⚠ `lib/auto-recap.ts` and `lib/live-wall.ts` are NOT here, and that is the
 * point. A first pass added them because they filter `author_publicly_hidden`
 * too — but they query `photo_messages`, a DIFFERENT feature that happens to
 * share the column name. The repo's own select-column scanner caught it: naming
 * a phantom column makes PostgREST fail the WHOLE query with 42703, so `.data`
 * comes back null and the recap and the venue wall would have gone SILENTLY
 * EMPTY. Grepping a column name finds a name, not a table.
 *
 * Whether the same ruling should extend to photo messages was never put to the
 * DPO, so it is not being decided here.
 */
const PUBLIC_SURFACES = [
  'app/[slug]/_components/guest-column-card.tsx',
  'app/[slug]/_components/editorial/data.ts',
];

// ── THE RULE ITSELF ─────────────────────────────────────────────────────────

test('no byline unless the guest opted in', () => {
  const names = new Map([['g1', 'Maria Santos']]);
  assert.equal(bylineFor({ author_named_publicly: true, guest_id: 'g1' }, names), 'Maria Santos');
  assert.equal(bylineFor({ author_named_publicly: false, guest_id: 'g1' }, names), null);
  assert.equal(bylineFor({ author_named_publicly: null, guest_id: 'g1' }, names), null);
});

test('a pre-migration read (column absent) publishes NO name', () => {
  const names = new Map([['g1', 'Maria Santos']]);
  // `undefined` means the column is not there yet. It must read as "not opted
  // in" — the one direction that cannot be undone is publishing a name.
  assert.equal(bylineFor({ guest_id: 'g1' }, names), null);
  // And truthiness is not enough: only an exact `true` opts in, so a stray
  // string or 1 from a loose client cannot name somebody.
  assert.equal(
    bylineFor({ author_named_publicly: 'yes' as unknown as boolean, guest_id: 'g1' }, names),
    null,
  );
});

test('opted in but no name on file publishes no byline rather than a placeholder', () => {
  assert.equal(bylineFor({ author_named_publicly: true, guest_id: 'g1' }, new Map()), null);
  assert.equal(bylineFor({ author_named_publicly: true, guest_id: null }, new Map()), null);
});

// ── EVERY PUBLIC SURFACE HONOURS IT ─────────────────────────────────────────

test('every public surface FETCHES the opt-in in its query', () => {
  // Assert the column is inside a `.select(...)`, not merely mentioned in the
  // file. The first cut checked only that the string appeared anywhere, which a
  // surface would satisfy by naming it in a comment while its query never asked
  // for it — the byline would then read `undefined` and, per bylineFor, publish
  // nothing. That is the SAFE direction, but a guard that cannot tell the two
  // apart is not measuring what it claims to.
  for (const f of PUBLIC_SURFACES) {
    const src = read(f);
    const selects = src.match(/\.select\(\s*'[^']*'/g) ?? [];
    assert.ok(
      selects.some((s) => s.includes('author_named_publicly')),
      `${f} never fetches the opt-in in any query. It publishes a guest column ` +
        `byline, so it would print a roster name the guest never agreed to show.`,
    );
  }
});

test('no public surface resolves a name straight from the map', () => {
  // The failure mode is a surface that keeps its own `nameOf.get(...)` and so
  // decides the opt-in for itself. Four surfaces each hand-roll their own name
  // lookup; one of them drifting is how a name gets published by accident.
  for (const f of ['app/[slug]/_components/guest-column-card.tsx']) {
    const src = read(f);
    assert.ok(
      !/author:\s*nameOf\.get\(/.test(src),
      `${f} assigns a byline directly from the name map again, bypassing the rule.`,
    );
  }
});

// ── RULING 04 ───────────────────────────────────────────────────────────────

test('the child refusal is a trigger on the table, not a check in one caller', () => {
  assert.ok(
    /CREATE TRIGGER trg_guest_columns_refuse_known_minor[\s\S]*?BEFORE INSERT OR UPDATE ON public\.guest_columns/.test(
      MIGRATION,
    ),
    'The refusal moved off the table. The route is one caller; the table is every ' +
      'caller, including ones not written yet.',
  );
});

test('the refusal does NOT block a child taking their own message down', () => {
  // Withdrawal writes 'user_deleted'; approval writes 'approved'. Gating on
  // 'pending' is what keeps the takedown path open — a privacy rule that blocked
  // its own takedown would be the opposite of the ruling.
  assert.ok(
    /IF NEW\.status = 'pending' AND public\.guest_is_known_minor\(NEW\.guest_id\)/.test(MIGRATION),
    'The trigger no longer scopes to the submit path, so it would also refuse a ' +
      'withdrawal — the one action a child must always be able to take.',
  );
});

test('an unknown age is NOT treated as a child', () => {
  // A guest record holds no age at all. The signal is an active stewardship
  // marked is_minor — the same one that already refuses a child's selfie. The
  // ruling explicitly declined to start collecting birthdays.
  assert.ok(
    /s\.is_minor[\s\S]*?s\.status = 'active'[\s\S]*?s\.revoked_at IS NULL/.test(MIGRATION),
    'The known-child test no longer requires an ACTIVE, unrevoked stewardship.',
  );
  // Check the DDL, not the prose. The first cut matched /birthday/ anywhere and
  // failed on this migration's own comment explaining why we do NOT collect
  // birthdays — the same "a name appearing is not a name being used" mistake,
  // just inverted. Strip comments, then look at what is actually added.
  const ddl = MIGRATION.split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  assert.ok(
    !/ADD COLUMN[^;]*\b(date_of_birth|birth_date|birthday|age)\b/i.test(ddl),
    'This migration started collecting ages. The ruling was explicit: do not — ' +
      'collecting ages to protect ages enlarges the risk being managed.',
  );
});

test('the misleading column keeps a comment saying what it really does', () => {
  assert.ok(
    /COMMENT ON COLUMN public\.guest_columns\.author_publicly_hidden[\s\S]*?entire column/i.test(
      MIGRATION,
    ),
    'The note explaining that author_publicly_hidden suppresses the WHOLE column ' +
      'is gone. That misreading is what nearly unpublished every guest message.',
  );
});
