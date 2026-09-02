# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-02 · feat(pa3d): the page that sells the room now contains the room

Owner: *"follow the concept of papic but still adjust it to its best flow to
make sure it is delivered attractive to the viewers."*

`/pa3d` already existed and was already correct — a `DoorwayPage` with good
copy and a demo button that opened the room in an OVERLAY. That is the right
shape for six of the seven product pages. It was the wrong shape for this one.

**`/papic` left `DoorwayPage` because Papic can be handed to you on the page.
3D Plan is the only other product that can.** Papic's beats, followed:

1. the premise in one frame, with no buttons competing with it
2. try it right now, on this page, at a linkable address
3. the product actually running — never a mock-up
4. only then the argument, the steps, the price

### Where it deviates from Papic, and why

Papic's beats 1 and 2 are separate because its premise is a **photograph** and
its interaction is two QR codes — genuinely two moments. **3D Plan's premise IS
the interaction.** Splitting them puts a picture of a room above a button that
opens the room, and argues against itself. So beats 1–3 collapse: the room is
the hero, and stepping into it is the demo.

The argument section moved BELOW the room on purpose — having just stood in it,
"a plan tells you who sits where, a room tells you how it feels" lands as
something the visitor felt rather than something we claimed.

### New

- `_pa3d-room.tsx` — the live sample room, in the page. Same server action, same
  sample event, same QR mint as the homepage overlay. **Not a copy** — if it
  ever grows its own scene-loading path, that is the bug.
- `/pa3d/try` — the room at an address you can paste into a group chat, mirroring
  `/papic/try`. A demo nobody can link to is a demo that cannot spread, and this
  is the honest destination for the page's own "show your coordinator" promise.
- A section for the half a static page cannot show: the guest's side. Tap any
  seated guest and you get the exact code one of your guests would.

### One tap, not zero — deliberately

three.js is ~193 KB over the wire and `ssr:false`-dynamic, so it costs nothing
until the scene mounts. Auto-mounting would bill every visitor to a marketing
page, including the ones who bounce at the fold, on Philippine mobile data, for
a page they have not chosen yet. The poster is real product copy and the tap is
the consent. ⚠ If anyone makes this eager, re-measure the page's transfer first.

### Three guards caught real things, and all three were right

| Guard | What it caught |
|---|---|
| `doorway-palette` | hand-typed hexes **and** `bg-white`/`text-white` — banned because the page is CREAM and a white card is invisible; that was the original defect |
| `add-to-event-is-the-only-difference` | dropping `studioKey` would have silently cost a signed-in couple the "Add to an event" shortcut. Papic's exemption does not apply — that page has no buttons left to swap, this one does — so the page renders `AddToEventCta` |
| `studio-apps` "try it is backed by a real demo" | the rail's marker must be backed by something real |

The last one's inline allow-list gained a row rather than a widened condition:
it is now a map keyed by page (`papic` → `<PapicScan/>`, `pa3d` → `<Pa3dRoom/>`),
so a doorway that renders **neither** still fails — the fake door it exists to
catch. `port-control-baseline.json` regenerated so the `<DoorwayPage>` removal
reads as one line in the diff, which is the point of that guard.

Verified: typecheck ✅ · lint ✅ · 11,882 unit tests ✅ · all 29 CI guards ✅

⚠ NOT visually verified beyond the in-app browser. Worth a look on the Vercel
preview before release.

SPEC IMPACT: None. Copy is unchanged in substance; `studio-apps.ts` still owns
the description, and no price is authored here.

## 2026-09-02 · feat(pa3d): image-led, in motion, and with no buttons

Same page, two further owner passes.

**"More photos and imagery. Less text. Important to use animations and effect
to make this attractive to the users browsing."**

- The hero is now a real photograph of the sample reception under a slow Ken
  Burns push, captioned *"This is the night. You get to stand in it first."*
- A drifting rail of eight real frames from that wedding — the day the room
  becomes — carrying one line of copy, because the pictures are the argument.
- The three steps became a picture and a single line each, in a lifting card.
- The guest section became a photograph with a caption.

Motion lives in `_pa3d-motion.tsx` + `_pa3d.css`: **CSS keyframes and one
IntersectionObserver, zero dependencies.** `framer-motion` is not in this app
and a landing page is not the reason to add it. Every effect — drift, zoom,
auto-scroll — is disabled under `prefers-reduced-motion`, which is not
politeness: those are exactly the motions that make vestibular-sensitive people
ill. The page reads correctly with all of it off.

⚠ **A caption over a photograph is a contrast problem no guard can see.**
`lint-label-on-fill-contrast.mjs` skips non-opaque pairings by its own
documented limit, and the candlelit toast frame blew straight through a single
80%-ink gradient. Fixed with a taller two-stop scrim plus a text shadow, checked
against the brightest frame in the set rather than guessed.

**"I don't think we need this"** — the closing CTA block. Removed, which lands
this page on Papic's shape exactly: **no buttons at all.** The room is the door;
`/pa3d/try` is the link you can paste.

