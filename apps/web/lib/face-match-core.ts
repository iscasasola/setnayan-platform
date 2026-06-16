// Papic face auto-tagging — PURE matcher core (no 'server-only', no DB, no model
// runtime), unit-testable and identical wherever embeddings are computed
// (browser-on-device today).
//
// CALIBRATED for the validated self-hosted model: the dlib face-recognition
// ResNet (128-d descriptors) via face-api.js — public-domain weights + MIT code,
// 99.38% LFW, commercially clean. dlib descriptors are compared with EUCLIDEAN
// distance (LOWER = more similar), NOT cosine. A real-faces validation
// (2026-06-17: Obama×2 / Biden×2) measured same-person distance 0.40–0.47 vs
// different-person 0.79–0.90 — so the bands are:
//
//   • distance ≤ 0.50         → AUTO-tag the guest
//   • 0.50 < distance ≤ 0.60  → SUGGEST a tag (human confirms; 0.60 = face-api's
//                                native match line, sitting in the validated gap)
//   • distance > 0.60         → leave untagged
//
// (The earlier ArcFace-style "cosine ≥ 0.85" framing is WRONG for dlib: on cosine
// different people scored 0.80–0.84, too close to 0.85 → false suggestions.
// Euclidean separates cleanly. Thresholds get final-tuned on real wedding photos.)
//
// Plus the corpus hard rule: max 10 tags per photo, COMBINED with existing
// individual/table/manual tags. A guest already tagged is never re-tagged; two
// faces that match one guest collapse to a single tag at the closer distance.

export const FACE_AUTO_MAX_DISTANCE = 0.5;
export const FACE_SUGGEST_MAX_DISTANCE = 0.6;
export const MAX_TAGS_PER_PHOTO = 10;

export type EnrollmentVec = {
  guestId: string;
  /** The guest's enrolled face descriptor (128-d for dlib/face-api.js). */
  vector: number[];
};

export type FaceMatch = {
  guestId: string;
  /** Euclidean distance to the closest matching face — LOWER is a better match. */
  distance: number;
};

export type AutoTagPlan = {
  /** Guests to auto-tag now (distance ≤ 0.50), capped to fit MAX_TAGS_PER_PHOTO. */
  autoTags: FaceMatch[];
  /** Guests to SUGGEST (0.50 < distance ≤ 0.60) — surfaced for human confirm, not written. */
  suggestions: FaceMatch[];
};

/**
 * Euclidean distance between two equal-length descriptors. Returns Infinity for
 * a length mismatch or empty vector — treated as "no match", never a false tag.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] as number) - (b[i] as number);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Decide auto-tags + suggestions for one photo from its detected face
 * descriptors and the event's enrolled guests. Pure: no I/O. The caller writes
 * `autoTags` as `photo_tags(source='auto_face', confidence)` rows and surfaces
 * `suggestions` for confirmation.
 */
export function planAutoTags(params: {
  /** One descriptor per face detected in the capture. */
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

  // Closest (smallest) distance per guest across all detected faces (dedupes two
  // faces that match the same guest → one tag at the closer distance).
  const bestByGuest = new Map<string, number>();
  for (const face of faceVectors) {
    for (const enr of enrollments) {
      if (already.has(enr.guestId)) continue;
      const dist = euclideanDistance(face, enr.vector);
      const prev = bestByGuest.get(enr.guestId);
      if (prev === undefined || dist < prev) bestByGuest.set(enr.guestId, dist);
    }
  }

  const autoCandidates: FaceMatch[] = [];
  const suggestions: FaceMatch[] = [];
  for (const [guestId, distance] of bestByGuest) {
    if (distance <= FACE_AUTO_MAX_DISTANCE) autoCandidates.push({ guestId, distance });
    else if (distance <= FACE_SUGGEST_MAX_DISTANCE) suggestions.push({ guestId, distance });
  }

  // Closest first — for both the cap truncation and stable output.
  autoCandidates.sort((a, b) => a.distance - b.distance);
  suggestions.sort((a, b) => a.distance - b.distance);

  // 10-tag cap is COMBINED with existing tags; auto-tags take the remaining slots
  // by closeness and never exceed it.
  const remaining = Math.max(0, MAX_TAGS_PER_PHOTO - already.size);
  const autoTags = autoCandidates.slice(0, remaining);

  return { autoTags, suggestions };
}
