import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { REENTRY_TTL_SECONDS, isUrlSecretShaped, type ReentryPurpose } from '@/lib/guest-pass-hop';

/**
 * lib/guest-reentry.ts — THE SHORT-LIVED, SINGLE-USE GUEST RE-ENTRY CODE.
 *
 * Carries a guest's pass across to ANOTHER cookie jar exactly once: a chat
 * app's own "Open in Safari" (the landing's `?k=`), or the iPhone home-screen
 * tile, which keeps its own cookies (the tile's start address `?k=`). The table,
 * its RLS and the why: supabase/migrations/20271263854263_a_guest_re_entry_code_is_single_use.sql.
 *
 * 🔒 THE RULES, each held by lib/guest-reentry.test.ts:
 *   · server-issued: 32 random bytes, base64url — never derived from the pass
 *     token (`guests.qr_token`) and never containing it;
 *   · stored ONLY as sha256 hex — the raw code exists in the URL and nowhere else;
 *   · exchanged ONCE: one conditional UPDATE (unused AND unexpired → used_at),
 *     so two racing opens cannot both win;
 *   · guest-scoped: it answers with the guest it was minted for, for the event
 *     it was minted on, and the caller writes that guest's NORMAL pass — never
 *     an account session.
 *
 * Every failure is an answer, never a throw: a code that cannot be minted is
 * simply not added to the URL (today's behaviour), and one that cannot be
 * exchanged sends the guest where they would have gone without it.
 */

export function hashReentryCode(code: string): string {
  return createHash('sha256').update(`setnayan-guest-reentry:${code}`).digest('hex');
}

export function newReentryCode(): string {
  return randomBytes(32).toString('base64url');
}

/** A SERVICE-ROLE client (the table has no browser grant). Passed in, so the
 *  test drives the real logic without a database; lib/guest-reentry.server.ts
 *  hands in the admin client. `null` = no client could be built. */
export type ReentryDb = SupabaseClient<any, any, any>;

/**
 * Mint one code for this guest. Returns the RAW code (for the URL) or null.
 * Clears the guest's already-dead codes on the way, so the table holds only
 * what can still be used (plus used codes until they expire).
 */
export async function mintReentryCode(
  input: { eventId: string; guestId: string; purpose: ReentryPurpose; now?: Date },
  db: ReentryDb | null,
): Promise<string | null> {
  const admin = db;
  if (!admin) return null;
  const now = input.now ?? new Date();
  const code = newReentryCode();
  try {
    // Housekeeping: a failed clear-out only leaves dead rows (each still
    // refused by its own expiry), so it is logged and the mint goes on.
    const { error: clearError } = await admin
      .from('guest_reentry_codes')
      .delete()
      .eq('guest_id', input.guestId)
      .lt('expires_at', now.toISOString());
    if (clearError) console.error('[supabase-error] lib/guest-reentry.ts · from:guest_reentry_codes.delete', clearError);
    const { error } = await admin.from('guest_reentry_codes').insert({
      code_hash: hashReentryCode(code),
      event_id: input.eventId,
      guest_id: input.guestId,
      purpose: input.purpose,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + REENTRY_TTL_SECONDS[input.purpose] * 1000).toISOString(),
    });
    if (error) {
      console.error('[supabase-error] lib/guest-reentry.server.ts · from:guest_reentry_codes.insert', error);
      return null;
    }
    return code;
  } catch (err) {
    console.error('[guest-reentry] mint threw', err);
    return null;
  }
}

