## 2026-10-04 · feat(maker): See as — preview the Event Hub as a guest who hasn't replied, replied Yes, declined, or is signed out (PR-10)

EVENT_DETAILS_STUDY_2026-10-04 §7 PR-10 (prototype screen 12). The Maker's 👁 Preview
"See it as…" row (a role's door: You / Coordinator / Supplier / Guest / Stranger) becomes
**See as ▾** — You · editing · Guest who hasn't replied · Replied Yes · Declined · Signed out.
On a phone they are rows of 👁 Preview; on a desktop the same pick is one dropdown above the
preview (each width has exactly one). A small "See as · …" tag sits on the phone canvas while
a guest state is on.

It is the SAME mechanism as the old `?as=replied` sample-guest preview, extended — never a
second preview. The canvas keeps its address (`?phase=…&editor=1`, the draft, the bridge) and
gains `?as=<state>`; `app/[slug]/page.tsx`'s sample-viewer branch (`resolveSampleViewer`,
lib/simulated-guest-preview.ts) draws the guest page's own components for a SAMPLE guest:
the arrival action reads RSVP / "You're going" / the declined line; **Me is drawn on the
canvas** (the guest page's own `GuestMeSection` + `GuestTicket`, the picture the host's own
ticket preview); Signed out draws the stranger's door (`GetInside`), or `PrivateLanding` on a
private event. Outside the canvas only `?as=replied` on the RSVP stage is honoured, exactly as
before.

Nothing the sample guest does writes: See as is Maker state only (not the draft, not the tab's
memory); the branch only reads; the sample keeps `SIMULATED_GUEST_ID` (matches no row; the
reply action refuses it); the canvas mounts `SampleViewerInert`, which swallows every submit
and every press; the guest's sign-out form and the door's join action are not rendered for it.

New: `lib/see-as.ts` (the words + param), `app/[slug]/_components/sample-viewer-inert.tsx`.
Guards: `lib/see-as-draws-the-guest-components.test.ts`, `lib/see-as-never-writes.test.ts`;
eight existing guards re-pointed from `viewAsHref`/"See it as…" to `seeAs`/"See as".

SPEC IMPACT: None — builds EVENT_DETAILS_STUDY_2026-10-04_fable.md §7 PR-10 as written. One
call flagged for the owner: the prototype's default row reads "Guest who hasn't replied"; this
build keeps the couple's own editing canvas ("You · editing") as the default, because the
editing canvas draws empty scenes for the couple to fill and a guest view does not.
