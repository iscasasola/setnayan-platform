// ACCOUNT-LEVEL FACE PROFILE — owner-locked reversal of per-event scoping.
//
// Today face vectors are PER-EVENT scoped (guest_face_enrollments) and never
// reused across events. Owner decision (2026-06-26): a person's face profile may
// live on their SETNAYAN ACCOUNT and be reused to improve tagging accuracy
// across ANY event that person appears in (incl. other couples' events).
//
// ⚠ BIOMETRIC = SENSITIVE PERSONAL INFO under RA 10173. This whole feature is
// DORMANT behind NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED (default OFF). DPO
// sign-off on consent copy + retention is REQUIRED before the flag is flipped.
//
// MANDATORY PRIVACY GUARDRAILS honored by everything in this module:
//   1. OPT-IN, PER PERSON ONLY — a profile row exists only when the OWNER of the
//      face opts in (RLS: auth.uid() = user_id; consent_granted_at mandatory). A
//      couple can NEVER persist a guest's biometrics.
//   2. ONLY RECOGNIZES THAT SAME PERSON — an account vector is ONLY ever used to
//      tag ITS OWNER. `accountSeedsForEvent` returns, for an event, only the
//      profiles of users who are themselves guests at that event (linked via
//      event_members.user_id). It is NEVER a cross-person search index.
//   3. ACCOUNT-LEVEL DELETE — `forgetMyFaceEverywhere` wipes the profile (and
//      optionally the user's own per-event enrollments) in one action.
//   4. FLAG-GATED OFF — every entry point below returns a no-op when the flag is
//      OFF, so nothing reads or writes the table until the owner enables it.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The single source of truth for the account-face-profile feature flag. Both
 * the consent UI (server component) and the server-side matcher seed read this,
 * so there is no client/server drift. Inlined at build time (NEXT_PUBLIC_).
 *
 * Default OFF: returns true ONLY when the env var is exactly 'true'.
 */
export function accountFaceProfileEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED === 'true';
}

/** The consent-copy version a new opt-in is recorded against. Bump to force
 *  re-consent when the consent wording materially changes (DPO-gated). */
export const ACCOUNT_FACE_CONSENT_VERSION = 'v1';

export type AccountFaceSeed = {
  /** The owning user's id — the account profile is ONLY ever used to tag THIS user. */
  userId: string;
  /** The guest_id this user maps to AT THIS EVENT (so a match writes the right tag). */
  guestId: string;
  /** The account-level face descriptor(s) to seed recognition with. */
  vectors: number[][];
};

type AdminLike = SupabaseClient;

/**
 * For one event, fetch the account-level face seeds that may legitimately be
 * used — i.e. the CONSENTED, non-revoked, vectorized profiles of users who are
 * THEMSELVES guests at this event (event_members.user_id linked to a guest_id).
 *
 * This is the structural enforcement of guardrail #2: a profile is only ever
 * returned for the event(s) where its own owner is present, and the returned
 * `guestId` ties the seed to that owner's guest row — so a confirmed match can
 * only ever tag the person whose face it is. It is never a cross-person index.
 *
 * Returns [] when the flag is OFF (guardrail #4) or there are no eligible seeds.
 * Best-effort: any error degrades to [] (untagged-still-delivered guarantee).
 */
