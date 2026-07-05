## 2026-07-05 · fix(ci): green the admin chat-guard — NPC compliance count is not a vector read

The `lint admin chat-guard` guard flagged the NPC compliance pages' active-face-enrollment
tally as a face-vector read. It isn't: `.select('*', { count: 'exact', head: true })` returns
a COUNT and streams zero rows/vectors. Added the guard's designed `// chat-guard-allow:` marker
(with rationale) to the two `.from('guest_face_enrollments')` count lines so the guard goes green
again — the privacy invariant (no admin surface reads raw face vectors) is fully preserved.

SPEC IMPACT: None — no behavior change; a reviewed, documented lint exception for a count-only query.
