## 2026-09-24 · fix(nav): the Event Hub tab reaches a planning phone, for the first time

`CustomerBottomNav` built the phone's menu with

```ts
buildCustomerMenuTree(eventId, { phase, dayOfOpen: false, hideKeys, seatingEnabled })
```

and **`websiteEnabled` was not in that object.** The plan-phase Event Hub Controller row is gated on
it, so the flag arrived `undefined`, the gate read that as *"this event has no website surface"*, and
the tab **never rendered on a planning phone at all**.

Measured across every phase, both ways:

```
websiteEnabled=false  plan   hub=no    home,guests,explore,studio
websiteEnabled=true   plan   hub=YES   home,guests,explore,studio,launch
websiteEnabled=false  dayof  hub=YES   (ungated)
websiteEnabled=false  after  hub=YES   (ungated)
```

🔑 **The day-of and after rosters build their `launch` row ungated, which is why nobody found it —
the tab appeared the moment the wedding arrived.** The bug existed only *before* the day, and before
the day is when the Hub is the product. `customer-menu.ts` says so about the very change that created
this row: *"on a phone in the months BEFORE the day — when the save-the-date and the invitation ARE
the product — the Hub was two taps deep behind a word for something else."* That fix shipped, and on
phones it never took effect.

🛑 **And the existing guard could not see it, by construction.**
`one-menu-word-in-all-three-phases.test.ts` checks this exact row in all three phases and passes —
its helper calls `buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true, … })`. **It supplies the
very input whose absence is the bug.** It proves the BUILDER is right and says nothing about what the
phone hands it. A guard that feeds itself the answer can never go red.

⚠ **The root cause is an asymmetry, not a typo.** `seatingEnabled`'s docblock, one field up, says
*"UNDEFINED MEANS SHOW, deliberately — a caller that has not been taught this field must not silently
lose the tab."* `websiteEnabled` defaults the other way. Two sibling gates, opposite defaults, and
only one designed for the caller who had not been taught. The gate itself is **right** — an event
kind with no website surface must not be offered the Hub, and the desktop rail hides it too — so the
caller is fixed, not the gate.

### The new guard asserts the CALLERS, never the builder

`apps/web/lib/the-phone-forwards-every-gate.test.ts`: every production call site of
`buildCustomerMenuTree` must forward **every gate the builder actually reads**. The gate list is
derived from `ctx.<name>` in the builder's own body — never retyped — so a gate added tomorrow joins
the assertion by existing. `slug` is correctly excluded: it is declared and read nowhere, so
demanding it would be demanding a ritual. Comments are stripped first, because a gate named only in a
docblock is a gate nobody forwards.

Probed in three directions rather than trusted:

| sabotage | result |
|---|---|
| drop `websiteEnabled` from the call (the original bug) | **red**, naming the file |
| make the gate stop gating | **red** |
| leave the word in a comment only | **red** |

Each restored to 4 pass with `dirty=` printed.

### 📌 One open question, pinned rather than resolved

Forwarding the gate made the phases comparable for the first time, and they disagree: an event kind
with **no website surface** is still offered the Hub on the day and afterwards, while the desktop
rail gates it in every phase — the same disagreement the plan-phase gate's own comment says it exists
to prevent. Closing that gap **removes** a tab, which is a different risk from restoring one and is
the owner's call. A test pins today's behaviour, so the day someone gates those rows it goes red and
they must say so in the diff.

Checks: 4 new tests · all 15 nav-reading test files green (157 assertions) · `tsc --noEmit` clean ·
`npm run lint` 0 errors · all 26 CI guards pass · **+0 exported server actions.**

SPEC IMPACT: None. The Hub row's key, label and href are unchanged in all three phases; a row the
design already specified for the plan phase now actually renders there.
