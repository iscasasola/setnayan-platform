## 2026-07-26 · fix(security): bind the NSFW verdict to the bytes the guest receives (SEC-6)

**A host could publish an unscreened video to their public guest page with one PostgREST PATCH.**

`events.std_media` is the Save-the-Date closing-beat media choice, and it carried its own screening verdict:
`{type:'video', videoKey, posterKey, nsfw:'pending'|'approved'|'rejected'}`. The couple must be able to write that
column — they pick their own video. Postgres RLS is **row**-level, never column-level, and the Supabase anon key is
public, so:

```
PATCH /rest/v1/events?event_id=eq.<their-own-event>
{ "std_media": { "type":"video", "videoKey":"r2://…", "nsfw":"approved" } }
```

went straight past `saveAllStdContent`, whose refusal to accept a client verdict was real but enforced in the wrong
layer. That defeats a **locked product rule** — *"NSFW filter is on by default and CANNOT be disabled"*.

### Round one, and why it did not hold

The first cut moved the verdict into a host-unwritable column and bound it to two R2 keys plus a content fingerprint of
each object. An adversary review could not move the **privilege** half and broke the **binding** half:

> the fingerprint is computed against a DIFFERENT RESOURCE than the one the guest's browser fetches

Two parsers read the same `videoKey` string. The verify side (`parseR2Ref`) turned any non-`r2://` string into *a key
in the public media bucket* and HEADed it. The serve side (`parseStoredAsset`) returned the identical string
**verbatim as a URL** into `<video src>`. And `/api/upload`'s `sanitizePathPrefix` happily accepted a scheme-shaped
segment. So: upload a clean 2 KB decoy to the key `http:/evil.example/v/<uuid>-clip.mp4`, save that string as
`videoKey`, earn a genuine `approved` verdict for the decoy — and the browser resolves the same string to
`http://evil.example/…` and streams arbitrary unscreened video. The binding was real; it bound the wrong object.

### What shipped in round two

