// RA 10173 consent veto for the PUBLIC recap (gap audit 2026-07-23 · B3).
//
// ── ✅ THE FACEBLOCK ARM, FIXED 2026-09-16 (PAP-7) ─────────────────────────
// For three weeks this module was the standing example of the defect it was
// written to prevent. `lib/every-guest-read-asks-the-blur-gate.test.ts` and
// `lib/papic-guest-blur-gate.ts` both named it in their own words: this gate
// *"implements the withdrawal half in TypeScript and has NO FaceBlock arm at
// all"*, while `papic_capture_needs_blur` treats FaceBlock as EVENT-WIDE — so
// on an event with a FaceBlock guest the venue wall and the shared pool blurred
// every frame and **the couple's PUBLIC EVENT PAGE did not.**
//
// 🔑 THE ARM IS NOT WRITTEN HERE. The `faceblock_enabled` column is never READ
// by this module — outside these comments the identifier does not occur, and a
// guard asserts that over comment-stripped source. The rule is asked of
// `papic_event_blurs_every_capture` — the single SQL definition that
// `papic_capture_needs_blur` is itself defined in terms of (migration
// `20271229892059`), so the recap and the wall cannot hold different ideas of
// what FaceBlock means. A TypeScript copy would have been the fifth, and a
// fifth copy is how the fourth one drifted.
//
// Isolated in its own module (no `server-only` import — the admin client is a
// TYPE-only import) so the editorial data layer can reuse it AND a unit test can
// exercise it with a stub client. See editorial/data.ts for the read sites.

import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Is this timestamp column actually set? NOT `asString` — a driver may hand a
 * `timestamptz` back as a Date (PostgREST sends a JSON string, PGlite sends a
 * Date), and coercing to string first would read a REAL BAKE as an absent one,
 * silently withholding every blurred stand-in. Presence is the question here,
 * never the value.
 */
function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

/** Local, dependency-free string coercion (mirrors data.ts `asString`). */
function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}

/**
 * Returns the set of capture ids the public recap must NOT serve in their
 * original form, for BOTH reasons owner ruling 1 of 2026-08-17 gives:
 *
 *   • **FaceBlock — EVENT-WIDE.** One live guest with `faceblock_enabled` means
 *     every capture on that event needs a blur. Asked of
 *     `papic_event_blurs_every_capture`, the SAME function
 *     `papic_capture_needs_blur` is defined in terms of — never re-implemented
 *     here. (Added 2026-09-16; see the block comment on this module.)
 *   • **Withdrawn photo consent — PER-PHOTO, via tags.** `guests.photo_consent
 *     = FALSE`, resolved through `photo_tags` — the SAME G2 veto the Live Photo
 *     Wall enforces (migration 20261112000545 `wall_visible_photos`).
 *
 * Any such capture must be WITHHELD from every public image read on the
 * editorial recap, regardless of the couple's curation: consent WINS over
 * curation.
 *
 * `failed` is true when the veto could not be resolved (a transient DB error).
 * Callers then fail CLOSED — withholding ALL papic captures (the recap degrades
 * to the couple's own manual `our_photos` uploads, which carry no guest tags)
 * rather than risk showing an opted-out guest. The `guests` table, its
 * `photo_consent` column, and `photo_tags` have existed since the first
 * migrations, so a "table missing" case is not expected for a real event; an
 * empty result simply means nobody opted out (the common case).
 */
export type ConsentVeto = {
  /**
   * Every capture whose ORIGINAL must never be shown — a guest who opted out is
   * tagged in it, OR the whole event is under FaceBlock.
   *
   * 🔑 **ONE FIELD, NOT A FIELD AND A FLAG.** The FaceBlock arm is folded in
   * HERE rather than carried beside it as an `eventWideBlur` boolean, because
   * SIX call sites read this set directly instead of going through
   * `publicKeyForCapture` — the recap's hero pick, three reads in
   * `_components/story/spine-data.ts`, `lib/story-arrangement-store.ts` and
   * `lib/story-cover.ts`. A separate flag would have been six new places to
   * remember, which is the exact disease that left the recap without a
   * FaceBlock arm for three weeks. Put the answer in the answer.
   */
  ids: Set<string>;
  /** Vetoed capture → its baked all-faces-blurred stand-in, where one exists. */
  safeKeyById: Map<string, string>;
  /** True when the veto itself could not be resolved ⇒ withhold everything. */
  failed: boolean;
};

