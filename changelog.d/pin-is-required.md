## 2026-08-10 · feat(open-shop): the map pin is now required, and confirming it is what completes the step

Owner-locked, verbatim: *"needs to have a pin on the map before they can continue. so you have to ask them if the pin location is correct. once they confirm, that is when they can only complete the 4 step."*

**A pin, then a yes, then the city.** All three, in that order.

This **reverses** the previous rule, where the pin was optional and the confirmation was only demanded `if (pinned)`. Two things went wrong under it, both seen in production this morning:

- a shop was created before anyone had read the address the map had found, and
- an absent pin was written to the database as **0,0** — open ocean off West Africa — so the shop silently dropped out of every distance search while its own dashboard looked perfectly normal.

### The dead end this could have shipped with, and how it is closed

The confirmation card used to appear **only when the geocoder returned something**. Make the pin mandatory without touching that, and a vendor who taps a spot the geocoder cannot name gets **no card, so nothing to confirm, so the step can never be completed** — with no message explaining why. Rural Philippine coverage misses often enough that this is a real vendor, not a hypothetical one.

🔑 **A pin the machine cannot name is still a pin the vendor can vouch for.** The card is now gated on the *pin*, not the lookup: it asks *"Is this the right spot?"* and takes their word for it. Tapping the map always places a pin, so there is always a way through.

### The old reasoning was right, and is answered rather than deleted

The component's docblock argued that *"the map cannot lock anyone out"* because rural lookups return a province or nothing. That paragraph is now **corrected in place** rather than contradicted further down — a file that states a rule at the top and reverses it in the middle gets read from whichever half you land on first, which is a failure this project has already paid for twice. Its concern is met by the card change above and by the city box staying editable.

### The rule can now be broken on purpose

It was three `if`s inside the wizard, and the tests covering it were **regexes over the component's own source text** — assertions that the string `location_confirmed` appeared *somewhere in the file*. That kind of test notices deletion and nothing else; it cannot tell a working rule from a broken one, and it cannot tell that the order is wrong.

The rule now lives in `locationStepError` with real tests. Mutation-tested three ways:

| sabotage | result |
|---|---|
| make the pin optional again | **3 fail** |
| stop demanding the confirmation | **2 fail** |
| check the city *before* the pin | **1 fail** |

🔑 **Order is part of the rule, not a detail.** Telling someone to "confirm the address" before anything is on the map names a button that is not on screen yet — an instruction that reads as a dead end. The city comes last because it is the one field a person can always fix by typing.

Verified: **7347/7347** unit · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None — the corpus carries no rule about the pin being optional; this is the first time it is stated either way.