/** Whose code this is (for this event), or null — read only, spends nothing. */
export async function reentryCodeGuest(
  input: { code: string | null | undefined; eventId: string },
  db: ReentryDb | null,
): Promise<string | null> {
  if (!isUrlSecretShaped(input.code)) return null;
  const admin = db;
  if (!admin) return null;
  try {
    const { data } = await admin
      .from('guest_reentry_codes')
      .select('guest_id')
      .eq('code_hash', hashReentryCode(input.code))
      .eq('event_id', input.eventId)
      .maybeSingle();
    return (data?.guest_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export type ReentryExchange =
  | { ok: true; guestId: string; eventId: string; qrToken: string; purpose: ReentryPurpose }
  | { ok: false; reason: 'malformed' | 'unknown' | 'used' | 'expired' | 'wrong-event' | 'guest-gone' | 'unreachable'; guestId?: string };

/**
 * Spend a code: the ONE conditional UPDATE marks it used only if it is unused,
 * unexpired and minted for THIS event. Nothing else is written here — the caller
 * (the redeem route) writes the guest's normal pass.
 */
export async function exchangeReentryCode(
  input: { code: string | null | undefined; eventId: string; now?: Date },
  db: ReentryDb | null,
): Promise<ReentryExchange> {
  if (!isUrlSecretShaped(input.code)) return { ok: false, reason: 'malformed' };
  const admin = db;
  if (!admin) return { ok: false, reason: 'unreachable' };
  const now = (input.now ?? new Date()).toISOString();
  const hash = hashReentryCode(input.code);
  try {
    const { data: spent, error } = await admin
      .from('guest_reentry_codes')
      .update({ used_at: now })
      .eq('code_hash', hash)
      .eq('event_id', input.eventId)
      .is('used_at', null)
      .gt('expires_at', now)
      .select('guest_id, event_id, purpose')
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] lib/guest-reentry.server.ts · from:guest_reentry_codes.update', error);
      return { ok: false, reason: 'unreachable' };
    }
    if (!spent) {
      // Why not — read only to NAME the refusal for the Problems log.
      const { data: row } = await admin
        .from('guest_reentry_codes')
        .select('guest_id, event_id, used_at, expires_at')
        .eq('code_hash', hash)
        .maybeSingle();
      if (!row) return { ok: false, reason: 'unknown' };
      const guestId = row.guest_id as string;
      if (row.event_id !== input.eventId) return { ok: false, reason: 'wrong-event' };
      if (row.used_at) return { ok: false, reason: 'used', guestId };
      return { ok: false, reason: 'expired', guestId };
    }
    const { data: guest } = await admin
      .from('guests')
      .select('guest_id, event_id, qr_token')
      .eq('guest_id', spent.guest_id as string)
      .eq('event_id', input.eventId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!guest?.qr_token) return { ok: false, reason: 'guest-gone' };
    return {
      ok: true,
      guestId: guest.guest_id as string,
      eventId: guest.event_id as string,
      qrToken: guest.qr_token as string,
      purpose: spent.purpose as ReentryPurpose,
    };
  } catch (err) {
    console.error('[guest-reentry] exchange threw', err);
    return { ok: false, reason: 'unreachable' };
  }
}

/* ══ ONE TILE CODE PER GUEST PER DAY (2026-10-04, the train-g audit) ═══════════
   The thank-you names the tile's manifest with a code, and it used to MINT a
   fresh one on EVERY render — a reload, a prefetch, a back-and-forth each wrote
   another live 24-hour code for the same guest. A code is stored only hashed,
   so an existing one cannot be read back to reuse; the tile code is therefore
   DERIVED — an HMAC, under a server-only key, of (event, guest, UTC day, n) —
   so every render that day names the SAME code, and the row behind it is
   written once:

     · `readTileReentryCode` — READ ONLY: the first of the day's candidates
       that is not yet spent (and whether its row is stored);
     · `ensureTileReentryCode` — that same code, its row written if it is not
       there yet (a concurrent twin's duplicate key is the same row, not a
       failure) — and NULL unless the row is stored, so a code whose write
       failed is never named (the tile would start at a dead exchange). The
       thank-you's metadata and body share ONE call per request.

   `n` exists only so a tile already made today (its code SPENT) does not leave
   a second tile, added the same day, without a code: at most
   `TILE_CODES_PER_DAY` codes per guest per day, ever. Still 32 bytes, still
   stored only as sha256, still spent once by the same exchange; never derived
   from the pass token. No key → no code (the plain manifest), never a throw. */
export const TILE_CODES_PER_DAY = 3;

type Row = Record<string, unknown>;

export type TileCodeInput = { eventId: string; guestId: string; now?: Date; key: string | null };

/** The day's candidate codes, in order. Pure. */
export function tileCodeCandidates(input: TileCodeInput): string[] {
  if (!input.key) return [];
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  // A sub-key, so the material is never used directly for anything but this.
  const subKey = createHmac('sha256', input.key).update('setnayan:guest-reentry-tile-key:v1').digest();
  return Array.from({ length: TILE_CODES_PER_DAY }, (_, n) =>
    createHmac('sha256', subKey).update(`${input.eventId}|${input.guestId}|${day}|${n}`).digest('base64url'),
  );
}

/** Today's tile code for this guest — READ ONLY. `stored` = its row exists. */
export async function readTileReentryCode(
  input: TileCodeInput,
  db: ReentryDb | null,
): Promise<{ code: string; stored: boolean } | null> {
  const candidates = tileCodeCandidates(input);
  if (!db || candidates.length === 0) return null;
  const nowIso = (input.now ?? new Date()).toISOString();
  try {
    const { data, error } = await db
      .from('guest_reentry_codes')
      .select('code_hash, event_id, guest_id, purpose, used_at, expires_at')
      .in('code_hash', candidates.map(hashReentryCode));
    if (error) {
      console.error('[supabase-error] lib/guest-reentry.ts · from:guest_reentry_codes.select(tile)', error);
      return null;
    }
    const rows = new Map(((data ?? []) as Row[]).map((r) => [r.code_hash as string, r]));
    for (const code of candidates) {
      const row = rows.get(hashReentryCode(code));
      if (!row) return { code, stored: false };
      const live =
        row.event_id === input.eventId &&
        row.guest_id === input.guestId &&
        row.purpose === 'tile' &&
        !row.used_at &&
        String(row.expires_at) > nowIso;
      if (live) return { code, stored: true };
    }
    return null;
  } catch (err) {
    console.error('[guest-reentry] tile read threw', err);
    return null;
  }
}

/** Today's tile code, its row written if missing — the page body, never the metadata. */
export async function ensureTileReentryCode(input: TileCodeInput, db: ReentryDb | null): Promise<string | null> {
  const pick = await readTileReentryCode(input, db);
  if (!pick || !db) return null;
  if (pick.stored) return pick.code;
  const now = input.now ?? new Date();
  try {
    // The once-a-day write also clears the guest's dead codes (as a mint does).
    const { error: clearError } = await db
      .from('guest_reentry_codes')
      .delete()
      .eq('guest_id', input.guestId)
      .lt('expires_at', now.toISOString());
    if (clearError) console.error('[supabase-error] lib/guest-reentry.ts · from:guest_reentry_codes.delete(tile)', clearError);
    const { error } = await db.from('guest_reentry_codes').insert({
      code_hash: hashReentryCode(pick.code),
      event_id: input.eventId,
      guest_id: input.guestId,
      purpose: 'tile',
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + REENTRY_TTL_SECONDS.tile * 1000).toISOString(),
    });
    // A twin render wrote the same row first — it is this code's row.
    if (error && (error as { code?: string }).code !== '23505' && !/duplicate key/i.test(error.message ?? '')) {
      console.error('[supabase-error] lib/guest-reentry.ts · from:guest_reentry_codes.insert(tile)', error);
      return null;
    }
    return pick.code;
  } catch (err) {
    console.error('[guest-reentry] tile ensure threw', err);
    return null;
  }
}
