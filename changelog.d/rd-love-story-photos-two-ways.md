## 2026-10-08 · fix(upload): a photo that did not upload says so — never a tile that spins for ever

Owner, testing Studio › Love Story's photo slots on the local copy: *"it does not
upload"*, with a picture of one tile stuck at "0%" beside a spinner. Reproduced
in headless Chromium on that copy: `POST /api/upload → 503`, and forty seconds
later the tile still read "0%" with its spinner, no line anywhere, and Done held
shut on "Uploading… 0%".

Two faults, both in the shared `FileUpload` (`app/_components/file-upload.tsx`):

- **In development only** (React's Strict Mode, which a local copy runs under):
  the uploader's "am I mounted" flag was cleared by the effect's rehearsal cleanup
  and never set again, so EVERY ending — a refusal, a stall, even a landing — was
  dropped. Production does not rehearse and was not affected. The flag is now set
  on mount.
- **Everywhere:** the signing request (`/api/upload`) had no clock; one that never
  answered spun for ever. It has one now (the same silence budget as the PUT).

The sign-then-PUT run moved, unchanged in what it sends, to `lib/upload-send.ts`
(`sendToStorage`): it settles EXACTLY ONCE with one of five answers — landed,
refused, network, stalled, stopped — and takes `fetch`, `XMLHttpRequest` and the
timers as arguments, so a test drives the real control flow (the runner has no
DOM). `FileUpload` loads it at the first upload (`await import`), so it and the
stall watchdog leave the first load of every page that merely shows an uploader.

New, optional, off for every existing caller:

- `failedSays="…"` (`gallery` only) — a file that did not upload stays as a tile
  that says those words, with **Try again** (the same file, through the pick's own
  door) and ✕. Nothing of it joins the value; `onBusy` goes false. A 4xx's own
  reason (too large, the allowance is full) is still shown; a 5xx's is the
  operator's and is not.
- `stallMs` — how long nothing may move before an upload is dead (default 45 s).
- `send` — a stand-in for storage, for the dev lab only.

Studio › Love Story's slots ask for it: the tile says "Couldn’t upload this
photo.", and a photo that moves nothing for 15 seconds is given up on.

**What changes for the other 50 screens that draw `FileUpload`** (no restyle):
on a local copy their uploads now end at all; a signing request that never
answers ends after 45 s with the line they already show for a stalled upload;
✕ pressed while a file is still being signed now really stops it (before, the
tile went but the file uploaded anyway and joined the value); a refusal whose
body is not JSON reads "Presign failed (502)" instead of a parser's error text.

Guard: `apps/web/lib/a-refused-upload-says-so.test.ts` (10 tests; 21 sabotages
seen red). `app/_components/file-upload-compress-first.test.ts` re-pointed at the
hand-off to the run (its `fetch('/api/upload'` anchor moved files).

SPEC IMPACT: None — builds `INTERACTION_RULES.md` § 5 ("Failure = the plain
reason + Try again, never looking like success") and § 9's upload ruling.

## 2026-10-08 · feat(lab): the dev lab can really add a photo to a Love Story moment

The lab (`/dev/maker-lab?studio=1`) is the owner's only way to see Studio › Love
Story, and it has no file storage — so there an upload could never succeed. The
lab now stands in for storage (`app/dev/details-lab/lab-upload-stand-in.ts`,
`sendToStorage`'s own shape), so the REAL uploader, slots and row run on a photo
he picks: its figure goes up, Done reads "Uploading… N%" and is held, it lands,
"Not kept yet — press Done." shows, and Done raises the square's count.

Exactly what the stand-in fakes: no request is made (nothing is signed or sent —
the file never leaves the browser); the photo is an object URL in the browser's
memory (a reload forgets it); the ref is made up; the figure is a timer (six
steps, under two seconds), not measured bytes; nothing is screened. A file whose
name starts `fail` is refused and one starting `stall` moves nothing, so the
failed tile can be looked at too. A change only the server may decide (a moment
with a NEW photo) is applied to the fixture in memory with the server's own
`applyMomentIntent`, through the instant book's own `editLoveStory`.

The seam: the Love Story slots read `SlotsUploadStandIn` (null everywhere a
person can reach → real storage) and hand it to `FileUpload`'s `send`. Only
`app/dev/` provides it; the lab route refuses production.

Also: the failed tile's ✕ is a 44 px round target in its corner (it was the
uploader's 24 px ✕, stretched into an oval by the app's button height floor).

Guard: `apps/web/lib/the-lab-can-upload.test.ts` (4 tests — the stand-in is RUN
with hand-turned timers; 14 sabotages seen red).

SPEC IMPACT: None.

## 2026-10-08 · feat(studio): a Love Story row shows the first line of its story under its name

Owner, on Studio › Love Story: *"i do not see the subtext? unlike the Sep 2026"*
— the only row with a line under its name was the moment kept off the Event Hub
(its amber notice). The approved drawing (gallery § 13) gives every row the FIRST
LINE of its story as a quiet second line.

- `TimelineRow` gains one optional prop, `sub`: one quiet line under the name,
  inside the same tap, cut with "…". The row grows by that ONE line and never
  more (the name still stops at two). A row handed none — every Schedule row — is
  drawn exactly as it was.
- Love Story hands each row `momentFirstLine(its words)`: the first line the
  couple wrote (never a later one, never words of ours), "…" when more follows,
  nothing when there are no words. It follows the words as they are typed in ⋯.
  The amber "Off the Event Hub — guests do not see this moment." stays its own
  line below; a new moment with a name and no words still says "Not saved yet — a
  moment needs a line or two."

Also: the photo slots no longer set their "Not kept yet" line while the uploader
is drawing (React's dev-only "Cannot update a component while rendering a
different component" — it showed as a red "1 Issue" badge on the local copy).

Guard: `apps/web/lib/a-moment-shows-its-first-line.test.ts` (4 tests; 13
sabotages seen red). No request added: the words are already on the page.

SPEC IMPACT: None — builds the approved gallery § 13.

## 2026-10-08 · fix(upload): in a gallery an upload is the 0–100 pie, and every tile's ✕ is round

Controller, from two pictures of Studio › Love Story's photo slots: the uploading
tile drew a small spinner and a thin GOLD bar with "27%" under it; and the ✕ on a
kept photo was a tall oval. Both are the shared uploader's `gallery` layout
(`app/_components/file-upload.tsx`):

- **The uploading tile is the pie** (owner: *"show a loading screen 0-100 pie to
  know how long til it uploads"*; gallery § 21): filled by the upload's own
  measured figure, in the accent token (`--sn-accent`), the figure on it. No
  spinner beside it, no bar. A state that steps with the bytes — the same under
  "reduce motion".
- **Every ✕ is one round 44 px target** in the tile's corner, carrying the 24 px
  disc (kept, uploading and failed tiles). A bare 24 px button was being
  stretched into an oval by the app's 44 px button floor.

`gallery` is worn by two surfaces, and both now show the pie and the round ✕:
Studio › Love Story's photo slots and the supplier's showcase
(`vendor-dashboard/services/_components/showcase-media-fields.tsx`). The one-line
row layout the other callers wear is untouched (its spinner and bar stay).

Guard: `apps/web/lib/a-photo-on-its-way-is-a-pie.test.ts` (3 tests; 10 sabotages
seen red).

SPEC IMPACT: None.

## 2026-10-08 · perf(maker): the Maker's first load no longer carries the Timeline row

`app/_components/timeline-row.tsx` — the row, its name field, the empty state and
their handlers — rode the Maker's first load only because the Maker's page
imported its loading shimmer and `timeline-read-problem.tsx` its problem state.
Those two pieces and the two class constants now live in
`app/_components/timeline-states.tsx` (no hooks, no "use client": the shimmer is
plain server HTML); `timeline-row.tsx` re-exports all four, so no wearer changes.
`launch/page.tsx` and `timeline-read-problem.tsx` import the small file.

Measured the only way a tree without a build can be (esbuild minify + gzip of
what the first load imports): `timeline-row.tsx` 1,742 B → `timeline-states.tsx`
713 B (about −1.0 KB; the row itself, 1,421 B, now loads with the Schedule's day
and the Love Story's rows). With this branch's other first-load changes (the
uploader, the watchdog it no longer imports): 7,275 B at the base → 6,394 B.

Also: the uploader fetches the upload run (`lib/upload-send.ts`) the moment its
file picker is opened, so the first upload does not wait on that chunk — and
`maker-tools-are-all-preloaded` names it in NOT_A_TOOL with that reason (it was
red on the review copy since the run became a later load).

Guard: `apps/web/lib/the-maker-first-load-leaves-the-row-behind.test.ts` — walks
every static import from the Maker's page (4 tests; 8 sabotages seen red, "a
first-load file imports timeline-row.tsx again" among them).

SPEC IMPACT: None.

## 2026-10-08 · feat(studio): a Love Story moment's photos, two ways — upload, or pick from their other events

Owner: *"love story they can add manually or add from their stories"* → *"their
collection of photos from other events, they can add them as well."* · *"they can
always edit it if manual, but if added via their memories, cannot edit."*

In a moment's photo slots (Studio › Love Story) there are now two ways, in the
one sheet: **Upload** (as before) and **Pick from our events** — the SHIPPED
ability (`our-events-read.ts` + the moment action's `intent=pick`), drawn inside
the slots: the pair's other events as list rows (name · day · what it can lend);
open one and its photos are fixed squares to tick, as many as the moment has
room for; one button adds them to THIS moment through the same `pick`, into the
draft (guests see them after ✓ Apply — unchanged).

**Requests.** The Love Story page read the pair's other events on EVERY open —
2 reads with no other event, 3 with one or more (counted on the real read with a
stand-in client) — though the Studio never drew them. Now:
- opening Love Story in the Studio: 0 reads for other events (the launch page
  tells the Love Story page it is the Studio; outside it the shipped block and
  its read are unchanged);
- the first "Pick from our events" opened on a visit: ONE server action
  (`intent=offer` on the existing `loveStoryMomentAction` — it answers right
  after "who is asking", before the story or the draft is read; it writes,
  revalidates and redirects nothing, so no render of the Maker). Every later
  opening on that visit: nothing. +0 exported server actions;
- a pick: 1 server action + 1 render of the Maker in place — what the shipped
  pick costs. It (and a newly uploaded photo's save) now lands on the address the
  couple is already on (`draftInPlace` → `maker_stay`), where the Studio's photo
  save used to redirect to `?tool=love-story` and remount the whole Maker.

**A photo that came from another event** is known by its own ref — every photo
an event shows is stored under that event's folder (`events/<event id>/…`) and a
pick stores the same ref, so nothing new is stored. Its square says "From
<event's name>" in words along its foot; it has its ✕ (it can be removed from the
moment) and nothing else. The Studio reads those events' names in ONE read, made
only when the story holds such a photo; a name that cannot be read says "From
another of your events", never a guess.

Also: with no other event the choice stays, quiet, with "You have no other events
yet."; a full moment says "This moment is full. Remove a photo to add another.";
loading, none and "could not look" (with Try again) never look alike; the slots
are three across on every width (at four the ✕ touched the pie). The dev lab has
two other events — one that lends four photos, one that is someone else's.

`FileUpload` gains one optional prop, `tileNote` (a few words along the foot of a
finished gallery tile). `readOurEventsOffer` moved, unchanged, from the page to
`_components/our-events-offer.ts` so the page and `intent=offer` share it.

Guard: `apps/web/lib/photos-two-ways.test.ts` (7 tests; 31 sabotages seen red).
`studio-love-story-wears-the-timeline-row` (4) and (7) and
`pick-shows-every-event-we-were-both-at` (🤝) re-pointed at the new shapes.

SPEC IMPACT: None to the corpus rules; the owner's three sentences above are the
ruling — the controller records them in `DECISION_LOG.md`.
