## 2026-09-02 · feat(event-hub): View as — the couple checks what each person sees

**EH2.** Owner, 2026-09-02: *"make sure it also has view as (they pick what each role sees)."*

Everyone opens the same address and what it shows depends on who they are. The Hub resolves six
ways in — stranger · QR-session guest · seat-holder · invited account · host member · booked
supplier — and showed **none** of that to the person who owns the event. They could only trust it.
Now they can check it.

**The switch rides the stage's lower edge, under the four facts** (`hub-stage.tsx`), because it is
a property of the stage and not a setting — it never moves into a sheet. Five chips ship:
**You · Coordinator · Supplier · Guest · Stranger**, each painting what that person actually sees,
with a door to it where an honest one exists.

- **New:** `hubPreviewRoles` · `resolveArmedHubRole` · `resolveHubRoleView` in
  `lib/event-hub-control.ts`, beside the resolvers EH1 built. No third phase opinion —
  `resolveHubStage`/`resolveHubPhase` are HANDED in, never re-derived.
- **New:** `lib/hub-named-guest-flag.ts` — `NEXT_PUBLIC_HUB_NAMED_GUEST_PREVIEW_ENABLED`, **OFF**.

🚨 **THE GATE IS THE POINT, AND IT IS THE DEFECT THAT SHIPPED ONCE.** `loadHostMembership` selected
`member_type` and then never compared it, returning `Boolean(memberRow)` — so any row counted as a
host, and a `guest`-typed row could open a PRIVATE site and use `?phase=` to jump to phases the
couple had not launched, including their own unsent save-the-date. This ships that override to FIVE
roles. So the offer list is computed in ONE function, it asks **`isHostMemberType`** — the single
definition of "host" — and a `guest` row comes back with an EMPTY list, no chips and no doors.
Proved with a real `guest` row, at the resolver AND at the pixel, and mutation-tested by relaxing
the comparison to `Boolean` (4 tests red, two of them render tests).

⛔ **NO NEW ROUTE, NO NEW ENGINE, NO NEW PERMISSION.** Every door is an address that already ships
and already re-checks the viewer server-side: `/{slug}` · the four-value `?phase=` preview gated by
`loadHostMembership` · `?as=replied`, the FABRICATED seat-holder gated by a server-verified
`OwnerCapability`. A chip is a description plus a link; the DB is still the boundary.
**`?viewas=` deliberately is not `?as=`** — the public site owns that name.

🔒 **THE ONE PRIVACY SURFACE SHIPS DARK.** "As Ana Reyes" renders a real, named guest's personal
view to the host. Almost certainly fine — the host issued her QR — but it is the owner's call as
DPO, not engineering's (design § 7.5). The named role is behind the flag, **off in production**,
and nothing on this page reads a guest by name either way: even with the flag on, the seat-holder
door is the fabricated sample `lib/simulated-guest-preview.ts` already ships, so no real guest's
data can flow down this path at all. **Rendering an actual named person is deliberately unbuilt.**

🔑 **UNREAD ≠ EMPTY, ON THE ROLE CARDS TOO.** A guest list the host never shared says
`NOT_SHARED`; a refused read says it could not be read; a real zero is spoken plainly. Three
states, never two — the sentence "No guests yet" to a couple with 180 names is what this rule is
made of. Mutation-tested by making a withheld list render its zero.

**RULE 0 paid twice:** the `?phase=` host-gated preview and the `?as=replied` simulated seat-holder
both already ship and are reused rather than rebuilt. Neither was written for this.

Tests: `lib/event-hub-roles.test.ts` (16) · `lib/hub-named-guest-flag.test.ts` (3) ·
`app/dashboard/[eventId]/launch/_components/view-as-reaches-the-render.test.ts` (13, six
observations in real emitted HTML) · 4 wiring guards added to
`the-controller-wires-what-it-measured.test.ts`.

**OPEN — OWNER, AS DPO:** may "View as" name a REAL guest? Flag is off until you say. Separately:
flipping it on today offers the seat-holder SHAPE via the sample, not a named person.

SPEC IMPACT: None. `EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` § 2.1 job 4, § 3.2 and § 7.5 already
describe this build; § 7.5 stays open by design and is restated in the flag's own docblock.
