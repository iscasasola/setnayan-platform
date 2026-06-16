// Papic face auto-tagging — PURE matcher core (no 'server-only', no DB, no model
// runtime), so it's unit-testable under `tsx --test` and identical wherever the
// embeddings are computed (browser-on-device today). Encodes the locked policy:
//
//   • confidence ≥ 0.85  → AUTO-tag the guest
//   • 0.65 ≤ conf < 0.85 → SUGGEST a tag (human confirms)
//   • conf < 0.65        → leave untagged
//   • Max 10 tags per photo, COMBINED with existing individual/table/manual tags
//     (corpus hard constraint). Auto-tags never push a photo past the cap.
//
// "Confidence" is cosine similarity between L2-normalized face embeddings, in
// [-1, 1]. The thresholds mirror the spec (CLAUDE.md · iteration 0012). A guest
// already tagged on the photo (by QR/manual/auto) is never re-tagged. Two faces
// that both match one guest collapse to a single tag at the higher confidence.

export const FACE_AUTO_THRESHOLD = 0.85;
export const FACE_SUGGEST_THRESHOLD = 0.65;
export const MAX_TAGS_PER_PHOTO = 10;

export type EnrollmentVec = {
  guestId: string;
  /** L2-normalized face embedding for this guest's enrolled selfie. */
  vector: number[];
};

export type FaceMatch = {
  guestId: string;
  /** Cosine similarity of the best-matching face for this guest, in [-1, 1]. */
  confidence: number;
};

export type AutoTagPlan = {
  /** Guests to auto-tag now (conf ≥ 0.85), capped to fit MAX_TAGS_PER_PHOTO. */
  autoTags: FaceMatch[];
  /** Guests to SUGGEST (0.65 ≤ conf < 0.85) — surfaced for human confirm, not written. */
  suggestions: FaceMatch[];
};

/**
 * Cosine similarity of two equal-length vectors. Returns 0 for a length
 * mismatch or a zero-magnitude vector (treated as "no signal", never a match).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] as number;
    const bv = b[i] as number;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Decide auto-tags + suggestions for one photo from its detected face
 * embeddings and the event's enrolled guests. Pure: no I/O. The caller writes
 * `autoTags` as `photo_tags(source='auto_face', confidence)` rows and surfaces
 * `suggestions` for confirmation.
 */
export function planAutoTags(params: {
  /** One embedding per face detected in the capture. */
  faceVectors: number[][];
  /** The event's consented, non-revoked enrollments (caller filters those). */
  enrollments: EnrollmentVec[];
  /** Guests already tagged on this photo (QR/manual/auto) — never re-tagged, and they fill the cap. */
  alreadyTaggedGuestIds?: string[];
}): AutoTagPlan {
  const { faceVectors, enrollments } = params;
  const already = new Set(params.alreadyTaggedGuestIds ?? []);

  if (faceVectors.length === 0 || enrollments.length === 0) {
    return { autoTags: [], suggestions: [] };
  }

  // Best confidence per guest across all detected faces (dedupes two faces that
  // match the same guest → one tag at the higher confidence).
  const bestByGuest = new Map<string, number>();
  for (const face of faceVectors) {
    for (const enr of enrollments) {
      if (already.has(enr.guestId)) continue;
      const conf = cosineSimilarity(face, enr.vector);
      const prev = bestByGuest.get(enr.guestId);
      if (prev === undefined || conf > prev) bestByGuest.set(enr.guestId, conf);
    }
  }

  const autoCandidates: FaceMatch[] = [];
  const suggestions: FaceMatch[] = [];
  for (const [guestId, confidence] of bestByGuest) {
    if (confidence >= FACE_AUTO_THRESHOLD) autoCandidates.push({ guestId, confidence });
    else if (confidence >= FACE_SUGGEST_THRESHOLD) suggestions.push({ guestId, confidence });
  }

  // Highest-confidence first — both for the cap truncation and for stable output.
  autoCandidates.sort((a, b) => b.confidence - a.confidence);
  suggestions.sort((a, b) => b.confidence - a.confidence);

  // 10-tag cap is COMBINED with existing tags; auto-tags take the remaining slots
  // by confidence and never exceed it.
  const remaining = Math.max(0, MAX_TAGS_PER_PHOTO - already.size);
  const autoTags = autoCandidates.slice(0, remaining);

  return { autoTags, suggestions };
}
