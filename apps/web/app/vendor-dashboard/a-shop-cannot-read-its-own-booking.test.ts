/**
 * a-shop-cannot-read-its-own-booking.test.ts — `event_vendors` HAS NO VENDOR
 * SELECT POLICY, and every read of it on a shop's own session is a silent zero.
 *
 * ── THE MEASUREMENT, so nobody has to take this on trust ────────────────────
 * Read out of PRODUCTION on 2026-08-28, as the shop's own `authenticated` role,
 * inside a rolled-back transaction. `event_vendors` carries exactly four
 * policies — `couple_read`, `couple_write`, `moderator_read`, `moderator_write`
 * — and NOT ONE of them admits a vendor. The shop that is genuinely booked on
 * the single marketplace booking in production read **0 rows** of it, while
 * `current_vendor_booked_event_ids()` correctly returned 1.
 *
 * This is deliberate: opening a vendor SELECT policy on that table would hand
 * suppliers the couple's whole booking row, budget figures included. The
 * sanctioned way for a shop to resolve its own booking is the ADMIN client
 * SCOPED BY THE CALLER'S OWN `vendor_profile_id`, resolved from their session
 * — the shape `fetchLockAgreementRequests` already uses on the Answers Desk.
 *
 * ── WHY IT NEEDS A GUARD AND NOT JUST A FIX ────────────────────────────────
 * `maybeSingle()` on an RLS refusal returns `{ data: null }` and `count` comes
 * back `0` — byte-identical to "this shop is not booked here" and to "nobody
 * has picked this service". Nothing throws, nothing logs, and every one of
 * these shipped under a comment asserting the opposite. FOUR were live when
 * this file was written, each found by symptom rather than by search:
 *
 *   · `vendorPostHandover`      — a supplier could never deliver a gallery
 *                                 link, proof or sign-off. FIXED.
 *   · `vendorRaiseChangeOrder`  — a supplier could never propose an add-on. FIXED.
 *   · `deleteVendorService`     — 🔴 the WORST: the count that decides "retire,
 *                                 don't delete" always answered 0, so deleting a
 *                                 service hard-deleted it and SET NULL'd
 *                                 `event_vendors.service_id` on any booking
 *                                 pointing at it. FIXED. (Inert in production —
 *                                 zero of 45 bookings carry a service_id — which
 *                                 is why it was safe to fix rather than urgent.)
 *   · `script-actions.ts`       — the host/MC cue composer: every save answered
 *                                 "You are not booked on this event". FIXED
 *                                 2026-08-29, once its downstream was measured
 *                                 rather than assumed (see below).
 *   · `manpower/surface.tsx`    — the open-gig list: a booked shop was told
 *                                 "hosts are not offering any". FIXED
 *                                 2026-08-29, together with the FOUR other
 *                                 walls behind it (see that PR).
 *
 * 🔑 THE LIST IS DERIVED FROM THE TREE, NEVER TYPED OUT. A hand-written list of
 * offenders is a list of the ones somebody thought of, and all four above were
 * found by grepping the RECEIVER of every `.from('event_vendors')` rather than
 * by remembering paths.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

/**
 * Sites that still read `event_vendors` on a session client, each with the
 * reason it is not repaired here. A line may only be DELETED (by fixing the
 * site); adding one is a decision a reviewer sees.
 */
const EXEMPT: Record<string, string> = {
  'app/vendor-dashboard/contracts/actions.ts':
    'NOT A DEFECT. The direct query is a documented FALLBACK after ' +
    '`resolve_event_vendor_for_contract`, which is SECURITY DEFINER and VERIFIED ' +
    'PRESENT IN PRODUCTION (pg_proc, 2026-08-28) — so the fallback is not reached, ' +
    'and when it is (a pre-migration environment) it degrades to a null link ' +
    'rather than to a wrong answer.',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Strip comments so a docblock NAMING the defect is not read as the defect. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/[^\n]*$/gm, (m) =>
    // keep code that precedes a trailing comment
    m.slice(0, m.indexOf('//')),
  );
}

const FILES = walk(join(WEB, 'app', 'vendor-dashboard'));

