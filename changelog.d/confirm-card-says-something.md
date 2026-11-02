## 2026-08-10 · fix(open-shop): the pin confirmation asked a question with nothing in it

The owner quoted the sentence back with no other comment: **"Is this the right spot?"**

That is what the card said whenever the map found the pin but could not name the place — and it showed **nothing underneath**. A confirmation with no information to check against does not check anything. It trains people to tap yes.

This now matters more than it did yesterday: the pin is owner-locked as **required**, and answering this card is what completes the step, so it sits on the critical path for every vendor who ever signs up.

### The fix is not better phrasing — it is showing what we already know

| what the lookup returned | what the card says |
|---|---|
| a city | **"Are you in Quezon City?"** with the matched street beneath — "Quezon City" alone cannot tell you whether it found YOUR building |
| a street, no city | "Is this the right spot?" with that street |
| **nothing** | "Is this the right spot?" **with the address the vendor typed** |
| nothing, and nothing typed | "We couldn't name that spot. Is the pin where your business is?" |

🔑 **The third row is the one that earns this change.** A vendor whose address does not geocode still typed something — and it was sitting in the box **directly above the card that was ignoring it**. Their own words are the best thing on screen to check a pin against.

🔑 **And the matched street beats the typed one whenever we have it.** Echoing back what someone just typed agrees with any pin at all; the resolved address is the only line that can *disagree* with a wrong pin. The fallback is a fallback, not a preference.

The last row still asks a question with no address in it — because there genuinely is none — but it says so plainly and points at the thing to look at, instead of pretending there was something to read.

Extracted to `lib/pin-confirm-copy.ts` and mutation-tested: dropping the typed-address fallback (2 fail), preferring the typed address over the matched one (1 fail), and dropping the whitespace trim so a blank counts as an answer (1 fail).

Verified: **7360/7360** unit · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None.
