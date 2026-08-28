## 2026-08-28 · fix(papic): the control centre opens on the library, not on a form

Owner, on the page rebuilt the day before: *"it doesn't look like a photo app
control center. it still feels like it is a business page. with not much imagery
and app feel UI."*

The structure shipped 2026-08-27 was right and is **unchanged below the fold**.
What was wrong was what the page **opened on**: four cells of text, then rows of
settings. Design + research: `SERVICE_CONTROL_CENTERS_DESIGN_2026-08-28.md`;
drawing: `prototypes/service_control_center_pattern_2026-08-28.html`.

🔑 **THE MARKET IS UNANIMOUS AND IT DECIDED THIS.** Apple Photos deleted its tab
bar so the grid is the first paint; Google Photos lands on the grid with albums
and settings demoted; Frame.io renders state in the corner of the thumbnail
rather than in a list beside it. **A photo product opens on photographs.** So
Papic now opens on the **stage** — the approved obsidian Gallery panel, which
until now only appeared *after* the wedding — with the four facts fused onto its
lower edge. They are still the first text a person reads and still come before
anything asks them to decide; they simply sit on the thing they describe.

### 🔢 The empty state is the ONLY state anybody has met

Measured in production: **every celebration that exists has an empty Papic
library.** A stage that only looks like a photo app once it is full would look
like a photo app for nobody. So an empty library draws the frames it is going to
fill — a roll of waiting squares, when the cameras open, and one lit frame that
starts it. That is the rival category's strongest move (Lapse's darkroom, Dispo's
develop clock, Kuha's countdown), done with our own approved archetype.

⛔ **No sample photographs.** A stranger's wedding sitting in your library is a
lie. Flagged to the owner as his call; drawn the honest way meanwhile.
⚠ **The lit frame is a DOOR, not a second picker** — it scrolls to the "Your
uploads" way-in, whose sheet already holds the shipped upload control. A picker
here too would be a second copy of a control.

### One reader, because two components now need the same answer

`lib/papic-standings.ts` is new: the stage must know whether the library is empty
(roll or photographs) and the facts strip reports the same three numbers.
**Two components counting the same thing is a definition twice** — this page has
already paid for that shape once, when "which row is lit" was resolved in two
components that could not see each other and lit two.

⚠ **An unread count is still never zero.** Every field is `number | null`, null
means "not measured", and **either photo read failing makes the total
unmeasured** — because that number decides whether the stage draws an empty roll,
so an invented zero would show a couple with photographs a screen saying their
library is empty. `null` draws the gallery's own unmeasured state, never the roll.

### 🎨 Colour, measured on the dark ground

The light-theme tokens do not survive here, and this is exactly where a
light-only check waves a failure through: gold `#A9834B` on `#17160F` is **5.2:1**
(the one place gold text is safe) · white **18.1:1** · green `#46A46C` **5.3:1**
(the light-ground `#4F6B4A` is **2.7:1** here — never use it) · accent `#E5794E`
**5.7:1** (`#C24E25` is **3.5:1** and is button FILL only). Literals on purpose:
the panel is obsidian in BOTH themes, so a themed token would break exactly one.

### 🪤 Four of my own guards went red, and every one was right to

- The counts guard asserted the reads happen in the strip file; they moved to the
  shared reader. **Split: read rules against the reader, render rules against the
  stage — neither dropped.**
- It then failed again because it knew one syntax: `const cameras = …` while the
  reader returns `cameras: …`. **Same rule, same fallback, different expression.**
  A guard that knows one spelling reports a defect that is not there.
- The derived control bill flagged `WhereYouStand` as lost. **It is a rename, not
  a removal** — the line follows the control rather than being deleted, because
  deleting a line from that bill is how a control goes missing quietly.
- `lint:port-controls` caught the same rename independently. Baseline regenerated
  and audited: across **406 routes exactly ONE entry moves**, and it is that one.

**Verification:** typecheck **exit 0, 0 error lines** (printed unfiltered — an
earlier run this week was grepped to one filename and a zero read as clean when
it was not) · `test:unit` **10,578 pass / 0 fail** · `lint:contrast` 1,365
pairings all ≥ 4.5:1 · `lint:masthead` clean · Papic guards **52 pass** ·
**4 mutations, each measured before → after against a CLEAN baseline, all 4 RED**
(remove the stage · let the empty-check admit an unread count · invent a zero on
a failed read · drop the gallery). One earlier mutation run was discarded outright
because it executed in the wrong directory and printed zeros — a zero test count
is not a pass.

SPEC IMPACT: `SERVICE_CONTROL_CENTERS_DESIGN_2026-08-28.md` owner decision 1
(stage-first order) — taken as decided on the owner's *"we just want everything
to run smoothly"*, and reversible: refusing it restores the shipped order.
