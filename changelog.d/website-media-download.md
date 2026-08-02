## 2026-08-02 · fix(admin): the Download button on Website media now actually downloads

`getDownloadUrlAction` minted a presigned GET with no `Content-Disposition`. R2 serves
these objects with their real media type, so clicking **Download** on an `.mp4` or `.jpg`
**played it in a browser tab and nothing reached the disk** — the user had to notice, then
right-click → Save As.

That is not cosmetic. `/admin/website-media` deletes permanently from an unversioned
bucket, and its whole safety story is *"download a copy first, then remove it."* A link
that silently previews instead of saving hollows that out while looking correct — the
owner asked "where do they go?" and the honest answer was "nowhere yet."

- `lib/content-disposition.ts` (new) — `contentDispositionAttachment()`, RFC 6266: a
  quoted ASCII `filename` plus a percent-encoded `filename*`. Quotes, backslashes and
  control characters are replaced in the ASCII form; unescaped, they terminate the header
  early and the browser falls back to the URL path, which for a presigned URL is a
  signature-laden mess.
- Its own module rather than `lib/r2.ts`, deliberately: `r2.ts` imports `server-only`,
  which cannot resolve under `tsx --test`, so a helper parked there is **untestable**.
  5 unit tests.
- `lib/r2.ts` — `r2SignedGet` gains `responseContentDisposition`, passed through as the S3
  `ResponseContentDisposition` param.

SPEC IMPACT: None. No schema change, no migration, no pricing or policy change.
