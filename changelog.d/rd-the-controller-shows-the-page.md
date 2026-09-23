## 2026-09-23 · feat(launch): the Event Hub controller SHOWS the page instead of describing it

`hub-stage.tsx` has promised a "miniature" in its own docblock since it was written.
What stood in that slot was **prose** — `Day-of · the running order, live` — so the
controller narrated a page it had never once looked at. A couple could read that
sentence all week while their page rendered a monogram that never loaded, and nothing
on the controller would differ by a pixel. That is the house disease (a measurement
that never reaches the render) wearing the house typeface.

The stage now mounts the couple's real page, live, at phone width.

- **Same address as its own button.** `/{slug}` — no `?phase=`, no `?as=`, no
  `?editor=1`. If the page's own phase resolution ever disagrees with the stage we
  computed, the frame shows the disagreement instead of letting the caption cover it.
- **Clipped, not scaled.** A 420px frame renders the real mobile layout 1:1; a
  `transform: scale()` would lie about type size. Same reason
  `website/editor/_components/editor-shell.tsx` opens on `max-w-[430px]`.
- **Inert** — `inert` + `tabIndex={-1}` + `pointer-events-none`. It is a picture of
  the page; the lit button beneath it is the door.
- **Two things silence it, and only two:** a refused event read (no card at all, and
  the existing "we could not reach your event" copy stands), and an event with no
  address yet (the card and its countdown stay, the frame does not — there is no page
  to photograph). Neither is an apology and neither is a zero.

### Two labels stopped being true the moment the frame appeared

The owner ribbon rides this frame. `buildOwnerRibbon` gates on the server-verified
capability **alone** — no param, no cookie, no prop a caller can set
(`lib/owner-ribbon.ts`, owner-locked 2026-07-26) — so a host cannot stop being signed
in, and inventing a hide-the-ribbon param to rescue a caption would be weakening a
locked gate to win an argument with a label. Instead:

- the eyebrow `As your guests see it · right now` → `Your page · right now`, with a
  caption naming the strip guests never see;
- the CTA `Open as a guest` → `Open the live page`, because the host's session travels
  with the click and what opens is the host's own page.

⚠ **The same label is still wrong on three other surfaces** — `plan3d-stage.tsx` and
two `ctaLabel`s in `lib/event-hub-control.ts`, one of them pinned by
`the-hub-next-step-never-points-at-itself.test.ts`. That is a vocabulary sweep, not
this change, and it is flagged rather than half-done.

### A name collision disarmed a gate, and the gate caught it on the first run

The CTA was briefly labelled `Open your page` — which is the **host role's own**
`previewLabel`, used by `view-as-reaches-the-render.test.ts` to prove a `guest`-typed
member cannot arm the host view by hand-typing `?viewas=host`. Putting those words on
a button that is *always* painted made the guard's failing case and its passing case
emit identical HTML. Fixed twice: the button took a different word, and the guard grew
a second anchor on the host role card's own footnote, which no button can collide with.

**Guards** (`hub-stage-renders.test.ts`, +4; all five sabotage-proven — delete the
frame · ungate the slug · hoist it above the read gate · drop the ribbon note · restore
the old eyebrow — each breaks exactly the guard facing it, and only that one):

- the frame's `src` equals the couple's address **and** the button's `href`;
- the ribbon is named where it is seen, and neither label claims a guest's eye;
- a refused read paints **no** frame — not an empty one, none;
- no address yet → no frame, but the stage, its countdown and `Set your link` stand.

SPEC IMPACT: None. No schema, no price, no locked decision. The owner-ribbon gate is
respected as written, not relaxed; the "Open as a guest" vocabulary question is raised
for the owner rather than settled here.
