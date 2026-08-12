## 2026-08-13 · feat(alaala): Alaala stops being a second list of events — the five lenses now answer with photographs

**Redesign session 8.** Alaala is the account-level memory dimension. Its five lenses are owner-approved (2026-07-15: Recent · Owned · Attended · People · With me) and, until this change, **every one of them answered with EVENTS**:

- the home's Alaala panel rendered `PhotosTab` — **one card per event with a photo count**;
- the obsidian tile's *Owned* lens rendered a **bulleted list of event names with dates**, and *Attended* rendered a **count of events**;
- `/dashboard/library` answered three of the five lenses with that same album grid, and the other two with prose, because People and With me are not albums.

Five words, two answers, and one of them is the board's job. **Events is for DOING** — one card per celebration, plan it, run it. **Alaala is for KEEPING.** *With me* is every photo of you across six years and belongs to **no single event**, which is exactly why an album grid could never be its answer and why the lens has to live at the account level.

### What a person gets

The home now carries a wall of their actual photographs, cut five ways from one read — and the five cuts are five different answers:

| lens | what it shows |
|---|---|
| Recent | every frame they can see, newest first, event boundaries erased |
| Owned | frames from the celebrations they host |
| Attended | frames from celebrations they were a guest at (the ones they're tagged in) |
| People | **not a wall** — the faces, with how many events each kept showing up in |
| With me | every frame they appear in, wherever it was taken |

Life-Flash stays at the top of the section (switched on in session 1) and "This year" stays beneath it. The lenses used to be a `sm:`-and-up affordance inside a 64px slot — **they did not exist on a phone at all**. They now own the full width, on every screen size.

### The pieces

- **`lib/alaala-wall.ts`** — a PURE core (no Supabase, no `server-only`, no React), so the five-lenses rule is unit-testable. Selection, ordering, dedupe, counts.
- **`lib/alaala-wall-data.ts`** — the read half. Owned media under the viewer's own RLS session; attended media through `getGuestLiveGallery`, which already returns **only** the viewer's tagged, clean, non-hidden photos. **Nothing here widens a gate** — an attended frame is by construction one the viewer could already see. The event list reuses the already-`cache()`d `getSwitcherData`, so it costs **zero extra queries**.
- **`app/_components/alaala/lens-body.tsx`** — ONE renderer, both surfaces. The home swaps server-rendered bodies client-side; `/dashboard/library` renders one per request. Two surfaces answering the same five words two different ways is the drift that put an album grid behind three of the lenses in the first place.
- The per-event album grid is **not deleted** — it is **"Albums by event"** under *Also kept* on `/dashboard/library`, where downloading one whole celebration is a real job. `?tab=photos` (live in email) still lands on Recent.

### Decisions worth reading

**`moderation_state = 'clean'`, not `!= 'nsfw_blocked'`.** The column has five values (`unscreened · clean · nsfw_blocked · consent_withheld · faceblock_withheld`). This wall AUTO-RENDERS on the home, so it takes the strict allowlist every other auto-rendering surface takes (guest-live-gallery, the moment graph, the Alaala orb, download) — **not** the couple's manage-my-gallery filter, which deliberately shows unscreened rows so a couple can act on them. Stricter than the album grid it replaces, which is the safe direction.

**`unreadable` is not `items.length === 0`.** A rejected query and an empty table are the same value out of PostgREST. Every read checks `.error`; a failed read raises `unreadable`, `lensCounts` answers `null` (NOT MEASURED, never `0`), and the UI says *"could not be loaded — this is not an empty album"*. **"No photos yet" printed over a refused read is a lie told about somebody's memories.**

**Attended frames open the picture, not the event dashboard.** `app/dashboard/[eventId]/layout.tsx` admits `member_type = 'couple'` only, so the shipped album card's "View & download" on an *Attended* album has always pointed at a `notFound()` for the guest it was shown to. Unreachable in production today (0 guest memberships), but the wall does not propagate it — owned frames go to the album, attended frames open the photo.

**One source of faces.** The obsidian tile's face row and the People lens both call a request-`cache()`d moment graph, so they are fetched once and cannot disagree — the drift `/dashboard/library` already carried a warning about.

### Guards — 12 sabotages, all measured, all caught

`lib/alaala-wall.test.ts` (10 tests) asserts the five selections are pairwise different on an account with a life, that Owned/Attended partition Recent, that With me holds only tagged frames **and spans more than one event**, and that a refused read counts `null`.

`app/dashboard/(launcher)/alaala-is-memories.test.ts` (7 tests) asserts the home mounts the wall, renders no album grid, that the tile keeps Life-Flash and does **not** take the lenses back, that all five lenses have a body (a missing key renders `undefined` — an empty panel with no error), and that both surfaces render the same body.

Every mutation looked like the regression (delete the JSX, restore `PhotosTab`) and printed the anchor's **occurrence count before → after**, so the sabotage is proven to have landed. **The harness found a real hole in my own guard**: the "With me is offered at the account level" check matched `/'with_me'/` anywhere in the file, and the page names it twice — deleting it from the key list left the chip label, and the guard still passed. Re-anchored to the `LENS_KEYS` declaration; it now fails. *A guard matching a STRING instead of the ACT, caught only because the mutation was run.*

`lint-port-no-lost-controls.mjs` also caught a real loss: the People lens's **"Open People" door hung off the prose placeholder**, so replacing that placeholder with real faces silently deleted the only route from Alaala to `/dashboard/people`. A control that disappears when the feature starts *working* is the worst kind to lose. It is now on every branch. The baseline is regenerated in this PR so each deliberate removal reads as one line in the diff.

Full suite: **7,763 unit tests green**, typecheck clean, all 21 `lint-*.mjs` guards green, eslint clean.

SPEC IMPACT: None — no SKU, price, schema or migration. No new read scope: every frame shown was already visible to the viewer through a shipped surface; this changes which of them Alaala shows and how it cuts them.
