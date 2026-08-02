## 2026-08-02 · feat(admin): Website media — see what's actually stored, and what nothing points at

Adds `/admin/website-media`: the READ side of the media bucket for the site's own
pictures and videos.

**Why it didn't exist.** Every media surface we ship is write-side or database-side —
`background-videos` uploads six clips, `hero-video` uploads one, `papic-storage` totals
bytes from database rows. None can show a file the database stopped referencing, which is
exactly the file that costs money forever.

**Two paths were quietly accumulating orphans**, both found while building this:

- `admin/background-videos/actions.ts` writes the new `video_r2_key` and never calls
  `r2Delete` on the object it replaced — every replace since launch left its predecessor.
- `admin/hero-video` writes frames to `hero-frames/<sessionId>/`, a **new folder per
  upload**, so every re-upload orphans an entire previous sequence.

Neither is changed here; this PR makes them visible. Deleting is the owner's keystroke.

**Two safety properties, both deliberate and both tested:**

1. **An allowlist, not a filter.** `SITE_MEDIA_PREFIXES` names the four site-furniture
   prefixes. Guest photos, payment screenshots, contracts and verification IDs are not
   reachable from this surface at all. `assertDeletableKey` re-checks the same allowlist
   *inside* the server action, because the key arrives in a form field and a form field is
   user input, not a permission.
2. **Unproven is not unused.** A file is reported "Left over" only when a resolver actually
   read the references and came back without it. A failed or denied read degrades the whole
   folder to "Not sure" — an RLS denial and an empty read are the same value, and treating
   "nothing came back" as "nothing is used" would paint every file deletable at once.

There is **no bulk delete and no select-all**, for the same reason. Rows already in use have
their Delete button disabled; each row carries a Download link so a copy can be taken first.

Resolvers cover `homepage-background-videos/` (`homepage_background_videos.video_r2_key`)
and `hero-videos/` + `hero-frames/` (`homepage_hero_config`, reading `video_r2_key`,
`frame_keys`, **and** legacy `frame_urls` parsed back into keys so live frames are never
mistaken for leftovers). `onboarding/` and `brand/` have no database reference and are
always "Not sure", with the reason printed verbatim.

- `lib/website-media.ts` — allowlist, guard, classification, totals (new, 11 unit tests)
- `lib/website-media-server.ts` — listing + reference resolvers (new)
- `lib/r2.ts` — adds paginated read-only `r2List`
- `app/admin/website-media/{page,actions,media-table}.tsx` — the surface
- nav registered in all three places: `admin-nav-groups.tsx`, `admin-nav-descriptions.ts`,
  `nav-registry-defaults.ts`

SPEC IMPACT: None. No schema change, no migration, no pricing or policy change. Read-only
plus a manual single-file delete of site furniture; customer content is out of scope by
construction.
