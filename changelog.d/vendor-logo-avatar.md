## 2026-07-02 · feat(vendors): logo-as-avatar on the My Shop hero + sidebar identity card

PR 1 of the approved My Shop profile + verification redesign (owner 2026-07-02:
"the logo will also replace the logo on the upper left once there is an
uploaded photo — the black with SF").

New shared `<VendorAvatar>` (`app/_components/vendor-avatar.tsx`): ONE rule for
every vendor identity tile — the uploaded **logo** when present (presigned R2
`<img>`, FileUpload thumbnail pattern), else the dark **2-letter initials**
tile. Callers own size/shape via className; the component owns the decision +
colors. Also exports `deriveVendorInitials`, consolidating the two byte-identical
`deriveInitials` copies that lived in `vendor-dashboard/layout.tsx` and
`shop/page.tsx`.

Rewired: the **My Shop Hero** avatar (was initials-only) and the **vendor
sidebar identity card** (was initials-only) now render the logo with initials
fallback. The public marketplace cards already had a photo→logo→initials
cascade, so all surfaces now agree. Layout resolves the presigned URL locally
(no network — S3 presign is CPU crypto), best-effort with initials fallback.

Pure presentation; no schema, no data writes. Verified `tsc`, `next lint`,
production `next build`.

SPEC IMPACT: None — visual identity rule on shipped surfaces.
