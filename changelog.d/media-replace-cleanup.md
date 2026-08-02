## 2026-08-02 · fix(admin): delete the object a media upload replaces, instead of stranding it

Two admin upload paths repointed a database row at a new key and left the old object in
`setnayan-media` forever:

- **`admin/background-videos`** — `saveBackgroundVideo` wrote the new `video_r2_key` and
  never called `r2Delete`. One stranded clip per replace, since launch.
- **`admin/hero-video`** — `saveHeroVideo` writes an entirely **new
  `hero-frames/<sessionId>/` folder** on every upload, so a re-upload stranded the whole
  previous frame sequence. These are the bulkiest leftovers in the bucket.

`/admin/website-media` (added the same day) made the resulting pile visible; this stops it
growing. **Existing orphans are deliberately not touched** — the owner removes those one at
a time from that page, which puts a Download link beside every Delete.

### Two independent reasons are required before anything is deleted

This runs **unattended on a publish path**, unlike the admin page where a human clicks each
row, so one reason isn't enough:

1. `retirableKeys()` (`lib/media-retirement.ts`, pure + 10 unit tests) — the key is site
   media per the shared allowlist, and is not among the new values. Values are normalised
   through `keyFromRef` first, because a column may hold a bare key, an `r2://bucket/key`
   ref, or a public URL; without that, the same object in two notations never compares equal
   and a **still-live file looks retirable**.
2. `retireReplacedMedia()` (`lib/website-media-server.ts`) re-reads the live references and
   deletes only what nothing points at. Two slots could hold the same object, or a row we
   don't update could still reference it — this settles that instead of assuming.

**If the reference read fails, nothing is deleted.** An empty result and a denied query are
the same value; treating a failure as "unreferenced" would delete the live file this
function exists to protect.

Best-effort by contract, matching `r2Delete`'s own docblock: the sweep never throws and
callers ignore its result. A failure leaves an orphan — visible and removable at
`/admin/website-media` — never a broken publish. Both actions now read the outgoing key(s)
**before** the update, since afterwards the row no longer remembers what it replaced.

Files: `lib/media-retirement.ts` (new) · `lib/media-retirement.test.ts` (new, 10 tests) ·
`lib/website-media-server.ts` (adds `retireReplacedMedia`) ·
`app/admin/background-videos/actions.ts` · `app/admin/hero-video/actions.ts`.

⚠ Stacked on `claude/admin-website-media` — it depends on `assertDeletableKey` /
`keyFromRef` / the reference readers from that branch. Merge that one first.

SPEC IMPACT: None. No schema change, no migration, no pricing or policy change. Behaviour
change is confined to deleting storage objects that nothing references after a replace.
