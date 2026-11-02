## 2026-08-02 · chore(admin): retire the sign-in hero video — it wrote files nobody could see

Owner instruction, 2026-08-02: *"retire it."* Deleted, not flagged off, per the standing
**retired-means-deleted** rule (no tombstones).

**What it was.** An admin uploader that took a clip, sliced it into 73–361 stills, wrote
them to `hero-videos/` and a fresh `hero-frames/<sessionId>/` folder on every upload, and
saved the keys to `homepage_hero_config`. **Nothing rendered any of it.** `/login` renders
only the sign-in card; the public reader `fetchPublishedHeroVideo` had **zero callers**;
`fetchHeroVideoConfigForAdmin` was called solely by the uploader's own surface reading back
its own uploads. A closed loop that consumed storage on every use and displayed nothing.

Found while building `/admin/website-media` — the page that lists what the database no
longer points at is what made a whole dead feature visible.

**Deleted:** `app/admin/hero-video/{page,actions,hero-uploader}.tsx` ·
`app/admin/studio/_surfaces/hero-video-surface.tsx` · `lib/hero-video.ts`.
**Unhooked from:** the Studio tab list + its render branch, `admin-nav-groups.tsx`,
`admin-nav-descriptions.ts`, `admin-bottom-nav.tsx`, `nav-registry-defaults.ts`,
`routes.ts`.

**The hero folders are now fully clearable.** `readHeroRefs()` returns an empty reference
set, so every object under `hero-videos/` and `hero-frames/` reads *Left over* on
`/admin/website-media` instead of pinning the last upload as *In use* for a screen that no
longer exists. `homepage_hero_config` is deliberately **not** consulted.

⚠ **That empty set is the only hand-asserted "nothing references this" in the module**, and
it is the exact shape that deletes live files once the world changes underneath it — so it
is **machine-checked**. `website-media-retired-hero.test.ts` fails the build if any retired
file or symbol reappears, forcing whoever restores the feature to write a real resolver
first. Verified by reintroducing `lib/hero-video.ts` and confirming the guard fails with an
actionable message.

**`homepage_hero_config` is left in the database, inert and unread** — same posture as the
retired `token_burn_bands`. Dropping a production table is a separate, owner-gated decision,
not a side effect of deleting a screen; it would also require regenerating the
CI-enforced exposure baseline and prod-schema snapshot.

SPEC IMPACT: None. No schema change, no migration, no pricing change. A retired V1 surface
that was never wired to anything public.
