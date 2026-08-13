import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { extractWriteSites } from './query-column-scan';

/**
 * lib/security/events-write-grants.ts — every `events` column an RLS CLIENT
 * writes must be granted to that client. Columns only the SERVICE ROLE writes
 * need no grant, and demanding one would be wrong.
 *
 * ── THE DEFECT THIS EXISTS TO CATCH, MEASURED 2026-08-13 ───────────────────
 * `finalizeVendor` forms the couple's date when they lock a supplier, in ONE
 * UPDATE naming six columns. Five were grantable to `authenticated`. The sixth,
 * `date_forced_by_lock_of`, was not — so **Postgres rejected the whole
 * statement, 42501, every single time**, because privileges are checked against
 * the columns NAMED, not the values changed. A rejected query is not a thrown
 * error: the code read "no rows" and moved on. Prod: **zero events have ever
 * had their date formed by locking a supplier.** The feature never ran once.
 *
 * 🔑 IT WAS NOT A SECURITY DECISION. `public.events` has NO table-level UPDATE
 * for authenticated (relacl `authenticated=dDxtm`); 188 of its 202 columns are
 * granted individually by the 20271005100000 baseline, which computed its
 * allow-list from the LIVE catalog at that moment. Any column added AFTER that
 * migration inherits **nothing**, and the migration that added this one
 * (20271106090000) contains no GRANT at all.
 *
 * ── WHY THE CLIENT MUST BE RESOLVED, NOT ASSUMED ──────────────────────────
 * Measured: SEVEN columns are written by app code and lack the grant. SIX of
 * them are CORRECT — five are `createAdminClient()` writes (service role
 * bypasses grants) and `std_media_nsfw` is deliberately revoked and held by
 * `guard_events_std_media_nsfw_trg`. A guard that ignored the client would
 * report six false alarms alongside the one real defect — and a guard that
 * cries wolf teaches you to skim past the time it is right.
 */

/** A column written to `public.events`, and how. */
export type EventsWrite = {
  column: string;
  file: string;
  /** True when the write goes through the service role, which bypasses grants. */
  viaAdminClient: boolean;
};

/**
 * Which client performs the write on `line` (1-indexed).
 *
 * Two shapes cover the codebase:
 *   `await createAdminClient().from('events').update({…})`            — inline
 *   `const admin = createAdminClient(); await admin.from('events')…`   — variable
 *
 * 🪤 THE FIRST VERSION OF THIS FUNCTION COULD NOT FIRE. It took a character
 * `index` that `SelectSite` does not carry — the type has `line` — so the
 * lookback window was always empty and EVERY write was classified RLS,
 * including the five service-role ones. It was caught by printing the
 * classification counts rather than trusting the green: `admin=0` is not a
 * plausible number in this codebase. An unmeasured resolver proves nothing.
 *
 * ⚠ Deliberately conservative: an unrecognised shape is reported as an RLS
 * client, because that direction produces a NOISY failure a human reads, and
 * the other produces silence — the exact failure this file exists to end.
 */
export function writeIsViaAdminClient(source: string, line: number): boolean {
  const lines = source.split('\n');
  const at = Math.max(0, Math.min(lines.length - 1, line - 1));
  // The chain may start a few lines above the column list.
  const window = lines.slice(Math.max(0, at - 10), at + 1).join('\n');
  if (/createAdminClient\s*\(/.test(window)) return true;

  // `<expr>.from('events')` — take the receiver, which may be a member path.
  const m = /([A-Za-z_$][\w$.]*)\s*\n?\s*\.from\(\s*'events'\s*\)/.exec(window);
  if (m) {
    const receiver = m[1]!;
    if (receiver === 'createAdminClient') return true;

    // 🪤 THE INJECTED-CLIENT TRAP. The admin client is frequently not a local
    // `const` at all — it arrives as a FUNCTION PARAMETER or on a context
    // object (`ctx.admin`, `admin`). Resolving only local assignments
    // misclassified two service-role writers as RLS writers on the first run:
    // `lib/sku-activation.ts` (`ctx.admin`) and
    // `lib/live-studio-roam-provision.ts` (an `admin` parameter) — both of them
    // columns the deny-set withholds ON PURPOSE, so the guard was about to
    // demand grants that must never exist.
    //
    // The last path segment is the signal. A NAMING CONVENTION IS NOT A
    // SECURITY CONTROL — but this is a CLASSIFIER, not a control, and its
    // failure direction is a noisy false alarm a human reads rather than the
    // silence this file exists to end. The grant itself is still enforced by
    // Postgres.
    const tail = receiver.split('.').pop() ?? receiver;
    if (/^admin$/i.test(tail) || /Admin$/.test(tail)) return true;

    const above = lines.slice(0, at + 1).join('\n');
    const assign = new RegExp(
      `(?:const|let|var)\\s+${tail.replace(/[^\w$]/g, '')}\\s*(?::[^=]+)?=\\s*(?:await\\s+)?createAdminClient\\s*\\(`,
    );
    if (assign.test(above)) return true;
  }
  return false;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** Every column written to `public.events` across app/ and lib/, with its client. */
export function collectEventsWrites(webRoot: string): EventsWrite[] {
  const out: EventsWrite[] = [];
  for (const file of [...walk(join(webRoot, 'app')), ...walk(join(webRoot, 'lib'))]) {
    const src = readFileSync(file, 'utf8');
    for (const site of extractWriteSites(src, file) as Array<{
      table?: string;
      columns?: string[];
      line?: number;
    }>) {
      if (site.table !== 'events') continue;
      const viaAdmin = writeIsViaAdminClient(src, site.line ?? 0);
      for (const column of site.columns ?? []) {
        out.push({ column, file: file.replace(`${webRoot}/`, ''), viaAdminClient: viaAdmin });
      }
    }
  }
  return out;
}

/**
 * Columns an RLS client writes — the set that MUST be grantable.
 * A column written by both clients counts as RLS-written: the stricter reading
 * is the safe one.
 */
export function rlsWrittenColumns(writes: readonly EventsWrite[]): string[] {
  const rls = new Set<string>();
  for (const w of writes) if (!w.viaAdminClient) rls.add(w.column);
  return [...rls].sort();
}