export async function accountSeedsForEvent(
  admin: AdminLike,
  eventId: string,
): Promise<AccountFaceSeed[]> {
  if (!accountFaceProfileEnabled()) return [];
  if (!eventId) return [];
  try {
    // Users who are guests AT THIS EVENT (and have a guest row). The (user_id,
    // guest_id) pair is the only bridge between an account profile and an
    // event-scoped tag — and we only ever cross it for the user's OWN event.
    const { data: members, error: memErr } = await admin
      .from('event_members')
      .select('user_id, guest_id')
      .eq('event_id', eventId)
      .not('user_id', 'is', null)
      .not('guest_id', 'is', null);
    if (memErr || !members || members.length === 0) return [];

    const guestByUser = new Map<string, string>();
    for (const m of members) {
      const uid = m.user_id as string | null;
      const gid = m.guest_id as string | null;
      if (uid && gid && !guestByUser.has(uid)) guestByUser.set(uid, gid);
    }
    const userIds = Array.from(guestByUser.keys());
    if (userIds.length === 0) return [];

    const { data: profiles, error: profErr } = await admin
      .from('user_face_profiles')
      .select('user_id, face_vector, vectors')
      .in('user_id', userIds)
      .is('revoked_at', null)
      .not('consent_granted_at', 'is', null)
      .not('face_vector', 'is', null);
    if (profErr || !profiles || profiles.length === 0) return [];

    const seeds: AccountFaceSeed[] = [];
    for (const p of profiles) {
      const userId = p.user_id as string;
      const guestId = guestByUser.get(userId);
      if (!guestId) continue;
      const vectors: number[][] = [];
      if (Array.isArray(p.face_vector) && p.face_vector.length > 0) {
        vectors.push(p.face_vector as number[]);
      }
      // `vectors` is an optional array-of-arrays of additional same-person samples.
      if (Array.isArray(p.vectors)) {
        for (const v of p.vectors as unknown[]) {
          if (Array.isArray(v) && v.length > 0) vectors.push(v as number[]);
        }
      }
      if (vectors.length > 0) seeds.push({ userId, guestId, vectors });
    }
    return seeds;
  } catch {
    return [];
  }
}

/**
 * Feedback loop: when a tag for `guestId` is CONFIRMED at `eventId`, fold the
 * confirming face descriptor back into that guest's OWNER's account profile to
 * improve future accuracy — but ONLY if that owner has opted in (a consented,
 * non-revoked profile exists). Records the event in source_event_ids for
 * provenance. No-op when the flag is OFF, the guest isn't linked to an opted-in
 * account, or there's no descriptor. Best-effort; never throws.
 *
 * NOTE: this only ever updates the profile of the SAME PERSON the tag is for
 * (guardrail #2) — a couple confirming a tag can never seed someone else's
 * biometrics, because we look up the OWNER's own opted-in profile by user_id and
 * only write when one exists.
 */
export async function refineAccountProfileFromConfirmedTag(
  admin: AdminLike,
  params: { eventId: string; guestId: string; faceVector: number[]; vectorModel?: string },
): Promise<{ refined: boolean }> {
  if (!accountFaceProfileEnabled()) return { refined: false };
  const { eventId, guestId, faceVector, vectorModel } = params;
  if (!eventId || !guestId || !Array.isArray(faceVector) || faceVector.length === 0) {
    return { refined: false };
  }
  try {
    // Which account owns this guest at this event?
    const { data: member } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    const userId = member?.user_id as string | undefined;
    if (!userId) return { refined: false };

    // Only refine an EXISTING opted-in profile — never create one as a side
    // effect (opt-in must be an explicit owner action, guardrail #1).
    const { data: profile } = await admin
      .from('user_face_profiles')
      .select('id, face_vector, vectors, source_event_ids')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .not('consent_granted_at', 'is', null)
      .limit(1)
      .maybeSingle();
    if (!profile) return { refined: false };

    const existingVectors = Array.isArray(profile.vectors) ? (profile.vectors as number[][]) : [];
    // Cap retained samples so the profile can't grow unbounded; keep the most
    // recent. (Centroid recompute is a later refinement once the model ships.)
    const MAX_SAMPLES = 10;
    const nextVectors = [...existingVectors, faceVector].slice(-MAX_SAMPLES);

    const srcSet = new Set<string>(
      Array.isArray(profile.source_event_ids) ? (profile.source_event_ids as string[]) : [],
    );
    srcSet.add(eventId);

    const patch: Record<string, unknown> = {
      vectors: nextVectors,
      source_event_ids: Array.from(srcSet),
      updated_at: new Date().toISOString(),
    };
    // Seed the primary face_vector from the first confirmed sample if empty.
    if (!Array.isArray(profile.face_vector) || (profile.face_vector as number[]).length === 0) {
      patch.face_vector = faceVector;
      if (vectorModel) patch.vector_model = vectorModel;
    }

    const { error } = await admin
      .from('user_face_profiles')
      .update(patch)
      .eq('id', profile.id);
    return { refined: !error };
  } catch {
    return { refined: false };
  }
}