🔑 **One consequence recorded rather than absorbed.** With no primary CTA there
is nothing for `studioKey` to swap, so `AddToEventCta` went with it and a
signed-in couple loses the *Add to an event* shortcut **from this page**. The
capability is unchanged — 3D Plan is added from the Studio inside the
celebration. `add-to-event-is-the-only-difference.test.ts` now carries a second
documented removal beside Papic's, and `port-control-baseline.json` records the
three lost controls as three readable lines, which is that guard's whole point.

Verified: typecheck ✅ · lint ✅ · 11,882 unit tests ✅ · all 29 CI guards ✅ ·
rendered and inspected on a local dev server.

## 2026-09-02 · fix(pa3d): the parts, not a photo gallery — and what a printed plan cannot do

Two owner corrections, both about what the page is actually claiming.

**"The room, hours later is like a photo gallery. The goal of 3D Plan is to
create the interactive environment for the different parts it is integrated to.
Letting them see their virtual reception."**

The drifting rail of eight real wedding photographs was attractive and sold the
wrong product — **a gallery of somebody's wedding day argues for photography.**
3D Plan is the integrative surface: the seat plan, the venue shape, the mood
board and the guest list stop being four screens and become one room you walk.

So the section now shows the **parts arriving**, each as a looping recording of
the real app already in `public/add-ons/demo/` — mood board, indoor blueprint,
custom QR per guest. Those are recordings of the same live scenes the Studio
cards render (see that folder's README), so they cannot drift from the product;
no mock-ups were made. The seat plan is deliberately not one of the three: it is
not another part, it is the floor the others land on, and the lede says so. The
section closes by pointing at the live toggle in the room above — the mood board
re-dressing the space is the integration, demonstrable in one tap.

`PhotoRail` and its CSS were deleted rather than left dead.

**"Share what the 3D Plan offers beyond what is found on normal printed seat
plans? Like the vendors, the interactive guide where to seat, the mood of the
place, the overall look."**

The comparison rows were abstractly true and concretely useless — *"a room you
can stand inside"* tells a couple nothing they can picture. Rewritten against a
printed chart, naming the four things asked for:

| A printed seat plan | 3D Plan |
|---|---|
| A name in a list | Walks each guest to their own chair |
| Your suppliers, nowhere on it | Their booths, standing in the room |
| Colours you have to describe | Your mood board, on the linens and the light |
| A layout | The whole look of the night, before it is built |
| Printed once, then wrong | Changes the moment you move a table |

Verified: typecheck ✅ · lint ✅ · 11,882 unit tests ✅ · all 29 CI guards ✅

### ⚠ Found while wiring the films: every Studio demo clip is half empty

The three films rendered with a grey right half. It is not this page's CSS.
Measured by drawing a frame to a canvas and scanning a row: **content ends at
x=229 of 460 — exactly half — on every clip tested** (`papic`, `mood-board`,
`indoor-blueprint`, `custom-qr-guest`, `save-the-date`).

🚨 **The deployed `papic.mp4` is byte-identical to the repo's** (sha256
`70d86eff63cd93bb…`, 50,863 bytes, both), so `/papic` has been showing a
half-grey film in its own *"this is all of it"* section — the one place that
page claims to show the whole product.

The cause is upstream in `scripts/capture-demo-videos.mjs` (or the
`/demo-capture/[slug]` route it drives) and is **not fixed here** — fixing an
asset pipeline inside a landing-page PR would be fixing it in the wrong place,
and regenerating needs a dev server plus a libx264 ffmpeg.

Until they are recaptured this page CROPS to the live half: the video renders
at double the window width, pinned left, so the grey never enters the box.
Recapturing full-width leaves the crop harmless — it would simply show the left
half of a full frame — so the two changes do not have to land in lock-step.

## 2026-09-03 · chore(pa3d): the part films drop their crop — the clips are whole now

`_pa3d-parts.tsx` rendered each film at double the window width, pinned left, so
the grey right half never entered the box. That was a workaround for an asset
bug, documented as such and explicitly marked harmless-once-fixed.

It is fixed. #5109 corrected the recorder geometry and #5119 recaptured all 13
clips. Measured on this branch after merging main, before removing anything:
the right half of a `mood-board` frame is **29,773 bytes** of real UI where it
was **3,403 bytes** of flat grey.

So the frame goes back to being a plain 9:19 box with `object-cover` — nothing
cropped, nothing letterboxed. The reason it ever cropped is kept in the
docblock, because the number is the only thing that makes "this can be removed"
checkable rather than assumed.

Also merges 34 commits of `main`. One conflict, `port-control-baseline.json` —
generated, so resolved the only correct way: take main's, then REGENERATE for
the merged tree (413 routes / 881 destinations / 4,194 blocks). Both `/pa3d` and
`/pa3d/try` are present in the regenerated baseline, and the port guard confirms
no route lost a control.

Verified on the MERGED tree: typecheck ✅ · lint ✅ · 12,109 unit tests ✅ ·
guards ✅