/**
 * THE ONE PLACE THAT DECIDES WHAT A PUBLIC SURFACE MAY SHOW for a capture.
 *
 * Returns the object key to render, or `null` to show nothing at all.
 *
 * 🔑 A GATE, NOT A CHECK REPEATED TEN TIMES. `data.ts` consults the veto in ten
 * places; before the 2026-08-17 ruling each one independently dropped the row.
 * Teaching ten sites the new "…unless a blurred copy exists" rule is ten
 * chances to forget, and the eleventh surface makes eleven. Same reasoning as
 * the guest photo-wall mirror, which was fused into one gate for this reason.
 *
 * ⚖ MONOTONE BY CONSTRUCTION — this can only ever show LESS than the original,
 * never more:
 *   • not vetoed        → the original, exactly as before
 *   • vetoed + a bake   → the blurred stand-in (previously: nothing)
 *   • vetoed, no bake   → null (previously: nothing)
 *   • veto unresolved   → null (previously: nothing)
 * So no face that is hidden today becomes visible tomorrow. The softening only
 * ever turns "nothing" into "blurred".
 *
 * ⚠ THE BLUR IS ALL FACES, NOT ONE. `lib/face-blur.ts` blurs EVERY detected
 * face into the pixels; there is no per-person targeting and none is possible
 * until face recognition runs and guests enrol. A table of ten with one
 * opt-out renders as ten blurred faces. **The owner chose this knowingly on
 * 2026-08-18**, over keeping the photo hidden, because a hidden photo serves
 * nobody. Do not "improve" it into a partial blur without re-asking.
 */
export function publicKeyForCapture(
  veto: ConsentVeto,
  photoId: string | null | undefined,
  originalKey: string | null | undefined,
): string | null {
  if (!photoId || !originalKey) return null;
  if (veto.failed) return null;
  if (!veto.ids.has(photoId)) return originalKey;
  return veto.safeKeyById.get(photoId) ?? null;
}

/**
 * How many capture rows we are willing to enumerate for ONE event before we
 * stop trusting that we saw them all. Only reached on a FaceBlock event, where
 * the answer is "every capture", so the id set has to be complete: a capture we
 * failed to enumerate would be served UNBLURRED. Hitting this ceiling is
 * therefore a FAILED read, never a truncated one.
 */
const FACEBLOCK_ENUMERATION_CEILING = 20000;

type StandInSource = {
  table: 'papic_photos' | 'papic_guest_captures';
  idCol: 'photo_id' | 'capture_id';
  typeCol: 'photo_type' | 'media_type';
};

const CAPTURE_SOURCES: readonly StandInSource[] = [
  { table: 'papic_photos', idCol: 'photo_id', typeCol: 'photo_type' },
  { table: 'papic_guest_captures', idCol: 'capture_id', typeCol: 'media_type' },
];

/**
 * A capture's blurred stand-in, or null when it has none we may trust.
 *
 * ⛔ `wall_safe_r2_key` IS NOT PROOF OF A BLUR ON ITS OWN. `wall_ingest` stamps
 * it with `COALESCE(wall_safe_r2_key, r2_object_key)` — so on a capture that
 * needed no blur at ingest time it holds **the unblurred original**. Measured in
 * production 2026-09-16: of 25 `papic_photos`, exactly 1 carries a
 * `wall_safe_r2_key` and it is byte-identical to its `r2_object_key`. This gate
 * used to accept that key as a stand-in, which would have handed the original
 * back while believing it blurred — the one failure mode a blur gate cannot
 * have.
 *
 * `faceblock_baked_at` is the provenance `lib/face-blur.ts` writes and the only
 * one that means a bake happened; the venue wall (`wall_visible_photos`) and the
 * shared pool (`guest_pool_gallery`) have BOTH demanded it since 2026-08-24, and
 * so does `lib/papic-guest-blur-gate.ts`. The recap now agrees with all three.
 *
 * 🔒 A CLIP HAS NO SAFE FORM. `lib/face-blur.ts` bakes stills only and refuses
 * clips outright, so a clip needing a blur is DROPPED, never served — the same
 * refusal the pool makes.
 */
