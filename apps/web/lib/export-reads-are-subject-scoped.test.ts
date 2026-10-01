/**
 * EVERY READ IN "DOWNLOAD MY DATA" NAMES ITS SUBJECT — RLS IS NEVER THE ONLY BOUND.
 *
 * Owner 2026-10-01, "yes fix it now": the RA 10173 export read
 * `guest_face_enrollments` with no filter and trusted RLS, whose HOST arm admits
 * every guest's row at the couple's events — so a couple's own data file
 * carried every guest's face-tagging records. `godparents` had the same shape
 * behind an `is_admin()` arm. RLS answers "may this caller see the row?"; a
 * subject-access file must answer "is this row ABOUT this caller?". Those are
 * different questions, and only an explicit filter asks the second.
 *
 * So this guard isolates EVERY `.from('<table>')` chain in the export route
 * (and in lib/export-own-face-enrollments, which the route calls) and requires
 * that chain — not the file, not a 400-char window — to carry the named
 * subject anchor for that table. A file-level match cannot say WHICH read is
 * unscoped; a per-chain one can. A table with no entry in ANCHORS fails: a new
 * read must say how it is scoped before it ships.
 *
 * Anchors that are DERIVED ids (the couple's own event ids, the subject's own
 * guest ids, their claimed dependents, their own vendor profile) are pinned a
 * second time below, at the place the ids come from.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib
const ROUTE = path.resolve(HERE, '..', 'app', 'api', 'profile', 'export', 'route.ts');
const FACE = path.resolve(HERE, 'export-own-face-enrollments.ts');

const UID = String.raw`user\.id`; // the route's server-verified session identity
const eqUid = (col: string) => new RegExp(String.raw`\.eq\(\s*'${col}'\s*,\s*${UID}\s*\)`);

/** table → the subject filter its chain must carry. One entry per table, reasoned. */
const ANCHORS: Record<string, RegExp> = {
  users: eqUid('user_id'),
  // three reads: memberships, the couple's own events, the subject's own guest ids
  event_members: new RegExp(String.raw`\.eq\(\s*'user_id'\s*,\s*(${UID}|userId)\s*\)`),
  events_host: /\.in\(\s*'event_id'\s*,\s*ids\s*\)/, // ids = coupleEventIds (pinned below)
  vendor_profiles: eqUid('user_id'),
  chat_messages: eqUid('sender_user_id'),
  orders: eqUid('user_id'),
  payments: eqUid('user_id'),
  guest_face_enrollments: /\.in\(\s*'guest_id'\s*,\s*ownGuestIds\s*\)/, // pinned below
  // two reads: the dependents export (three own lanes) + the claimed-ids lookup
  dependents: new RegExp(
    String.raw`\.or\(\s*\x60owner_user_id\.eq\.\$\{${UID}\},claimed_user_id\.eq\.\$\{${UID}\},handed_over_by_user_id\.eq\.\$\{${UID}\}\x60` +
      String.raw`|\.eq\(\s*'claimed_user_id'\s*,\s*${UID}\s*\)`,
  ),
  godparents: new RegExp(String.raw`\.or\(\s*\x60owner_user_id\.eq\.\$\{${UID}\}\x60`), // + claimed ids, pinned below
  community_members: eqUid('user_id'),
  samahan_stories: eqUid('user_id'),
  samahan_messages: eqUid('user_id'),
  coordinator_access_consents: eqUid('consented_by_user_id'),
  marketing_share_consents: eqUid('customer_id'),
  papic_free_grant_claims: eqUid('user_id'),
  user_unfollows: eqUid('follower_user_id'),
  invite_mutes: eqUid('user_id'),
  vendor_reuse_requests: eqUid('requested_by_user_id'),
  event_vendor_working_notes: eqUid('author_user_id'),
  coordinator_broadcasts: eqUid('sender_user_id'),
  event_day_requests: eqUid('author_user_id'),
  event_access_requests: eqUid('requester_user_id'),
  event_deletion_requests: eqUid('user_id'),
  event_clusters: eqUid('owner_user_id'),
  event_costs: eqUid('created_by_user_id'),
  event_renders: eqUid('created_by_user_id'),
  event_render_share_consent: eqUid('consented_by_user_id'),
  event_colour_grants_coordinator: eqUid('user_id'),
  event_colour_changes: eqUid('actor_user_id'),
  // couple-grain by decision (2026-09-11): the caller's OWN couple events — pinned
  // by T15 in export-coverage-guardrail.test.ts
  event_vendor_payments: /\.in\(\s*'event_id'\s*,\s*owned\.ids\s*\)/,
  event_vendors: /\.in\(\s*'event_id'\s*,\s*owned\.ids\s*\)/,
  // the subject's OWN vendor profile (vp ← vendor_profiles .eq('user_id', user.id))
  editorial_vendor_media: /\.eq\(\s*'vendor_profile_id'\s*,\s*vp\.vendor_profile_id\s*\)/,
};

