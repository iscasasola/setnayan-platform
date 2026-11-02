## 2026-07-08 · feat(papic): guest "Download my photos" — token-scoped ZIP of tagged captures

Guests could see their tagged photos on `/papic/me/[token]` ("Photos of you") but had no
way to pull them in bulk — only "open full size to save" per photo. The couple already had
a studio "download all" ZIP; guests had nothing.

- New token-scoped route `app/papic/me/[token]/download/route.ts` — resolves the guest by
  their personal `qr_token` (same credential the page uses), then streams every capture the
  guest is tagged in (`photo_tags`, `removed_at IS NULL` so a dropped "not me" tag is
  excluded, `moderation_state = 'clean'`, not hidden) as a ZIP. Mirrors the couple's
  `gallery-zip` route: `archiver` store mode (media already compressed), one object buffered
  at a time → bounded memory, streamed as built. Photos + clips (up to 500).
- "Download my photos" button on the guest page links to it (`Content-Disposition: attachment`).

Verify: `tsc --noEmit` → 0 new errors (6 pre-existing are unrelated vendor files on main).

SPEC IMPACT: Applied — `0012_papic/Papic_Live_Build_Plan_2026-07-08.md` Phase 3 (D6, guest half).
Closes the guest-download gap; the host download-all ZIP already shipped.