/** ANTI-VACUITY: a walker that finds nothing passes every rule below. */
test('the scan actually sees the vendor tree', () => {
  assert.ok(FILES.length > 100, `only ${FILES.length} files walked — the tree moved`);
  const withReads = FILES.filter((f) =>
    /\.from\(\s*'event_vendors'\s*\)/.test(readFileSync(f, 'utf8')),
  );
  assert.ok(
    withReads.length >= 8,
    `only ${withReads.length} files read event_vendors — the matcher stopped matching`,
  );
});

/**
 * The window of source immediately before a `.from('event_vendors')`, which is
 * where the client that will serve it is named.
 *
 * 🔑 IT IS A WINDOW, NOT A CAPTURED IDENTIFIER, AND THAT IS THE WHOLE POINT.
 * The first cut of this guard captured `([A-Za-z_$][\w$]*)` before `.from(` —
 * which matches `admin.from(…)` and `supabase.from(…)` and NOTHING ELSE.
 * Measured by mutation: rewriting a repaired site as
 * `(await createClient()).from('event_vendors')` put the defect straight back
 * and the guard stayed GREEN, because the character before `.from` was `)` and
 * the regex simply did not fire. A guard that cannot see an offender reports a
 * clean sweep.
 */
const CLIENT_WINDOW = 80;

function clientWindowsFor(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\.from\(\s*'event_vendors'\s*\)/g)) {
    out.push(src.slice(Math.max(0, m.index! - CLIENT_WINDOW), m.index!).replace(/\s+/g, ' ').trim());
  }
  return out;
}

test('no NEW session-client read of event_vendors in the shop tree', () => {
  const offenders: string[] = [];
  for (const file of FILES) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const rel = relative(WEB, file);
    for (const win of clientWindowsFor(src)) {
      // The sanctioned reader is an admin client — however it is named locally,
      // and however it is constructed — scoped by the caller's own
      // vendor_profile_id, which the very next lines assert.
      if (/admin/i.test(win)) continue;
      if (rel in EXEMPT) continue;
      offenders.push(`${rel}  (…${win.slice(-48)})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'These read event_vendors on a session client. `event_vendors` has NO vendor ' +
      'SELECT policy in production, so each returns ZERO ROWS and NOTHING THROWS. ' +
      'Resolve the booking with the admin client scoped by the caller’s own ' +
      'vendor_profile_id, or add a reasoned line to EXEMPT:\n  ' +
      offenders.join('\n  '),
  );
});

test('every exemption still names a file that exists and still has the read', () => {
  // A bill nobody can pay is not a bill. If a site is fixed, its line must go —
  // otherwise the list slowly becomes fiction and stops meaning anything.
  for (const rel of Object.keys(EXEMPT)) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    assert.ok(
      /\.from\(\s*'event_vendors'\s*\)/.test(src),
      `${rel} no longer reads event_vendors — delete its EXEMPT line`,
    );
    assert.ok(EXEMPT[rel]!.length > 80, `${rel} needs a real reason, not a placeholder`);
  }
});

test('the three repaired sites stay repaired', () => {
  // Named individually so a regression says WHICH one, rather than "an offender
  // appeared". These are the three that were live and are now fixed.
  const repaired = [
    'app/vendor-dashboard/clients/[eventId]/actions.ts',
    'app/vendor-dashboard/services/actions.ts',
    // Added 2026-08-29 when the host/MC cue composer was repaired. Its downstream
    // was the reason it waited: `event_schedule_blocks` carries a booked-vendor
    // read, and `vendor_block_scripts` / `vendor_lines` are FOR ALL on
    // `current_vendor_ids()`, which every real shop satisfies because
    // `/open-shop` seeds a founding admin seat. Proved end to end against
    // production in a rolled-back transaction before the gate was touched.
    'app/vendor-dashboard/clients/[eventId]/script-actions.ts',
    'app/vendor-dashboard/manpower/surface.tsx',
  ];
  for (const rel of repaired) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    const windows = clientWindowsFor(src);
    assert.ok(windows.length > 0, `${rel} stopped reading event_vendors entirely`);
    for (const win of windows) {
      assert.ok(
        /admin/i.test(win),
        `${rel} went back to reading event_vendors on a session client — a silent zero (…${win.slice(-48)})`,
      );
    }
  }
});
