## 2026-06-30 · docs(owner): how to ACTIVATE the as-built Papic face engine (host face-api model on R2)

The whole Papic face engine (on-device `face-api.js` embed in `lib/face-embed.ts` → `autoTagCapture` matcher in `lib/face-match.ts` → `guest_face_enrollments.face_vector` enrollment) is **shipped but dormant** for one reason, stated in the code: *"DORMANT until a model is hosted (`NEXT_PUBLIC_FACE_MODEL_URL`)."*

Added an `OWNER_ACTIONS.md` section documenting the one-time, no-code unblock: host `face-api.js` + the ssdMobilenetv1/landmark68/recognition weights on a public CORS-enabled R2 path, set `NEXT_PUBLIC_FACE_MODEL_URL` (+ optional `NEXT_PUBLIC_FACE_API_URL`), redeploy. Includes exact file list, where they go, and how to verify (enrollment `face_vector` goes non-null; captures auto-tag).

Corrects the earlier plan assumption that the face engine was an unbuilt ArcFace/server build — it is client-side face-api 128-d, already shipped. See `0012_papic/Papic_Walkup_Face_Identity_Plan_2026-06-29.md` § 2 (AS-BUILT) + § 10.

SPEC IMPACT: None (owner-action doc; no schema/code). The activation itself is an owner Vercel/R2 action.
