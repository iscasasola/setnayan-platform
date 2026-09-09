## 2026-09-10 · fix(marketplace): the service cover photo now resolves to an address that exists

Every supplier is required to upload a cover photo before a service card can be
published, and on every couple-facing screen that photo was a broken image.

`<FileUpload>` persists `r2://bucket/key` (`/api/upload` → `encodeR2Ref`), so
`vendor_services.primary_photo_r2_key` holds the whole ref. Four couple-facing
sites handed that string to `r2PublicUrl(bucket, KEY)`, whose second argument is
an object key — `publicUrlFor` percent-encodes each path segment, so the scheme
became part of the path:

    https://<public-host>/r2%3A//setnayan-media/vendors/…  → 404
    https://<public-host>/vendors/…                        → 200 image/jpeg  (220,562 bytes)

Verified live on `/explore?q=saysay` before the fix, and against production: of
the two active service cards, the one with a cover was broken on Explore, on the
couple's vendors tab, and in the wizard's picks.

**Fixed:** one new resolver, `publicUrlForStoredAsset(storedValue)` in
`lib/uploads.ts`, over a pure `publicAssetTarget()` in
`lib/stored-asset-public-url.ts`. It accepts either shape a write path stores —
an `r2://` ref (`<FileUpload>`) or a bare object key (`uploadPublicAsset`) —
passes a legacy absolute URL through untouched, and returns `null` rather than a
broken address for a private bucket, an unknown bucket or a malformed ref.

`r2PublicUrl` / `publicUrlFor` are now called from the storage layer only.
All seven application call sites were classified: five were handed a value that
can be an `r2://` ref (Explore, the couple's vendors tab, the wizard ×2, the
shop's theft-watch thumbnails) and two already held a bare key (a host's manual
vendor photo, the admin's homepage background videos). All seven were routed
through the resolver; the two bare-key sites resolve to a byte-identical URL.

**Guard:** `lib/public-url-takes-a-key-not-a-ref.test.ts` — the call-site list is
DERIVED by walking every `.ts`/`.tsx` under `app/` and `lib/`, so a caller added
in a file nobody thought of fails the test. Five assertions, each
mutation-proved red with the occurrence count printed before → after; a docblock
that merely names `r2PublicUrl(` correctly stays green.

SPEC IMPACT: None — no schema, no migration, no price, no owner-locked
behaviour. The cover photo renders at the address the object has always had.

### Follow-up (same PR)

`lint-one-comment-stripper` caught the guard's own hand-rolled comment stripper
and was right to: a `//` line comment containing `/*` — `accept="image/*"`,
written constantly in this codebase — opens a block comment that never existed
and blanks every line to the next real close, silently shrinking what a source
scan can see. The guard now uses the repo's one string-aware stripper
(`lib/strip-comments.ts`), and a new mutation covers exactly that shape: a
trailing `// … r2PublicUrl(bucket, key) …` after an `image/*` string stays
green, where the naive `^\s*` anchor could not have stripped it at all.

### One line that is NOT this fix, carried because `main` was red for every PR

`origin/main` (`250520835`) fails `lib/story-light.test.ts` on its own — measured
in a clean detached worktree at that commit, with none of this branch's code in
it, and green at this branch's pre-merge commit.

PR #5380 widened that guard to scan the `[data-story-light]` wrapper's own file
and lifted 20 of the 21 sub-60 alphas in
`app/[slug]/_components/editorial/editorial-content.tsx`. The 21st — the
"previous edition" link it added in the same PR, line 442 — stayed at
`text-ink/55`, so the widened guard failed on the file it was widened for.
Every other alpha in that file is `/60`.

Lifted to `/60`, which is that PR's own stated intent and the darker (higher
contrast) direction, not a new colour decision. Carried here rather than split
out because a separate PR would have gone green without unblocking this one —
required checks pin the head SHA.
