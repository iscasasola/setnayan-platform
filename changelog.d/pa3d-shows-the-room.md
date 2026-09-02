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