function trustedStandIn(row: Record<string, unknown>, src: StandInSource): string | null {
  if (!hasValue(row.faceblock_baked_at)) return null;
  if (asString(row[src.typeCol]) === 'clip') return null;
  return asString(row.safe_display_r2_key) ?? asString(row.wall_safe_r2_key);
}

export async function loadConsentVetoedPapicIds(
  admin: AdminClient,
  eventId: string,
): Promise<ConsentVeto> {
  const ids = new Set<string>();
  const safeKeyById = new Map<string, string>();

  // ── ARM 1 — FaceBlock, EVENT-WIDE (owner ruling 1, 2026-08-17) ───────────
  // Asked of the shared SQL definition, never re-implemented here. A rejected
  // RPC is `{ data: null, error }` and never throws, so `.error` is the only
  // way a missing grant or a stale signature is visible — and either one means
  // we do not know whether this event blurs, which is a FAILED veto.
  let eventWideBlur = false;
  try {
    const { data, error } = await admin.rpc('papic_event_blurs_every_capture', {
      p_event_id: eventId,
    });
    if (error) console.error('[supabase-error] app/[slug]/_components/editorial/consent-veto.ts · rpc:papic_event_blurs_every_capture', error);
    if (error) return { ids, safeKeyById, failed: true };
    eventWideBlur = data === true;
  } catch {
    return { ids, safeKeyById, failed: true };
  }

  if (eventWideBlur) {
    // Every capture on the event, both tables. The id set must be COMPLETE —
    // see FACEBLOCK_ENUMERATION_CEILING — so nothing is filtered server-side
    // here beyond the event itself.
    for (const src of CAPTURE_SOURCES) {
      let rows: Array<Record<string, unknown>>;
      try {
        const { data, error } = await admin
          .from(src.table)
          .select(
            `${src.idCol}, ${src.typeCol}, faceblock_baked_at, safe_display_r2_key, wall_safe_r2_key`,
          )
          .eq('event_id', eventId)
          .limit(FACEBLOCK_ENUMERATION_CEILING);
        if (error) console.error(`[supabase-error] app/[slug]/_components/editorial/consent-veto.ts · from:${src.table}.select`, error);
        if (error) return { ids, safeKeyById, failed: true };
        rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      } catch {
        return { ids, safeKeyById, failed: true };
      }
      if (rows.length >= FACEBLOCK_ENUMERATION_CEILING) {
        // We may not have seen them all, and an unseen capture is an unblurred
        // one. Withhold everything rather than most things.
        return { ids: new Set(), safeKeyById: new Map(), failed: true };
      }
      for (const r of rows) {
        const id = asString(r[src.idCol]);
        if (!id) continue;
        ids.add(id);
        const safe = trustedStandIn(r, src);
        if (safe) safeKeyById.set(id, safe);
      }
    }
  }

  // ── ARM 2 — withdrawn photo consent, PER-PHOTO via tags ─────────────────
  // Unchanged, deliberately. In particular it keeps its `deleted_at IS NULL`
  // filter, which the SQL predicate does NOT have: soft-deleting an opted-out
  // guest lifts this veto but not the wall's. That divergence is an OPEN OWNER
  // QUESTION already flagged at `app/dashboard/[eventId]/guests/[guestId]/
  // actions.ts` ("Whether that is the right rule is a question for the owner
  // and is NOT changed here") and is not decided in this PR either.
  let optedOutGuestIds: string[] = [];
  try {
    const { data, error } = await admin
      .from('guests')
      .select('guest_id')
      .eq('event_id', eventId)
      .eq('photo_consent', false)
      .is('deleted_at', null);
    if (error) return { ids: new Set(), safeKeyById: new Map(), failed: true };
    optedOutGuestIds = ((data ?? []) as Array<Record<string, unknown>>)
      .map((r) => asString(r.guest_id))
      .filter((v): v is string => Boolean(v));
  } catch {
    return { ids: new Set(), safeKeyById: new Map(), failed: true };
  }

  // Nobody opted out → arm 2 adds nothing. (Arm 1 may already have filled the
  // set, so this returns what we have rather than an empty veto.)
  if (optedOutGuestIds.length === 0) return { ids, safeKeyById, failed: false };

  // Every papic_photos capture that TAGS one of those guests is withheld. (A
  // 'photo' and a 'clip' both live in papic_photos, so this covers clips too.)
  //
  // ⚠ AN HONEST BOUNDARY: this arm reads `source_table = 'papic_photos'` only,
  // so a guest capture tagging a withdrawn guest is not vetoed by it. Arm 1
  // covers both tables; arm 2 never has. Named, not widened here — widening it
  // is a change to the withdrawal half and belongs in its own PR.
  const tagged = new Set<string>();
  try {
    const { data, error } = await admin
      .from('photo_tags')
      .select('source_id')
      .eq('event_id', eventId)
      .eq('source_table', 'papic_photos')
      .in('guest_id', optedOutGuestIds);
    if (error) return { ids: new Set(), safeKeyById: new Map(), failed: true };
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const id = asString(r.source_id);
      if (id && !ids.has(id)) tagged.add(id);
      if (id) ids.add(id);
    }
  } catch {
    return { ids: new Set(), safeKeyById: new Map(), failed: true };
  }

  // ── The blurred stand-ins (owner ruling 2026-08-17) ──────────────────────
  // A vetoed capture is no longer simply dropped: where a BAKED blurred
  // derivative exists it is shown INSTEAD of the original. Read here, once,
  // for the same reason the veto itself is — ten call sites downstream must
  // not each learn this rule.
  //
  // A read failure here is NOT `failed: true`. `failed` means "the veto could
  // not be resolved, withhold everything"; this query only ever ADDS a
  // softer option. If it errors, the map stays empty and every vetoed capture
  // is withheld — exactly the pre-ruling behaviour. Fail closed, quietly.
  //
  // ⚖ THE WEB COPY FIRST, THE PROJECTOR FILE AS FALLBACK (2026-08-24).
  // `wall_safe_r2_key` is a full-size blurred JPEG built for a venue projector.
  // Handing it to a phone is the exact cost the AVIF pipeline exists to avoid —
  // measured in this repo, a display copy averages 96 KB against a 780 KB max
  // for the full-size one. `safe_display_r2_key` is the blurred copy at the size
  // a public page actually renders. Rows baked before that column existed have
  // none, so the projector file stays as the fallback: **both are blurred, and
  // the fallback is heavier, never barer** — PROVIDED a bake actually happened,
  // which is why `trustedStandIn` demands `faceblock_baked_at`. Preferring the
  // smaller one is a COST fix, not a privacy fix, and must not be described as
  // one.
  if (tagged.size === 0) return { ids, safeKeyById, failed: false };
  const src = CAPTURE_SOURCES[0]!; // arm 2 is papic_photos only
  try {
    const { data, error } = await admin
      .from(src.table)
      .select(
        `${src.idCol}, ${src.typeCol}, faceblock_baked_at, safe_display_r2_key, wall_safe_r2_key`,
      )
      .eq('event_id', eventId)
      .in(src.idCol, [...tagged])
      .not('faceblock_baked_at', 'is', null);
    if (error) console.error(`[supabase-error] app/[slug]/_components/editorial/consent-veto.ts · from:${src.table}.select`, error);
    if (!error) {
      for (const r of (data ?? []) as unknown as Array<Record<string, unknown>>) {
        const id = asString(r[src.idCol]);
        const safe = trustedStandIn(r, src);
        if (id && safe) safeKeyById.set(id, safe);
      }
    }
  } catch {
    /* keep the map empty — every vetoed capture stays withheld */
  }

  return { ids, safeKeyById, failed: false };
}
