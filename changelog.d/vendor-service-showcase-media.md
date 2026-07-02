## 2026-07-03 · feat(vendor): service-card redesign Phase 3c — showcase media (30s video + 5 photos)

Phase 3c of the service-card redesign (P1 schema #2640 · P2 coverage #2641 ·
P3a pricing #2643 · P3b list editors #2647 · P4 public card #2646). Vendors can
now attach the showcase media the schema holds: **one ≤30-second clip + up to 5
photos** per service card, on both the create and edit forms in My Shop.

- **`FileUpload` (shared) gains an additive `validateFile` prop** — an async
  content-rule validator run after the size/MIME checks, before upload. Returns
  an error string to reject (shown to the user) or null to accept. Fail-open on
  validator crash so a broken metadata read can never brick the upload path.
  Existing callers unaffected.
- **New `_components/showcase-media-fields.tsx`** — `ShowcaseMediaFields` renders
  two FileUploads persisting to `showcase_photo_r2_keys` (multi, `maxFiles={5}`,
  **watermarked** per the 2026-05-21 marketplace-photo directive) and
  `showcase_video_r2_key` (single, `compressVideo` in-browser transcode, and a
  **client-enforced 30s duration cap** via `validateFile` — hidden-`<video>`
  metadata read, +0.9s container-rounding tolerance, fail-open on unreadable
  codecs). `primary_photo_r2_key` stays the cover; this is the gallery + clip.
- **`services-manager.tsx`** — wired into the create form (`AddServiceForm` now
  takes `vendorProfileId` for the R2 path prefix) and the inline edit form
  (prefilled via `currentValue` + presigned `initialDisplayUrls`, resolved
  server-side in parallel and fail-soft per ref).
- **`actions.ts`** — new `parseShowcaseMedia()` (video: trimmed-or-null; photos:
  `getAll` → trimmed, deduped of blanks, sliced to 5 to match the DB CHECK)
  persisted by both `createVendorService` and `updateVendorService`.
- **`lib/vendor-services.ts`** — `VendorServiceRow` + `FULL_SELECT` + the legacy
  fallback now carry `showcase_video_r2_key` / `showcase_photo_r2_keys`.

No migration — activates the Phase-1 columns (`showcase_video_r2_key`,
`showcase_photo_r2_keys` with its cardinality ≤5 CHECK).

Hardened after a 3-lens adversarial review workflow (shared-component
regression · form↔action correctness · UX/locks; 3 confirmed findings, 0
blocking, 2 fixed in this PR):
- `contentTypeFromRef` gained `.mp4`/`.mov`/`.webm` → `video/*` cases so a
  seeded video `currentValue` renders the icon fallback instead of a broken
  `<img>` (video refs previously fell through to the `image/jpeg` default).
- The `validateFile` await now surfaces the existing `optimizing` progress
  strip ("Checking <file>…") — before, the dropzone sat idle-looking (and
  re-clickable) during validation since nothing was in `inFlight` yet.

Verified: tsc (0) · next lint (0) · prod build.

SPEC IMPACT: None beyond the already-logged redesign (see `DECISION_LOG`
2026-07-02/03). Remaining queue: guided-wizard child-table wiring
(`commitVendorService` still passes empty lists) · serves/faith Explore filter ·
public-card showcase-gallery render (couple side currently shows the cover) ·
duration backstop for probe-fail videos (enforce/trim in the ffmpeg compress
pass — the client cap fails open on unprobeable codecs; narrow bypass, see the
review verdict).
