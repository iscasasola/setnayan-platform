## 2026-08-09 · fix(config): the "Get a new QR" button was offered by one switch and refused by another

**What a person experiences.** A guest whose printed invitation QR had leaked could
open their invitation page, see "Lost your QR? Get a new one", confirm it, and be told
"Something went wrong." Nothing was wrong — the button had simply been switched on and
the thing behind the button had not. Now the offer and the action follow the same
switch, so the button either isn't there or it works.

**How it happened.** The switch is one setting, `GUEST_QR_SELF_ROTATE`, read in two
places: the invitation page decides whether the button is SHOWN, and the rotate action
decides whether pressing it DOES anything. Yesterday's parsing fix widened the page's
reader to accept `TRUE` / `1` / `yes` / `on`, and left the action still demanding the
exact lowercase word `true`. With the setting spelled any other way the two halves
disagreed — one offering what the other refused — and the action's "this feature is
off" refusal reaches the guest as the generic error message. The action file was in
neither half of the no-regression registry, so nothing noticed.

**What changed.**

- The rotate action now reads the switch through the same shared parser as the page.
  No behaviour change while the switch is unset or `false`: the button does not render
  and the action stays inert.
- The registry now lists both halves of the pair, with a note at each saying they must
  agree.

**Guard — the list stopped being the guard.** A hand-written registry only pins the
sites somebody remembered, which is exactly how this got through. Two new checks stop
trusting the list and ask the repository instead: for every switch either registry
names, they find EVERY reader of it anywhere under `apps/web` and require them all to
agree — all forgiving for the converted ones, all strict for the five deliberately held
shut (CSAM hash matching, the two DPO-gated ones, and the two that arm the full-res
replacement sweep). A switch that is forgiving in one file and strict in another is a
split brain whichever way round it is.

Three details that make these guards able to fail rather than decorative:

- They run on source with comments removed by a real block-comment state machine, so a
  docblock explaining the bug cannot satisfy the check it is explaining.
- A switch that matches ZERO readers FAILS instead of passing for free — a loop over an
  empty list is green, and that silence is the exact failure mode being guarded.
- The matcher refuses a prefix hit, so a setting named `…_SUITE` cannot be judged by a
  line that reads `…_SUITE_BETA`.

Mutation-tested six ways, each sabotage verified to have actually applied: reinstating
the original defect (red), a strict reader added in a file in NEITHER registry (red —
the blind spot the old guard had), the correct call present only inside a comment (red),
a held-strict switch widened in an unregistered file (red), a switch losing its only
reader (red), and a longer switch name that must NOT be mistaken for a registered one
(stays green — no false alarm).

**Swept the rest.** All 38 switches touched yesterday were grepped repo-wide across
every file type. 99 reader sites; `GUEST_QR_SELF_ROTATE` was the only genuine
disagreement. Every other remaining mention is prose — a code comment, a migration
header, or the switch name printed in an admin screen. The five held-strict switches
were checked in the same direction and all their readers agree, including one
(`lib/fraud-cluster-sweep.ts`) that no registry listed and the new sweep now pins.

**Measured in production, not assumed.** Production is serving the commit that contains
yesterday's change, so the widening is live. Reading the switch values inlined into the
live public bundles across 16 public pages: every one of the eight reachable readers
receives the exact lowercase `true` — the one spelling the old strict form already
accepted — so the widening activated nothing there. Google, Apple and Facebook sign-in
are confirmed ON and rendering on the live sign-in page. The server-only switches
cannot be read from outside the deployment and still need the owner's environment list;
`GUEST_QR_SELF_ROTATE` is one of them.

SPEC IMPACT: None — no product, pricing or scope decision. The switch's default stays
off and its meaning is unchanged.
