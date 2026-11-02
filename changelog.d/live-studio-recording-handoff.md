## 2026-07-26 · feat(live-studio): the recording handoff — End means ended, and the couple gets their recordings

The last unbuilt item of the Wave 9 channel-pool model
(`Live_Studio_Unified_Spec_2026-07-25.md` § 4h, built to
`02_Specifications/09_Panood_Feature_Specification.md` § 6). Flag-dark behind
`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`. **No migration** — the streams table
already had `status` / `ended_at`.

**① A live defect, not just a missing feature.** Nothing in the codebase had ever
written a status update to `live_studio_roam_streams` — only the provisioning
INSERT. `endPanoodBroadcast` closed `panood_broadcasts` and left every camera
channel `'ready'` forever, which meant:

- `releasePoolChannelIfIdle` could never succeed for any event (it refuses while
  any stream is un-complete), so no path that consults it could free a channel;
- `events.live_studio_roam_manifest` was never rewritten, so the guest picker kept
  advertising all N cameras after the wedding — as the **only** watch block, since
  End does clear `panood_watch_url`.

`completeRoamBroadcasts` (new `lib/live-studio-recordings.ts`) completes the rows,
completes them on YouTube best-effort, and re-mirrors so the picker tears itself
down **through the existing § 4d publish gate, not around it**. Also fixes a
latent second bug: a host who ends and restarts now gets fresh broadcasts instead
of silently reusing ones YouTube already auto-completed.

**🔒 The local row is the source of truth**, matching the precedent CAST set in
this same action ("close it in the DB so the couple can always stop even if
YouTube errors"). The DB write runs even when YouTube fails wholesale — quota,
revoked token, network. The residual failure points the safe way: a YouTube
broadcast may linger while our picker stops advertising it. The reverse — a dead
camera advertised to guests forever — is what shipped today.

**② Delivery, exactly as § 6 specifies.** *"Couples download from their Setnayan
dashboard via a link that resolves the YouTube watch URL through the Data API."*
New `fetchYoutubeVideoArchives` (videos.list — **1 quota unit** for up to 50 ids,
vs 50 units for a liveBroadcasts write) resolves the archives; a "Your recordings"
card on the Live Studio setup page lists the program feed and every camera
channel. § 6 also **ruled out** the parallel R2 archive for V1 ("to avoid paying
for storage of content that's already free on YouTube"), so nothing here moves
bytes or writes to R2.

`archived` is **tri-state and the null matters**: `true` = YouTube confirmed an
archive, `false` = YouTube was asked and has none (never carried video, or the
broadcast ran past the 12-hour archive ceiling — § 4f ③), `null` = we could not
ask. A couple must never read "no recording" because our token expired.

**⚠ The copy says "watch", not "download".** § 6 says download, but the mechanism
it prescribes delivers watching: YouTube only offers a file download to the
channel's **owner** (via Studio), which is true for a BYO broadcast and false for
a Wave 9 pool broadcast on a Setnayan channel. The card states the condition
instead of assuming it. **The pool-side file handoff is unbuilt — owner decision.**

**⚠ DELETES NOTHING, and that is deliberate.** `liveBroadcasts.delete` is absent
from both new code and `panood-youtube.ts` (pinned by a test). Nothing in the
schema records whether a broadcast carried video — `went_live_at` has no writer —
so no code here can tell an empty container from a ceremony, and under that
uncertainty the only safe operation is to keep it. Release behaviour is unchanged:
still an explicit admin act.

**🚨 TWO DOCS DISAGREE, AND THE DIFFERENCE IS DESTRUCTIVE — owner settles.**
`Live_Studio_Cast_and_Roam_2026-07-23.md` § 4 and § 4h both end the handoff with
"the channel is then **wiped** + returned to the pool", while § 6 promises the
archive **indefinite retention** — which is also what makes a resolved watch link
a durable deliverable rather than a link that rots. Wiping would delete a wedding,
so it is not built.

Also: the Wave 9 end-path guard (`live-studio-channel-pool.test.ts`) pinned the
literal `getHeldChannelAccessToken(createAdminClient(), eventId)`; the client is
now hoisted (the teardown needs the same one), so that assertion was rewritten to
pin the two **properties** it encoded — flag-gated client construction, read-only
accessor — which is stricter than the literal was, because the gate is now named.

11 new tests (including an anti-vacuity control: the same fixtures are asserted to
publish 2 channels *before* the teardown, so the post-teardown 0 is the code's
doing and not the stub's), 4132/4132 unit green with the flag **off and on**,
typecheck + lint + production build pass.

SPEC IMPACT: `Live_Studio_Unified_Spec_2026-07-25.md` § 4k added (this wave) ·
`DECISION_LOG.md` row 2026-07-26 · the wipe-vs-indefinite-retention contradiction
and the pool-side download gap are both flagged for owner decision, not resolved.