**1. ONE parser.** `resolveStdMedia(raw, eventId)` now takes the event id and runs both refs through `parseClientRef`
(SEC-1's strict, total parser) against per-role policies: `events/{eventId}/std-video/` for the video,
`events/{eventId}/std-video-poster/` for the poster. Anything else — a URL-shaped key, a foreign bucket, a private
bucket, another couple's object, a poster in the video slot, traversal, control characters — is **not a video**: the
row resolves to `{type:'gallery'}`, so nothing screens it and nothing serves it. There is no longer a lenient side for
a strict side to disagree with.

**2. The guest is never served the couple's object.** On a clean decision the screen **seals** the classified bytes: a
server-side R2 copy conditioned on the source ETag (`CopySourceIfMatch`), into `events/{id}/std-screened/{uuid}/…` —
a prefix `/api/upload` now refuses to presign for every bucket and every branch. The copy is HEADed afterwards and must
carry the same `<etag>:<bytes>`, so a backend that ignored the condition fails closed rather than sealing unverified
bytes. The verdict records `servedVideoKey` / `servedPosterKey`, and `stdVideoServeUrls` presigns **only those**.
`displayUrlForStoredAsset` is never called with `std_media` again.

This is what makes check-then-serve moot. A presigned GET cannot carry an `If-Match` (a browser cannot send the header
and S3 has no query-string equivalent), so shrinking the window between the HEAD and the GET could never close it. The
sealed object has **no writer**, so there is nothing to race: the 5-minute presigned-PUT replay lands on the couple's
upload key, which no guest reads; the 24-hour presign TTL and the 60-second ISR cache can only ever deliver the exact
bytes that were classified.

**3. The admin's approval is pinned to the bytes on screen.** The review queue presigns the couple's source objects
through the same strict parser (so a reviewer can never be shown a foreign origin) and passes their fingerprints into
Approve. `setStdVideoModeration` refuses with `stale-media` if the live bytes have moved since the page loaded, then
seals before writing.

**4. A grant-independent second lock.** The column `REVOKE` is the primary control and holds — but `20271005100000`
recomputes this table's grants from the live catalog as "every column minus a hard-coded deny-set", and
`std_media_nsfw` cannot be added to that deny-set. Re-applying that baseline would hand UPDATE back. The migration now
also installs `guard_events_std_media_nsfw_trg`, which **refuses the statement** for `authenticated`/`anon`. It is
explicitly *not* the rejected "preserve the old verdict" trigger — that one pins an approval onto swapped media; this
one carries nothing forward.

**5. Scope hole closed: the OTHER unscreened video.** `events.landing_page_hero_video_r2_key` (the Living Hero
boomerang) is a second couple-uploaded clip that plays full-bleed on the same public page with **no screening at all**.
It is gated off guest surfaces (`lib/guest-hero-video.ts`, `GUEST_HERO_VIDEO_PLAYBACK = false`) until it goes through
the same screen-and-seal spine; the hero still — already its poster — shows instead. **0 rows in prod**, so nothing
live stops playing. ⚠ Owner-visible: this pauses a shipped feature for a security reason; the file states exactly what
must ship to re-open it.

### What this still does NOT do

The classifier reads the **poster**, never the video's own frames (nsfwjs is image-only and the lambda has no ffmpeg).
Sealing makes the verdict cover exactly the bytes the guest receives; it does not make a poster-derived verdict a
statement about the video's content. A host who uploads a dirty video with a clean, unrelated poster still gets an
approval — bound, sealed, and wrong. What round two removes is *any clean JPEG from anywhere*: the poster must be this
event's own `std-video-poster` object. Closing the rest needs server-side frame extraction and belongs to the
platform-wide nsfw-screen sweep. **Stated, not hidden.**

### Nothing legitimate broke

`std_media` stays host-writable (asserted in the migration's post-condition — locking it would kill the video picker).
The couple still reads their own status. The one live prod video row passes the new strict parser unchanged (verified
read-only: `r2://setnayan-media/events/{its own id}/std-video/…` + a poster under `…/std-video-poster/`); it falls back
to the photo gallery until the opportunistic heal on the couple's own builder re-screens and seals it. An
`approved`-but-unsealed verdict reads as *pending* and stays in the admin queue, so fail-closed no longer also means
invisible.

### Tests

- `apps/web/lib/std-media.test.ts` — **30 cases**, one or more per divergence point, including the adversary's actual
  decoy attack (approve object A, arrange for the guest to be served object B → refuses) and the shorter
  single-segment variant they did not name (`http:evil.example/x.mp4`).
- `apps/web/tests/db/std-media-nsfw-verdict.db.test.ts` — **11 cases** against a real Postgres with
  `SET ROLE authenticated`. META asserts the session is genuinely un-privileged (not the table owner, no BYPASSRLS),
  two trap probes prove the grant snapshot was really reproduced, every denial has a `service_role` differential, and
  the new D18 case **restores the grant on purpose** and asserts the trigger still refuses — then drops the trigger
  in-test and watches the identical statement succeed, so the guard cannot be measured vacuously.

**Neutralisation, each half separately** (restored to green after each): lenient `resolveStdMedia` → **10/30** unit
fail; `stdVideoServeRefs` returns the source keys instead of the seals (round one's behaviour) → **7/30** fail;
`/api/upload` reserved-prefix guard removed → **2/30** fail; guard trigger not installed → **2/11** DB fail. The two
binding halves fail disjoint sets, so neither is being carried by the privilege half.

SPEC IMPACT: `0024_save_the_date/` — the Save-the-Date video verdict is `events.std_media_nsfw`, host-unwritable,
bound to the media (both R2 keys + content fingerprints) **and to a sealed, immutable copy of the screened bytes**,
which is what the public page serves. `std_media` refs are now format-pinned to
`r2://setnayan-media/events/{eventId}/std-video[-poster]/`. `events/{id}/std-screened/` is a **reserved key prefix**
no client upload may name. The Living Hero boomerang (`events.landing_page_hero_video_r2_key`) is withheld from guest
surfaces pending screening. No SKU, price, or pricing-surface change. Corpus `DECISION_LOG.md` row appended.
