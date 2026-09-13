/**
 * lib/papic-guest-blur-gate.ts — THE ONE PLACE a guest-facing read asks
 * *"must this capture be blurred before this person sees it?"*
 *
 * ── THE RULING THIS SERVES ─────────────────────────────────────────────────
 * Owner ruling 1 of 2026-08-17: *"Public = everyone except the couple — blur on
 * the venue wall, the public event page, and the shared pool other guests
 * browse. The couple's own album stays unblurred."* Ruling 2: a withdrawal
 * **BLURS AND KEEPS** rather than hiding, so one guest opting out cannot delete
 * a table of ten people's group photograph.
 *
 * Three surfaces were built for it — `wall_visible_photos`, `guest_pool_gallery`
 * and the public recap's `publicKeyForCapture` — and the 2026-08-24 decision row
 * recorded the pool as *"the last surface still vetoing."* **It was not.** The
 * per-guest reads — *"photos of you"* on the day-of page, the hub, your own day,
 * the account photo library, the Alaala wall, the guest's own Papic page — plus
 * the two routes that hand over the actual FILE and the story maker that bakes
 * one into a reel, all ask `moderation_state = 'clean'` and `hidden_at IS NULL`
 * and **nothing else**. So Ana withdraws her consent and Ben, at the same table,
 * still opens "photos of you", sees her unblurred, and downloads her at full
 * resolution.
 *
 * ⛔ AND FILTERING ON `moderation_state` WOULD NOT HAVE FIXED IT. The two states
 * that would hide such a row — `consent_withheld` and `faceblock_withheld` —
 * are in the CHECK constraint and have **ZERO WRITERS anywhere in the repo**
 * (verified 2026-09-09). Nothing ever sets them; a stricter allowlist changes
 * nothing.
 *
 * ── WHY A MODULE AND NOT SIX EDITS ─────────────────────────────────────────
 * This is exactly how the defect happened. `papic_capture_needs_blur` already
 * exists in production precisely because *"checking a column in three places is
 * three chances to forget, and the next surface makes four"* — and then four
 * more readers were written that never called it. The rule is asked HERE, once,
 * and every guest reader goes through `guestSafeKeyForCapture`.
 *
 * 🔑 THE PREDICATE IS NOT RE-IMPLEMENTED IN TYPESCRIPT. It is the SQL function
 * production already holds (`papic_captures_needing_blur`, the set form), so a
 * change to the rule cannot land on the wall and miss the gallery. Re-writing
 * its two clauses here would have been the fifth copy — and the public recap's
 * `consent-veto.ts` is the standing proof of what that costs: it implements the
 * withdrawal half in TypeScript and **has no FaceBlock arm at all**.
 *
 * ── WHAT IT DOES WITH "NO BLURRED COPY EXISTS YET" ─────────────────────────
 * The same thing all three shipped surfaces do: **WITHHOLD the frame.** The
 * pool admits a capture needing a blur only when `faceblock_baked_at IS NOT
 * NULL` and a blurred key exists; the wall withholds un-baked rows; the recap's
 * `publicKeyForCapture` returns null. No new answer is invented here.
 *
 * ⚖ MONOTONE BY CONSTRUCTION — this can only ever show LESS than today:
 *   • not blurred        → the original key, exactly as before
 *   • blurred + a bake   → the blurred stand-in (previously: the ORIGINAL)
 *   • blurred, no bake   → null, withheld (previously: the ORIGINAL)
 *   • gate unresolved    → null, withheld (previously: the ORIGINAL)
 * Nothing a guest can see today becomes invisible unless it needed a blur, and
 * nothing that was hidden becomes visible.
 *
 * 🔒 A CLIP NEEDING A BLUR IS DROPPED, NEVER SERVED. `lib/face-blur.ts` bakes
 * STILLS only and refuses clips outright, so a clip has no safe form; serving
 * one *"because a still was baked"* is the leak the pool already tests for.
 *
 * ⚠ THE BLUR IS ALL FACES, NOT ONE — owner chose that knowingly 2026-08-18. A
 * table of ten with one opt-out renders as ten blurred faces. Do not "improve"
 * it into a partial blur without re-asking.
 *
 * ⚠ THE COUPLE'S OWN ALBUM IS NOT A CALLER AND MUST NOT BECOME ONE.
 * `lib/papic-gallery.ts` (the couple's studio gallery) and
 * `lib/life-story-moment-graph.ts` (own celebrations only, `member_type =
 * 'couple'`) stay unblurred by the ruling. Every caller of this gate resolves a
 * GUEST id first.
 *
 * No `server-only` import: the admin client is a TYPE-only import, so the pure
 * decision below is reachable from `tsx --test` (same shape as
 * `app/[slug]/_components/editorial/consent-veto.ts`).
 */

