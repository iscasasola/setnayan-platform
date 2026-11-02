## 2026-07-31 · fix(alaala): the destination page is Alaala now — one name, one vocabulary, and vendors stop pretending to be a memory

Owner, on the live app: *"the memories hub is still not integrated"* · *"ala ala is not fixed."*

The home was fixed earlier today. **The page it links to was not.** You tapped "Photos & videos" under Alaala and landed on a page that introduced itself by a different name, with a different set of words for the same thing. That is the identical two-names-for-one-idea defect, one level down.

### The page already had two nav surfaces calling it Alaala

This was not a judgement call. Two shipped components already send people to `/dashboard/library` under the name **Alaala**:

- `(launcher)/_components/home-pill-nav.tsx` — the phone tab literally reads **"Alaala"** and its own comment calls the route "Alaala `/dashboard/library`".
- `(launcher)/_components/home-board.tsx` — the dark board tile reads **"Alaala"**, with the comment *"Alaala — the memory dimension."*

Meanwhile the page's `<h1>`, its `metadata.title`, the ⌘K palette entry and the nav-registry default all said the old hub name. **The nav was right and the destination was wrong**, and it had been wrong on every one of those doors at once.

Renamed: the `<h1>`, the browser title, the ⌘K entry (`(launcher)/page.tsx`), the nav-registry default label + icon (`lib/nav-registry-defaults.ts` — `LayoutGrid` → `Sparkles`, matching the two nav surfaces above), and the route comment in `(account)/layout.tsx`.

**The URL is untouched.** `/dashboard/library` stays `/dashboard/library`. Renaming a live route would break the phone pill nav, the board tile, the palette, and `lib/daily-email-jobs.ts` — which sends `?tab=photos` in mail already sitting in people's inboxes. The surface was renamed; the address was not.

### One vocabulary: the five lenses

The Alaala tile names five lenses — **Recent · Owned · Attended · People · With me** (`alaala-lenses.tsx`). The page used a second, unrelated axis: three tabs (Photos & Videos · Saved Vendors · Editorials). Two vocabularies for one surface is the whole complaint.

The lenses are now the page's primary navigation, in the tile's own order and the tile's own words. **This is not a new read.** `Album.role` is already `'couple' | 'guest'` — which *is* Owned vs Attended. Three of the five lenses are a filter over albums `getPhotosAlbums()` already fetches; `PhotosTab` gained an optional `lens` prop (defaults to `'recent'`, so the launcher's `<PhotosTab userId={…} />` is unchanged and needs no edit).

The two that are not albums are not faked:

- **People** carries the tile's own sentence and a real door to `/dashboard/people` (which renders its own honest coming-soon preview while `peopleConnectionsEnabled()` is off). No second face-row derived from the moment graph — a drifting duplicate of the tile's faces is the exact defect this PR exists to remove.
- **With me** is counsel-gated behind `personLifeStoriesEnabled()`, off in production. It says so, and points at Attended, which *does* work today. An empty grid would have read as a bug.

Empty states are now per-lens. An empty **Attended** lens no longer says "No albums yet" — on an account hosting three weddings that was simply false.

### Saved vendors: kept reachable, demoted out of the memory set

A shortlist is not a memory, and you already ruled where it belongs: *"saved vendors can be with the group of your shop, hq, and creators lab, and favorite vendors."* The home now links them from **Spaces**.

But `?tab=vendors` is a **live deep link** — the home's Spaces row points straight at it — so removing it would break the link shipped the same day. It keeps working, keeps a visible door, and simply stops being a peer of the memory lenses: it sits under a separate **"Also kept"** strip, and opening it now says plainly that these live in Spaces.

### Editorials: it is real, and it is not featured

Checked before deciding, because an audit had flagged an "Editorial" category that opens to zero results permanently. **That is a different thing.** This tab is backed by a genuine data layer (`_data/editorials.ts`, 304 lines): it reads `event_editorial`, splits owned vs attended, and gates attended on `status='published'` **and** `landing_page_visibility != 'private'` — the same visibility as the public `/[slug]` page. There is a real authoring door (`/dashboard/[eventId]/website/editorial`, linked from `website/page.tsx`). It is **not empty by construction**; it is empty until somebody starts an editorial.

So it stays reachable and is *not* promoted to a lens — an editorial is a story, not an album. It sits beside saved vendors under "Also kept".

I did **not** adopt the prototype's word for it. `User_Home_REDESIGN_2026-07-30.html` calls editorials *"chapters you kept"* — but `creator_chapters` is a **different shipped table** (the Storyteller surface at `/dashboard/creator`). Renaming Editorials to "Chapters" would have solved one name collision by creating another.

### The guard

`Memories Hub` is now a **retired string** (`apps/web/.retired-strings.json`), so CI fails if it reappears in `apps/web/app/**`. The guard matches raw file text — **comments included** — so the launcher's historical rename commentary is allow-listed by path rather than deleted; that commentary is the record of why this happened and is worth keeping. Verified locally: `OK · scanned 1951 files under apps/web/app · 0 retired strings`.

### Verified

`node scripts/lint-retired-strings.mjs` → **OK, 0 violations** · `next lint --dir app --dir lib` → **0 errors** (only pre-existing warnings, none in touched files) · **5,790 unit tests, 0 failures** · `tsc --noEmit` clean (needs `NODE_OPTIONS=--max-old-space-size=8192`; it OOMs at the default heap on this tree).

**Not verified: nobody has opened this on a phone.** The lens strip is a horizontal scroller and the "Also kept" strip wraps; both are untested at 375px against the launcher's floating pill nav.

SPEC IMPACT: None. Naming, navigation vocabulary and placement only — no schema, no RLS, no pricing, no entitlement, no route change, and every existing deep link (`?tab=photos` · `?tab=vendors` · `?tab=editorials`) still resolves.
