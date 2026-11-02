## 2026-08-27 · feat(plan): a wake plans its own farewell — the funeral home stops landing in "Logistics & Misc"

Owner 2026-08-27, having ruled that death-care suppliers are listed: *"1 first then 2 after."* This is the after.

### What was wrong

`PLAN_GROUPS` had **no notion of an event type at all** — one flat, wedding-shaped list. So a wake borrowed the wedding's plan wholesale, and the **funeral home — the single largest thing a family arranges, chosen within hours of a death — bucketed into "Logistics & Misc"** beside the giveaways and the security detail. Nothing errored. The number was simply filed under the wrong heading, on the screen a grieving family uses to work out what they can afford.

### What ships

Three sections of its own — **Funeral home · Cremation · Memorial park** — and an optional `eventTypes` scope on a plan group. Omitting it means every type, which is what all forty-odd wedding cards are and stay: this is additive, not a re-shaping.

⏱ **`monthsBefore: 0`, and that is the point.** Every other card answers *"how many months before the day should this be locked."* A death is not planned. A funeral home is chosen within hours, and a countdown to one would be obscene — 0 is the only honest value, and it is **asserted** rather than described, because a well-meaning tidy-up ("surely this should be 1?") would put a countdown on a funeral.

🗣 **The copy changes register.** Not *"Lock your funeral home"* — the verb every other card uses is a planner's verb. *"Choose the funeral home"*, *"Choose where they will rest"*. The why-it-matters lines say what the choice decides and stop, rather than nudging a bereaved family toward a deadline.

### 🔑 The filter is on the render, never on the bucketing

`planGroupForCategory` stays deliberately **unfiltered**. A stored pick must resolve to its group whatever screen is asking — if scoping leaked into resolution, a `funeral_home` pick read from a context that did not know the event type would resolve to null and be swept into the fallback bucket, **recreating the exact defect this change reverses, one layer down**. Rule 5 pins that distinction.

For the same reason `budget-truth.ts` keeps iterating the full list: it builds a category→bucket lookup, not a render list, and that is how a funeral-home pick gets labelled "Funeral home" instead of "Other".

### 🪤 My own guard was DECORATION, and only mutation found it

Rule 4 ("the wedding plan is unchanged") derived `expected` from `PLAN_GROUPS`-minus-farewell and compared it to `planGroupsForEventType('wedding')`. Adding `eventTypes: ['wedding']` to an existing card leaves it in **both** sides — so the two moved together and agreed, and the mutation passed **green**. *Two halves wrong in the same direction agree with each other perfectly.*

Rewritten to assert the **scope set itself**: exactly three groups carry an `eventTypes` and they are the farewell ones. A scope on any other card silently deletes it from every type it does not name — a birthday losing its logistics section, with nothing thrown.

⚠ **And one mutation verdict was mine, not the code's.** M5 read "DID NOT APPLY" because I counted a needle (`hint:`) that the edit does not change. The sabotage had applied fine. *An unmeasured mutation proves nothing — but so does a mutation measured on the wrong string.*

### Wired, not merely written

🔑 **A resolver nothing calls is a gate with no handle**, so both render paths were switched over in the same change: `buildPlanBudgetModel` (two loops and the group map, via a new optional `eventType` arg defaulting to today's behaviour) and the recommended-deadline builder — which unfiltered would hand a wake *"lock your reception venue eight months out"*, and hand a couple *"choose the funeral home"*.

### Also here

The three leave the deliberate gap-leaf register (17 → **14**): a gap leaf is a trade nobody has decided where to file, and these have now been decided. That allowlist can only shrink, which is the direction it just moved.

### Verification

tsc **0 errors, exit 0** · unit **10,532 / 0** · db **1,645 / 0** · **5 / 5 mutations RED** with occurrence counts printed before → after (scope removed · countdown added · resolver ignores scope · scope on an existing card · planner-nag copy).

SPEC IMPACT: None beyond the 2026-08-27 death-care ruling already recorded — this is the plan half of it.