import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export type CaptureSourceTable = 'papic_photos' | 'papic_guest_captures';

export type CaptureRef = {
  sourceTable: CaptureSourceTable;
  sourceId: string;
};

/** Which blurred size a reader wants. Both are blurred; this is a COST choice. */
export type BlurSize = 'thumb' | 'display';

/** The blurred stand-ins a capture actually carries, plus whether it is a still. */
export type SafeStandIn = {
  /** `safe_thumb_r2_key` — long-edge 320 AVIF, blurred. */
  thumb: string | null;
  /** `safe_tile_r2_key` — long-edge 640 AVIF, blurred. */
  tile: string | null;
  /** `safe_display_r2_key` ?? `wall_safe_r2_key` — both blurred, the latter heavier. */
  display: string | null;
  /** A real bake happened. Without it nothing here is trustworthy provenance. */
  baked: boolean;
  /** False for a clip — no video blur exists, so a clip is dropped, not served. */
  isStill: boolean;
};

export type GuestBlurGate = {
  /** `table:id` for every capture that must be blurred before a guest sees it. */
  needsBlur: Set<string>;
  /** `table:id` → its blurred stand-ins, for the ones that need them. */
  standIns: Map<string, SafeStandIn>;
  /**
   * True when the question itself could not be answered ⇒ withhold EVERYTHING.
   * Distinct from "the stand-in read failed", which withholds only the captures
   * already known to need a blur.
   */
  failed: boolean;
};

/** The map key. One spelling, so two readers cannot disagree about it. */
export function blurGateKey(sourceTable: string, sourceId: string): string {
  return `${sourceTable}:${sourceId}`;
}

/** A gate that answers "nothing needs blurring" — the common case, and the empty input. */
export function emptyBlurGate(): GuestBlurGate {
  return { needsBlur: new Set(), standIns: new Map(), failed: false };
}

/** A gate that withholds everything — used when the question cannot be answered. */
export function failedBlurGate(): GuestBlurGate {
  return { needsBlur: new Set(), standIns: new Map(), failed: true };
}

/**
 * THE DECISION. Returns the object key a guest may be served for this capture,
 * or `null` to show nothing at all.
 *
 * `originalKey` is whatever the caller would have served before this gate
 * existed. Pass it through unchanged when no blur is required — this function
 * never picks the unblurred size for you, it only ever replaces or withholds.
 */
export function guestSafeKeyForCapture(
  gate: GuestBlurGate,
  ref: CaptureRef,
  originalKey: string | null | undefined,
  size: BlurSize = 'thumb',
): string | null {
  if (!originalKey) return null;
  if (gate.failed) return null;

  const key = blurGateKey(ref.sourceTable, ref.sourceId);
  if (!gate.needsBlur.has(key)) return originalKey;

  const safe = gate.standIns.get(key);
  if (!safe) return null;
  // No video blur exists. A clip that needs one has no safe form at all.
  if (!safe.isStill) return null;
  // A stand-in with no bake behind it is not provenance we trust — the pool
  // makes the same demand (`faceblock_baked_at IS NOT NULL`).
  if (!safe.baked) return null;

  // Every candidate below is blurred; falling back is heavier or smaller,
  // never barer. Mirrors the unblurred preference chain one size at a time.
  const chain =
    size === 'display'
      ? [safe.tile, safe.display, safe.thumb]
      : [safe.thumb, safe.tile, safe.display];
  for (const candidate of chain) {
    if (candidate) return candidate;
  }
  return null;
}

