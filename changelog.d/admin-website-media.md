## 2026-08-02 · feat(admin): Website media — see what's actually stored, and what nothing points at

Adds `/admin/website-media`: the READ side of the media bucket for the site's own
pictures and videos.

**Why it didn't exist.** Every media surface we ship is write-side or database-side —
`background-videos` uploads six clips, `hero-video` uploads one, `papic-storage` totals
bytes from database rows. None can show a file the database stopped referencing, which is
exactly the file that costs money forever.

**Upload paths quietly accumulating orphans**, found while building this and left unchanged
(this PR makes them visible; a follow-up stops them refilling):

- `admin/background-videos/actions.ts` writes the new `video_r2_key` and never calls
  `r2Delete` on the object it replaced.
- `admin/hero-video` writes frames to `hero-frames/<sessionId>/`, a **new folder per
  upload**, so every re-upload orphans an entire previous sequence.
- `admin/settings` writes `brand-icon/<uuid>/`, a new set per upload.

**Three safety properties, all tested:**

1. **An allowlist, not a filter.** `SITE_MEDIA_PREFIXES` names the five site-furniture
   prefixes. Customer and financial content in the same bucket (`events/`,
   `living-heroes/`, `locked-qr-proof/`, `merchant-qr/`, `editorial-vendor/`) is not
   reachable from this surface at all. `assertDeletableKey` re-checks the same allowlist
   *inside* the server action, because the key arrives in a form field.
2. **Unproven is not unused.** A file is reported "Left over" only when a resolver actually
   read the references and came back without it. A failed or denied read degrades the whole
   folder to "Not sure" — an RLS denial and an empty read are the same value.
3. **Only proven-leftover is deletable.** `isDeletableUsage` allows `unreferenced` and
   nothing else; "Not sure" is refused exactly as firmly as "In use". The delete action
   **re-derives usage server-side** before deleting rather than trusting the client's
   `disabled` attribute.

No bulk delete and no select-all, for the same reason. Every row carries a Download link so
a copy can be taken first.

### An adversarial review ran before this merged — 30 findings attacked, 21 confirmed

The first revision passed typecheck, lint and 11 unit tests, and was **substantially
wrong**. Corrections now in:

- 🔴 **`onboarding/` holds a LIVE file.** The onboarding background music
  (`platform_settings.onboarding_bg_music_r2_key`, heard by every couple on the sign-up
  flow) sat in an unresolved folder, under prose reading *"probably left over"*, with
  **Delete enabled**. Fixed twice over: the folder now has a real resolver, and `unknown`
  is no longer deletable under any wording. **Prose is not a safety mechanism.**
- 🔴 **The prefixes were guessed from module names, not read from the upload call sites.**
  `homepage-background-videos/` matches nothing — the uploader writes `homepage-bg/slot-N/`.
  `brand/` is not an R2 prefix at all; brand icons are `brand-icon/<uuid>/`. The page's
  headline case was invisible and its allowlist matched zero objects.
- `HardDrive` is not in the curated `NAV_ICON_NAMES`, so `nav-registry-defaults.test.ts`
  **would have failed CI**. Now `Images`.
- Server actions used the PAGE gate `requireAdmin()` inside a `try`, swallowing Next's
  thrown `redirect()`/`notFound()`. Now `requireAdminAction()`, with `NEXT_*` digests
  rethrown.
- `window.open` ran after an `await`, so popup blockers killed the "save a copy first" step.
  Now opened synchronously inside the click, with a visible fallback link if still blocked.
- `r2List` truncated at 5,000 keys with no signal; the page presented the truncated total as
  fact. It now returns `truncated`, and the summary labels itself a minimum.
- A folder that failed to list was skipped silently, reading as "clean" and shrinking the
  reported total. Now shown with its error.
- Hero lookups were cached in module-level state shared across concurrent requests. Now
  request-scoped.
- Dates formatted without a pinned timezone (hydration mismatch); one shared `busyKey`
  unlocked the wrong row mid-flight. Both fixed.

Files: `lib/website-media.ts` (+17 unit tests) · `lib/website-media-server.ts` ·
`lib/r2.ts` (adds read-only `r2List`) · `app/admin/website-media/{page,actions,media-table}.tsx` ·
nav registered in `admin-nav-groups.tsx`, `admin-nav-descriptions.ts`, `nav-registry-defaults.ts`.

SPEC IMPACT: None. No schema change, no migration, no pricing or policy change. Read-only
plus a manual single-file delete of site furniture; customer content is out of scope by
construction.
