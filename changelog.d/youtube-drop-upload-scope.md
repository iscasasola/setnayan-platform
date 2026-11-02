## 2026-07-25 · fix(oauth): drop the unused `youtube.upload` scope — it was reserved for a SKU that was retired a month ago

`YOUTUBE_OAUTH_SCOPES` requested **both** `.../auth/youtube` and `.../auth/youtube.upload`. The second one was never used.

**The evidence, not a guess.** `lib/panood-youtube.ts` is the ONLY module in the repo that touches the YouTube API, and it calls exactly three endpoints — `youtube/v3/channels` (read: which channel is connected), `youtube/v3/liveBroadcasts` (create / start / end the broadcast), and `youtube/v3/liveStreams` (bind the RTMP ingestion). All three are covered by `.../auth/youtube`. There is no `videos.insert`, no `upload/youtube/v3/*` call anywhere. The file's own comment says why Setnayan can't need it: *"Setnayan NEVER sends video bytes — the couple's encoder pushes to the stream key."*

**Why it was there:** the original comment stated `youtube.upload` was included "so the future 'Upload the same-day-edit back to the channel' feature (TODO(0011)) doesn't require a re-consent." That SKU — **SDE (Papic Add-on), ₱3,499** — was **owner-RETIRED 2026-06-28** ("remove same day edit", PR #2362). So the scope was being requested for a product that no longer exists.

**Why it matters now, not eventually.** Google reviews **"Requesting Minimum Scopes"** as its own axis during sensitive-scope verification (it's a dedicated page in the OAuth Quick Reference Guides). Carrying a broad, entirely-unexercised scope into that review is a standing rejection risk, and the fix is free. This lands ahead of the pending submission — see the 2026-07-25 homepage OAuth entry.

**Three call sites had to move together**, because a scope list that disagrees with itself is its own finding:

- `lib/panood-youtube.ts` — `YOUTUBE_OAUTH_SCOPES` is now a single entry. Comment records the removal, the retired-SKU reason, and that reviving an upload feature needs a consent-screen re-declaration + re-consent from already-connected users, not just an edit here.
- `app/privacy/page.tsx` § YouTube — **the live privacy policy disclosed `.../auth/youtube.upload` to users** ("upload videos · used by V1.5+ AI Edited Highlight"). Left alone it would have advertised a permission we no longer request — a policy that over-discloses is as wrong as one that hides, and Google reads the privacy policy during review. Now lists only the three scopes actually requested and states plainly that Setnayan does **not** request permission to upload videos.
- `COWORK_INBOX.md` — the owner's Google Cloud setup checklist instructed "add scopes `youtube` + `youtube.upload`", which would have silently re-introduced it at consent-screen configuration time. Now says `youtube` **and only that one**, with the reason inline.

**Owner action:** if `.../auth/youtube.upload` is already listed on the OAuth consent screen, remove it there too — the console is the authority for what's actually requested; this commit only stops the app from asking.

Already-connected users are unaffected: existing refresh tokens keep whatever they were granted, and `include_granted_scopes=true` is unchanged. No migration, no re-consent needed for the narrower set.

SPEC IMPACT: None — no SKU, price, or schema change. Removes a capability the product never shipped (SDE, retired 2026-06-28).
