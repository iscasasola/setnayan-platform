## 2026-08-27 · feat(gallery): the three places people look at photographs wear the gallery the owner approved

SPEC IMPACT: None — this PORTS the owner-approved Gallery archetype
(`prototypes/archetype_content_editorial_gallery_detail_2026-08-01.html` § 2,
approved 2026-08-04 with no changes requested). Nothing was redrawn and no
decision was made that the drawing had not already made.

**What a person gets.** The couple's Papic gallery, the guest's own photographs
on the invitation, and the wall on the day now look like one thing: an obsidian
panel, any tile opens full-screen, and each frame says who took it.

### The three surfaces, and why they are three

The archetype's own route chips name four subjects. Three show photographs and
one does not:

| surface | what changed |
|---|---|
| `app/dashboard/[eventId]/studio/papic/_components/papic-gallery-grid.tsx` | obsidian panel · credit · **photographs open now too** (it was clips only) |
| `app/[slug]/_components/photos-of-you-gallery.tsx` (extracted from `site-body.tsx`) | obsidian panel · credit · lightbox instead of a new browser tab |
| `app/[slug]/_components/live-wall-block.tsx` | obsidian panel · credit · a tile opens |
| `app/[slug]/_components/your-photos-widget.tsx` | obsidian panel only — see below |

⚠ **THE REGISTER NAMED THE WRONG FILE FOR ONE OF THEM.** `your-photos-widget.tsx`
has never rendered a photograph — it is the couple's placeable *promise* card.
The screen a guest actually looks at theirs on is the "Photos of you" section
inside the page body, which is now its own component. Porting the promise card
into a mosaic would have drawn a gallery with nothing in it; it takes the
surface and none of the furniture, so a guest does not meet "Your photos" twice
in two visibly different products a scroll apart.

⛔ `/dashboard/[eventId]/galleries` is **untouched** — it is a hub of three
links, and whether the archetype governs it is an owner decision. A guard fails
if a future session answers that by porting it.

### The credit had a value and no name

🚨 **MEASURED AGAINST PRODUCTION BEFORE ANY OF THIS WAS WRITTEN.** All 14
photographs carry `captured_by_person_id` — the trigger added 2026-08-26 works
and its backfill landed — and **not one of them resolves to a name**: 32 of the
34 rows in the person spine have `display_name` AND `first_name` null, and the
account that took all 14 has no `users.display_name` either.

So the credit is a ladder — person spine → the guest list for this event → the
account — and **its floor is silence**. Never "Unknown", never "A guest", never
an email address. A tile with no credit is honest; "Unknown" tells the couple we
lost the answer. In production today every tile renders no credit, and that is
the correct output, not a defect.

🔴 **AND THE COUPLE CANNOT READ `people` AT ALL.** Its only policies are
`is_admin()` and *"you claimed or created this person"*, so resolving a
paparazzo's name through the couple's own session returns ZERO ROWS — and an RLS
denial is byte-identical to an empty read, so the credit would have shipped
permanently blank with nothing reporting a problem. `lib/capture-credit.ts` uses
the service role under one hard constraint: it resolves only ids the caller has
already read out of rows its own gate allowed, and it returns only names. You
have to already hold the id to get the word.

🔒 A guest with `faceblock_enabled` is never named on a guest-facing surface —
the same rule the wall already applies to caption authors. Naming them as the
photographer on the same screen, to the same room, is the same disclosure
wearing a different label.

### The colour finding, which is the load-bearing one

🚨 **EVERY THEME COLOUR FAILS ON THIS SURFACE, AND FAILS SILENTLY.** The app is
light-locked, so nothing sets `html.dark` — a dark island is not dark mode, and
`ink` / `mulberry` / `terracotta` resolve to their LIGHT values on an obsidian
panel. Computed against `#17160F`:

```
ink          #2C2A29   1.27:1   invisible
mulberry-700 #9D3F1E   2.73:1   FAIL
mulberry-600 #B04722   3.26:1   FAIL   ← the "safe in dark mode" one
mulberry     #C24E25   3.81:1   FAIL
```

The brief's own warning ("mulberry-700 is 3.05:1 in dark, use mulberry-600") is
about `html.dark` and does not apply here — **on this surface mulberry-600 is
worse than the brief's rejected value.** So the obsidian chrome uses only
`--sn-ob-*`, seven tokens defined once in `globals.css` with their measured
ratios beside them:

```
--sn-ob-text  #FBFAF7  17.37:1 AAA      --sn-ob-cta   #E5794E   6.20:1 AA
--sn-ob-soft  #B6B9BE   9.22:1 AAA      --sn-ob-link  #9DB2CE   8.37:1 AAA
--sn-ob-gold  #CBA766   7.99:1 AAA
```

🔑 **GOLD IS SAFE HERE AND ONLY HERE.** The same family measures 4.95:1 at best
on white, and this exact hue 2.27:1.

### Guard

`app/_components/gallery/gallery-archetype-ported.test.ts` — 7 rules, all
mutation-proved with the occurrence count printed before → after:

* the four surfaces sit on the obsidian panel
* none of them paints with a theme colour that fails on it
* every gallery credits its tiles
* every gallery opens the SHARED lightbox
* no gallery grows a private modal
* **every `--sn-ob-*` token is re-measured from `globals.css` and must clear AA** —
  the list is derived from the file, never hand-typed, so a new token cannot
  arrive unmeasured
* the galleries hub is left alone

🪤 **RULE 1 WAS DECORATION ON ITS FIRST RUN, and only the mutation found it.** It
matched `\bsn-gal\b` — a hyphen is a non-word character, so `sn-gal-tile`
satisfied it and deleting the PANEL class left the guard green at 1 → 0
occurrences. Same prefix trap as `f.event_dateX`.

🪤 **RULE 2 FOUND A REAL THING IMMEDIATELY:** six `text-cream` sites and a
`bg-terracotta` still in the couple's grid, on chips that happen to read today
and would invert the moment anything sets `html.dark`.

### Time

The credit's "· 4:12 PM" is formatted in the VENUE's zone, and **a surface with
no zone in hand renders the name alone** rather than the reader's own clock —
which would show a Manila 4:12 PM reception as 8:12 AM to a relative abroad,
looking exactly like a fact. The archetype's own mobile tiles carry the name
alone, so name-only is the drawing's phone form, not a compromise. The papic
studio reads the coordinates in **its own select**, because the page answers a
refused event read with `notFound()` and a grant problem must not turn a live
celebration into a missing one.

### Not done, and named rather than assumed

* `app/tour/gallery/_components/tour-live-wall.tsx` is a deliberate client-only
  FORK of the wall with the marketing tour's own palette. It still wears the old
  look, so the public tour of this feature now shows something the product does
  not. Retuning it is a decision about the tour's design register, not this port.
* The couple's grid opens the `display` derivative (long edge 1280), not the
  full-res original — the original is a download, not an on-screen image.
