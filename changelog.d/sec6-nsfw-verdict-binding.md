## 2026-07-26 · fix(security): bind the NSFW verdict to the screened media (SEC-6)

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

**The obvious fix is worse than the bug.** A "preserve the OLD nsfw value on UPDATE" trigger *pins* an `approved`
verdict onto a video swapped underneath it: upload something clean, get approved, then repoint `videoKey` at anything
and keep the approval forever. A one-off bypass becomes a permanent one.

### What actually shipped

**1. The verdict moved out of the host's reach.** New column `events.std_media_nsfw`
(migration `20271007493007`), withheld from `authenticated` + `anon` and written only by the service-role screen.
`StdMedia` no longer has an `nsfw` field at all — a forged one is not merely ignored, it is unrepresentable, and
`resolveStdMedia` drops the key on parse. The migration also **strips** the legacy `nsfw` key out of every existing
`std_media` blob so nothing can re-wire it by mistake.

**2. The verdict is BOUND to the media it judged.** It records the `videoKey`, the `posterKey` that was actually
classified, and a content fingerprint (`<etag>:<bytes>`) of each object. `stdVideoIsLive` shows the video only when an
`approved` verdict names this exact pair; `stdVideoIsServable` additionally re-HEADs both objects and compares the
fingerprints before the public page serves anything. So:

- swap `videoKey` or `posterKey` → the verdict stops binding → not shown, and a re-screen is scheduled. No trigger, no
  cleanup job, nothing to forget to run.
- re-PUT different bytes to the **same** key → the ETag changes → not shown. Key identity alone was never enough:
  `/api/upload` hands the client a **5-minute** presigned PUT for a server-chosen key and the screen lands in seconds,
  so the host can swap the object under an approved key without touching the row.
- no verdict, malformed verdict, R2 unreadable, unknown bucket, missing ETag → **not shown**.

Unknown or stale ⇒ not shown, in every branch. `r2Head` gained an `etag` field to make that possible.

**3. Nothing legitimate broke.** `std_media` stays host-writable (asserted in the migration's post-condition — locking
it would kill the video picker). The couple still sees their status: `std_media_nsfw` is `GRANT SELECT`-ed to
`authenticated`, and an unbound verdict reads as *"being reviewed"* rather than the previous video's badge. The admin
override (`setStdVideoModeration`) now writes a bound verdict too, and **refuses to approve** when R2 cannot identify
the objects. A cron-free opportunistic heal on the couple's own builder page re-fires a dropped screen, throttled to
one attempt per 10 minutes — fail-closed means *invisible*, not *harmless*, so a legitimate video needed a way back.

Both grant snapshots (`20271005100000` UPDATE/INSERT, `20271007100000` SELECT) are computed at apply time, so the new
column was in neither. The migration states its privileges explicitly and asserts every half; the DB test reproduces
the prod ordering with two trap-probe columns so a passing result can only be attributed to this migration's own
GRANT/REVOKE.

**No verdict is backfilled.** Backfilling `approved` would bless a forgery if one had already happened and the row
cannot tell you which it is. Prod holds exactly **1** Save-the-Date video (verified: 1 video, 1 `approved`, 1 with a
poster); it falls back to the couple's photo gallery until the heal or an admin re-screens it.

### Tests

- `apps/web/lib/std-media.test.ts` — 19 cases on the pure binding rule: the forged key is dropped, junk fails closed,
  a key swap invalidates, a byte swap invalidates, an unreadable object is a mismatch and never a pass.
- `apps/web/tests/db/std-media-nsfw-verdict.db.test.ts` — 9 cases against a real Postgres with
  `SET ROLE authenticated`: a META test asserts the session is genuinely un-privileged (not the owner, no BYPASSRLS),
  two trap probes prove the grant snapshot was really reproduced, and every denial has a `service_role` differential.

Neutralisation verified: removing the binding from `stdVideoIsLive` fails 6 unit cases; stubbing
`stdVerdictMatchesContent` to `true` fails 3; letting `resolveStdMedia` keep the `nsfw` key fails 1; turning the
migration's `REVOKE` into a `GRANT` fails 3 DB cases.

SPEC IMPACT: `0024_save_the_date/` — the Save-the-Date video verdict is no longer a field of `events.std_media`; it is
`events.std_media_nsfw`, host-unwritable and bound to the media (both R2 keys + content fingerprints), and any change
to the media invalidates it. No SKU, price, or product-surface change; the platform NSFW lock is unchanged in intent
and now actually enforced at the data layer. Corpus `DECISION_LOG.md` row appended.