/**
 * The full `.from(…)…` chain starting at `start`: walk forward until the
 * expression ends — a `,` or `;` at depth 0, or the enclosing bracket closing.
 * Strings and template literals are skipped so a `,` inside a select list
 * does not end the chain.
 */
function chainAt(code: string, start: number): string {
  let depth = 0;
  let i = start;
  for (; i < code.length; i++) {
    const c = code[i]!;
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      i++;
      while (i < code.length && code[i] !== q) {
        if (code[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth < 0) break;
    } else if (depth === 0 && (c === ',' || c === ';')) break;
  }
  return code.slice(start, i);
}

type Read = { file: string; table: string; chain: string };

function readsIn(file: string): Read[] {
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const out: Read[] = [];
  for (const m of code.matchAll(/\.from\(/g)) {
    const chain = chainAt(code, m.index!);
    const lit = /^\.from\(\s*'([a-z0-9_]+)'\s*\)/.exec(chain);
    assert.ok(
      lit,
      `${path.basename(file)}: a .from() whose table is not a string literal — ${chain.slice(0, 80)}. ` +
        'The guard cannot say which subject a dynamic table name is scoped to.',
    );
    out.push({ file: path.basename(file), table: lit[1]!, chain });
  }
  return out;
}

test('every table read in the export names its subject, read by read', () => {
  const reads = [...readsIn(ROUTE), ...readsIn(FACE)];
  const unanchored = reads.filter((r) => !(r.table in ANCHORS) || !ANCHORS[r.table]!.test(r.chain));
  console.log(
    `export reads: ${reads.length} · subject-anchored: ${reads.length - unanchored.length} · unanchored: ${unanchored.length}`,
  );
  assert.ok(reads.length >= 33, `only ${reads.length} reads found — the chain scanner stopped seeing the route`);
  assert.deepEqual(
    unanchored.map((r) => `${r.file} · ${r.table} · ${r.chain.replace(/\s+/g, ' ').slice(0, 160)}`),
    [],
    'These export reads carry no explicit subject filter. RLS is not one: it answers "may this caller see ' +
      'the row", not "is this row about this caller" (a host may see every guest; an admin may see everyone). ' +
      'Filter the read to the subject, and give a NEW table its reasoned anchor in ANCHORS.',
  );
  // Every anchor is still used — a stale entry would let a renamed read slip by.
  const seen = new Set(reads.map((r) => r.table));
  assert.deepEqual(Object.keys(ANCHORS).filter((t) => !seen.has(t)), [], 'ANCHORS entries no read uses');
});

test('the route reads face records only through the subject-scoped helper', () => {
  const route = stripComments(fs.readFileSync(ROUTE, 'utf8'));
  assert.match(route, /readOwnFaceEnrollments\(\s*supabase\s*,\s*user\.id\s*\)/);
  assert.doesNotMatch(route, /\.from\(\s*'guest_face_enrollments'\s*\)/);
});

test('the derived ids are the subject’s own (where each anchor’s list comes from)', () => {
  const route = stripComments(fs.readFileSync(ROUTE, 'utf8'));
  const face = stripComments(fs.readFileSync(FACE, 'utf8'));
  // own guest ids ← the subject's OWN membership rows
  assert.match(
    face,
    /const mine = await client\s*\.from\('event_members'\)\s*\.select\('guest_id'\)\s*\.eq\('user_id', userId\)[\s\S]{0,300}?const ownGuestIds = distinctGuestIds\(mine\.data/,
    'ownGuestIds must come from event_members filtered to the subject (user_id = the caller)',
  );
  // claimed dependents ← dependents the subject claimed
  assert.match(
    route,
    /const claimed = await supabase\s*\.from\('dependents'\)\s*\.select\('dependent_id'\)\s*\.eq\('claimed_user_id', user\.id\)[\s\S]{0,900}?dependent_id\.in\.\(\$\{claimedIds\.join/,
    'the godparents claimed-profile lane must come from dependents the subject claimed',
  );
  // couple event ids → events_host
  assert.match(
    route,
    /const owned = await coupleEventIds;[\s\S]{0,1600}?const ids = owned\.ids;[\s\S]{0,400}?\.from\('events_host'\)/,
    'events_host must read only the caller’s own couple events',
  );
  // vp ← the subject's own vendor profile
  assert.match(route, /const vp = vendorProfile\.row;/);
});
