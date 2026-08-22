/**
 * EVERY ENUM LABEL THE APP WRITES MUST EXIST IN THE DATABASE.
 *
 * 🔴 THE SIXTH COSTUME OF ONE DISEASE. A phantom COLUMN in a select · a phantom
 * ENUM VALUE in a filter · a phantom ARGUMENT in an `.rpc()` · a blocked iframe ·
 * an unresolved `r2://` — and now a phantom ENUM VALUE in an INSERT. Every one of
 * them is REJECTED, NEVER THROWN, and the only symptom is an absence.
 *
 * What it cost this time: `connectEventForUser` wrote `joined_via: 'email_link'`
 * into `event_members`. `join_method` has six labels and that is not one of them,
 * so Postgres refused the row EVERY TIME. The refusal lands in `error`,
 * `connected: !error` returns false, and the caller redirects anyway — so a guest
 * who signed in from a NEW PHONE through the emailed link was never attached to
 * the celebration, saw no error, and landed on an empty home page. Nothing logged.
 *
 * ── WHY THIS IS A DB TEST AND NOT A LINT ────────────────────────────────────
 * The legal labels live in the DATABASE, not in TypeScript. Supabase's generated
 * types would have caught it — but these writes go through the ADMIN client with
 * loosely-typed payloads, so `tsc` sees a plain string and is happy. Only asking
 * the schema can answer this.
 *
 * ⚠ WHEN THIS FAILS, THE FIX IS NEVER TO ADD THE LABEL TO THE LIST BELOW.
 * Either the literal is wrong (use an existing label) or the enum genuinely needs
 * a new value (write a migration). Widening this test's own list would reproduce
 * the exact bug it exists to catch.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

const WEB = join(__dirname, '..', '..');

/** Every column the app writes a bare string literal into, paired with the enum
 *  backing it. Add a row when you add an enum-typed column the app writes. */
const ENUM_COLUMNS: Array<{ column: string; enumType: string }> = [
  { column: 'joined_via', enumType: 'join_method' },
  { column: 'entry_source', enumType: 'guest_entry_source' },
  { column: 'member_type', enumType: 'member_type' },
  { column: 'rsvp_status', enumType: 'rsvp_status' },
  { column: 'meal_preference', enumType: 'meal_preference' },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'tests') continue;
    const abs = join(dir, entry);
    const s = statSync(abs);
    if (s.isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(abs);
  }
  return out;
}

const SOURCES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];

/** Strip comments — a docblock NAMING a retired label is not a write of it, and
 *  this exact file's fix comment mentions `email_link` by name. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('the scan reads a real, non-trivial set of files', () => {
  assert.ok(SOURCES.length > 300, `only ${SOURCES.length} source files walked — the scan is not reaching the app`);
});

for (const { column, enumType } of ENUM_COLUMNS) {
  test(`🔴 every \`${column}\` literal the app writes is a real ${enumType} label`, async () => {
    const { rows } = await db.query<{ enumlabel: string }>(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = $1`,
      [enumType],
    );
    assert.ok(rows.length > 0, `the enum ${enumType} does not exist — re-point this guard`);
    const legal = new Set(rows.map((r) => r.enumlabel));

    const found: Array<{ file: string; value: string }> = [];
    for (const file of SOURCES) {
      const src = code(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(new RegExp(`${column}:\\s*'([^']+)'`, 'g'))) {
        found.push({ file: file.slice(WEB.length + 1), value: m[1]! });
      }
    }
    // Vacuity: a regex that matched nothing would make the assertion below
    // trivially true — and a loop that skips everything passes.
    assert.ok(found.length > 0, `no \`${column}\` writes found at all — the pattern cannot match, so this proves nothing`);

    const phantom = found.filter((f) => !legal.has(f.value));
    assert.deepEqual(
      phantom.map((f) => `${f.file} writes ${column}='${f.value}'`),
      [],
      `Postgres REJECTS these inserts and the app never throws. Legal ${enumType}: ${[...legal].join(' | ')}. ` +
        'Fix the literal or write a migration — never widen this test.',
    );
  });
}

test('🔒 the cross-device sign-in really can attach a guest now', async () => {
  // The behavioural half: prove the exact row that path writes is ACCEPTED.
  // Reading the label out of the enum proves the value is legal; inserting it
  // proves the whole row is.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, slug)
     VALUES ('Cross Device', 'birthday', '2027-06-06', 'cross-device') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  const au = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('crossdevice@t.invalid', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  const userId = au.rows[0]!.id;
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
    userId,
    'crossdevice@t.invalid',
  ]);
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role,
       rsvp_status, meal_preference, invited_to_blocks, entry_source, photo_consent)
     VALUES ($1,'Cross','Device','both','other','guest','pending','no_preference',
             ARRAY['ceremony','reception'],'host_seeded',true) RETURNING guest_id`,
    [eventId],
  );
  await assert.doesNotReject(
    db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id, role, joined_via)
       VALUES ($1,$2,'guest',$3,'guest','guest_signup')`,
      [eventId, userId, g.rows[0]!.guest_id],
    ),
    'the row this path writes is still refused — a guest signing in on a new phone is not attached',
  );
});