/** True when this capture must not be served in any form to a guest. */
export function guestMustWithhold(gate: GuestBlurGate, ref: CaptureRef): boolean {
  return guestSafeKeyForCapture(gate, ref, 'probe', 'display') === null;
}

const SAFE_COLUMNS: Record<CaptureSourceTable, { id: string; type: string; select: string }> = {
  papic_photos: {
    id: 'photo_id',
    type: 'photo_type',
    select:
      'photo_id, photo_type, faceblock_baked_at, safe_display_r2_key, safe_tile_r2_key, safe_thumb_r2_key, wall_safe_r2_key',
  },
  papic_guest_captures: {
    id: 'capture_id',
    type: 'media_type',
    select:
      'capture_id, media_type, faceblock_baked_at, safe_display_r2_key, safe_tile_r2_key, safe_thumb_r2_key, wall_safe_r2_key',
  },
};

function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/**
 * Ask the database which of these captures need blurring, and read the blurred
 * stand-ins for the ones that do.
 *
 * A REJECTED QUERY IS NOT A THROWN ERROR — PostgREST answers a phantom
 * argument, a stale enum or a missing grant with `{ data: null, error }` and
 * never throws, so `.error` is the only way either failure is visible.
 */
export async function loadGuestBlurGate(
  admin: AdminClient,
  eventId: string,
  refs: readonly CaptureRef[],
): Promise<GuestBlurGate> {
  if (!eventId || refs.length === 0) return emptyBlurGate();

  const byTable = new Map<CaptureSourceTable, string[]>();
  for (const r of refs) {
    if (!r.sourceId) continue;
    if (r.sourceTable !== 'papic_photos' && r.sourceTable !== 'papic_guest_captures') continue;
    const list = byTable.get(r.sourceTable) ?? [];
    if (!list.includes(r.sourceId)) list.push(r.sourceId);
    byTable.set(r.sourceTable, list);
  }
  if (byTable.size === 0) return emptyBlurGate();

  const needsBlur = new Set<string>();
  const needingByTable = new Map<CaptureSourceTable, string[]>();

  for (const [table, ids] of byTable) {
    let rows: unknown;
    try {
      // The SET form of the shared predicate. `service_role` holds EXECUTE; the
      // callers of this gate all use the admin client.
      const { data, error } = await admin.rpc('papic_captures_needing_blur', {
        p_event_id: eventId,
        p_source_table: table,
        p_source_ids: ids,
      });
      if (error) return failedBlurGate();
      rows = data;
    } catch {
      return failedBlurGate();
    }
    const hits: string[] = [];
    for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
      const id = asString(row.source_id);
      if (!id) continue;
      hits.push(id);
      needsBlur.add(blurGateKey(table, id));
    }
    if (hits.length) needingByTable.set(table, hits);
  }

  // Nothing needs a blur — the common case, and no second query is worth it.
  if (needsBlur.size === 0) return emptyBlurGate();

  const standIns = new Map<string, SafeStandIn>();
  for (const [table, ids] of needingByTable) {
    const cols = SAFE_COLUMNS[table];
    try {
      const { data, error } = await admin
        .from(table)
        .select(cols.select)
        .eq('event_id', eventId)
        .in(cols.id, ids);
      // A stand-in read failure is deliberately NOT `failed`. `failed` means
      // "we do not know who needs a blur"; here we do, and an empty map already
      // withholds exactly those — the pre-ruling behaviour. Fail closed, quietly.
      if (error) continue;
      for (const raw of (data ?? []) as unknown as Array<Record<string, unknown>>) {
        const id = asString(raw[cols.id]);
        if (!id) continue;
        standIns.set(blurGateKey(table, id), {
          thumb: asString(raw.safe_thumb_r2_key),
          tile: asString(raw.safe_tile_r2_key),
          display: asString(raw.safe_display_r2_key) ?? asString(raw.wall_safe_r2_key),
          baked: Boolean(asString(raw.faceblock_baked_at)),
          isStill: asString(raw[cols.type]) !== 'clip',
        });
      }
    } catch {
      /* keep the map empty for this table — every capture in it stays withheld */
    }
  }

  return { needsBlur, standIns, failed: false };
}
