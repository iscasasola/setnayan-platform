/**
 * scan-trail.ts — THE ONE DOOR THROUGH WHICH A QR SCAN IS RECORDED.
 *
 * ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 * `guests.scan_tracking_opt_out` has existed since 2026-05-13, added by
 * `20260513050000_iteration_0002_invitation.sql` in the same migration as
 * `scan_events` itself and captioned there *"RA 10173 per-guest opt-out"*.
 * Measured against origin/main on 2026-09-02 it had **zero application
 * references — no reader AND no writer**. The repo half-knew: it sits in
 * `tests/db/gates-have-handles.baseline.txt` as `NOT INVESTIGATED`.
 *
 * A privacy switch nobody can flip violates nobody's consent. The danger ran
 * the other way: the next consent feature would add a FIFTH guest flag beside
 * a column built for exactly this choice, and then two mechanisms would
 * disagree about one fact, each passing its own tests.
 *
 * ── WHY A CHOKE POINT AND NOT FOUR EDITS ────────────────────────────────────
 * This defect fails by SILENT OMISSION. Four separate files inserted into
 * `scan_events` (all four kinds are live in production: 22 `invite_link`,
 * 4 `personal_qr_scan`, 1 `self_join`, 1 `self_join_bound_seed`). Honouring the
 * flag at three of them ships a switch that is stored and ignored — which is
 * indistinguishable, from the guest's side, from never having built it.
 *
 * So there is now exactly ONE place in the tree that writes `scan_events`, and
 * `lib/every-scan-goes-through-one-door.test.ts` fails if a second one appears.
 * A future door gets the opt-out for free, or it gets a red test.
 *
 * ── THE FAIL DIRECTION IS "DO NOT RECORD" ───────────────────────────────────
 * A row is written only when the guest's flag reads a positive `false`. An
 * unreadable flag, a missing guest row, or a thrown client all return without
 * inserting. The cost of the safe direction is small and bounded: the ONLY
 * reader of this trail is the first-arrival greeting in
 * `app/[slug]/_lib/loaders.ts`, whose own comment already records that no
 * evidence means "Hi again". The cost of the other direction is a scan trail
 * kept on somebody who asked us not to.
 *
 * ⚠ `guest_checkins` IS DELIBERATELY NOT COVERED — flagged, not slipped in.
 * That table carries `method = 'qr_scan'`, so it is literally a scan write
 * path, and it is excluded on purpose: it is the host's own door desk marking
 * a guest as arrived, it drives that guest's arrival greeting, and a guest
 * declining to be *tracked* should not vanish from the check-in desk at their
 * friend's wedding. If the owner reads the opt-out more broadly, the change
 * belongs here and the guard below is where it gets enforced.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** `public.scan_source` — the enum the column is constrained to. */
export type ScanSource = 'browser' | 'setnayan_native' | 'setnayan_din' | 'coordinator';

/**
 * The `context.entry` values written today. A union rather than a string so a
 * new door has to name itself here, in the diff, beside the others.
 */
export type ScanEntry =
  | 'invite_link'
  | 'personal_qr_scan'
  | 'plus_one_onboarded'
  | 'self_join'
  | 'self_join_bound_seed'
  | 'account_join';

/**
 * `recorded` — a row was written.
 * `declined` — the guest has opted out. Not an error; the switch worked.
 * `failed`   — we could not tell, or the insert failed. Also no row.
 *
 * Every caller treats a scan as best-effort and ignores this, by design: a
 * triage record must never be able to block a guest from getting in. It is
 * returned so the behaviour can be asserted rather than inferred.
 */
export type ScanOutcome = 'recorded' | 'declined' | 'failed';

/**
 * `scan_events.ip_anon`'s own comment: *"first 3 octets only per RA 10173"*.
 *
 * Consolidated from the three copies of this expression that existed before
 * (redeem · seat/claim · join). All three shared one flaw, preserved here as a
 * FIX rather than as behaviour: an IPv6 address contains no dots, so
 * `split('.').slice(0, 3).join('.')` returned it WHOLE and appended `.0` — the
 * full address, untruncated, in the column that exists to truncate it. IPv6
 * now keeps three hextets (a /48, the IPv4 /24 analogue) and nothing else.
 */
export function anonymizeIp(forwardedFor: string | null | undefined): string | null {
  const first = (forwardedFor ?? '').split(',')[0]?.trim() ?? '';
  if (!first) return null;
  if (first.includes(':')) return first.split(':').slice(0, 3).join(':') + '::';
  return first.split('.').slice(0, 3).join('.') + '.0';
}

export type ScanToRecord = {
  eventId: string;
  guestId: string;
  entry: ScanEntry;
  /** Defaults to `browser` — every door that exists today is a web request. */
  source?: ScanSource;
  userAgent?: string | null;
  /** Raw `x-forwarded-for`; truncated here so no caller can forget to. */
  forwardedFor?: string | null;
  /** The crew member who scanned somebody else's code. NULL for a self-scan. */
  scannerUserId?: string | null;
};

/**
 * Record one QR scan — unless this guest has asked us not to.
 *
 * Never throws: the callers are redirect paths and a triage record must not be
 * able to keep a guest out of their own invitation.
 */
export async function recordScan(
  supabase: SupabaseClient,
  scan: ScanToRecord,
): Promise<ScanOutcome> {
  try {
    const { data, error } = await supabase
      .from('guests')
      .select('scan_tracking_opt_out')
      .eq('event_id', scan.eventId)
      .eq('guest_id', scan.guestId)
      .maybeSingle();

    // 🔑 A POSITIVE `false`, NOT A FALSY DEFAULT. `?? false` would read an
    // unreadable flag as "they did not opt out" and record the scan anyway —
    // the exact shape that made the couple-side faceblock notice fire on a
    // failed read (see a-guest-can-blur-themselves.test.ts). The column is
    // NOT NULL DEFAULT FALSE, so a successful read is always a boolean, and
    // anything that is not `false` means we could not tell.
    const optOut = (data as { scan_tracking_opt_out?: unknown } | null)?.scan_tracking_opt_out;
    if (error || data === null) {
      console.warn('[recordScan] opt-out unreadable — recording nothing', {
        eventId: scan.eventId,
        entry: scan.entry,
        error: error?.message ?? 'no guest row',
      });
      return 'failed';
    }
    if (optOut !== false) return 'declined';

    const { error: insertError } = await supabase.from('scan_events').insert({
      event_id: scan.eventId,
      guest_id: scan.guestId,
      source: scan.source ?? 'browser',
      scanner_user_id: scan.scannerUserId ?? null,
      user_agent: scan.userAgent ?? null,
      ip_anon: anonymizeIp(scan.forwardedFor),
      context: { entry: scan.entry },
    });
    return insertError ? 'failed' : 'recorded';
  } catch {
    // Swallowed — triage only. See the contract above.
    return 'failed';
  }
}
