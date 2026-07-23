## 2026-07-23 · fix(security): public editorial page — fail-CLOSED media moderation gate

The public couple editorial page (`apps/web/app/[slug]/_components/editorial/data.ts`)
read Papic captures with a **fail-OPEN** moderation filter:
`.not('moderation_state','in','("nsfw_blocked","consent_withheld","faceblock_withheld")')`.
Two of those three excluded values (`consent_withheld`, `faceblock_withheld`) are
**never written by any code path** (verified: the only writers — `lib/nsfw-screen.ts`
and the couple un-block action — produce only `unscreened` | `clean` | `nsfw_blocked`),
so the filter reduced to "everything except `nsfw_blocked`" and let **`unscreened`**
(never-screened) media through onto a permanent public page. The worst case: a Papic
**clip** whose poster-frame extraction failed makes `screenCapture()` return early
(`nsfw-screen.ts`), leaving the row `unscreened` forever — and it **auto-played** on
the public recap. The `papic_guest_captures` reads (gallery / timeline / Kwento
anchors) had **no moderation filter at all**, on a false "no moderation_state column"
premise — the column exists (migration `20261104000959`) and is screened.

Fix: extracted the visibility predicate to `apps/web/lib/public-media-visibility.ts`
(`isPublicSafeModerationState` / `filterPublicSafeRows` / `PUBLIC_SAFE_MODERATION_STATE`),
a **fail-CLOSED allowlist** — a capture surfaces publicly only when
`moderation_state === 'clean'` (mirrors the canonical `guest-live-gallery` /
`life-story-moment-graph` allowlists). Every `papic_photos` read on the public page
now uses `.eq('moderation_state','clean')` (server-side) plus a client-side
`filterPublicSafeRows` defense-in-depth pass; the three `papic_guest_captures` reads
gained the same `'clean'` gate. Unit-tested (red/green mutation) in
`lib/public-media-visibility.test.ts`. Invariant-violating comments that claimed
"fail-closed" / "no NSFW column" were corrected in the same commit.

No migration; read-path only.

SPEC IMPACT: None. (Enforcement fix aligning the public editorial surface with the
already-documented `moderation_state='clean'` public-visibility rule; no SKU, schema,
or pricing change.)
