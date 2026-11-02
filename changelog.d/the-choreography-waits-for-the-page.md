## 2026-09-14 · fix(invitation): the scroll choreography waits for the page instead of standing down

**The public invitation never animated — for anyone, since 2026-07-25.** Not
because the choreography was missing, but because its own safety net switched it
off on every load.

### The cause, caught with a stack trace

`PahinaMotionObserver` ran ONE synchronous query and gave up if it came back
empty. The page **streams**: React flushes Suspense content into
`<div hidden id="S:…">` buffers and moves it in afterwards with `$RS(...)`. The
script sits at ~96% of the document — still before those moves.

Measured on the live page by patching `DOMTokenList.prototype.remove` and
re-serving the real HTML in a frame:

```
when: remove · called from: give() · readyState: "loading"
selectorMatches: 0 · markers: 1 · hiddenBuffers: 3 · armed: true
…afterwards: selectorMatches 8 · revealed 0 · flag off
```

Zero chapters at that instant, eight a moment later. `give()` had already removed
`.pahina-js` **globally and permanently**, so all eight arrived unobserved.

🔑 **The fail-visible contract was suppressing the feature.** `give()` did exactly
its job — *"nothing to observe, so un-hide everything"* — at the one moment when
finding nothing was a **lie** rather than a fact. A given-up page and a
never-built page are the same pixels, and `give()` wrote nothing anywhere. That
is how it survived seven weeks on the page every guest sees.

### The fix — the contract is KEPT

`give()` still exists and still un-hides everything. What changed is when it may
conclude the page is empty: attach immediately (fast path unchanged); if nothing
matches **and the document is still parsing**, wait for `DOMContentLoaded` and
try again; only a second empty result is genuine. Deleting `give()` to make the
animation work would trade a cosmetic failure for a page of invisible sections.

- The retry is scheduled **two ways** — `DOMContentLoaded` and a 1.5s timer,
  whichever lands first — because `__pahinaArmed` is already true by then, so the
  RootFlag's 2s self-heal is no longer a backstop.
- **A stand-down now leaves a trace**: one console line naming what the selector
  actually saw. A silent safety net cannot be told apart from a feature nobody
  built.

### The guard RUNS the shipped script

🔑 **A source assertion would have passed all seven weeks.** Every line of the
broken version was present and correct — observer mounted, marker present,
selector right. What was wrong was *when* one line ran, and no grep sees that.

`the-choreography-waits-for-the-page.test.ts` lifts the real script string out of
the component and executes it against a fake DOM that streams the way production
does: a query answering 0 then 8, a `readyState` starting at `"loading"`, a late
`DOMContentLoaded`. Nine tests — the regression, the late attach, the reveal, the
unchanged fast path, the genuinely-empty stand-down, its console trace, both
retry paths, no double-attach, and the reduced-motion opt-out.

**Sabotage-checked against the real thing**: restoring the exact observer that
shipped from 2026-07-25 turns 7 of 9 red, naming it.

SPEC IMPACT: None — design 2026-07-25 §6 already specified this behaviour; it
never ran.
