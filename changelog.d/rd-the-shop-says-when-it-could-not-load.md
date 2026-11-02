## 2026-09-23 · fix(shop): My Shop says when it could not load, instead of showing an empty shop

**SPEC IMPACT: None.** No locked decision moves; no schema change.

### The finding

The owner said the My Shop page had "a lot of inconsistencies". The audit found
seven UI tickets — and then this, which none of them would have reached.

`shop/page.tsx` wraps each optional read in a `try/catch` that degrades to an
empty value so one hiccup cannot blank the page. **Twelve probes. Six logged.
Six said nothing.** What the silent six fall back to:

| probe | what the supplier was shown |
|---|---|
| logo presign | their initials — a shop with **no logo** |
| team enrich | every member's name and email **blank** |
| portfolio thumbnails | photos **missing** from the gallery |
| Instagram | **"not connected"** |
| review options | **"No reviews yet — once couples review you…"** |
| coverage suggestion | the card simply **never appeared** |

🔑 **Each of those is a failure rendered as "you have nothing."** And with
nothing logged there was no way to discover it — not on screen, not in Sentry.
The comment above `logoDisplayMap` described the behaviour as intended:
failures collapse to defaults *"exactly like a vendor who hasn't set those
yet"*.

`logQueryError`'s own docblock had already asked for the fix: *"Use this in
every graceful-degrade catch so the silent fallback still leaves a trail."*
It is imported in that file.

### What changed

All six log. **The four whose failure a supplier can see, and cannot otherwise
tell from emptiness, carry a flag to the render and say so** — `<CouldNotLoad>`
in `_components/could-not-load.tsx`.

**A log line never changed a pixel.** Logging alone would have left the same
empty shop with a Sentry entry nobody reads — the whole lesson of #4579–#4585.

⚠ **The portfolio probe gets no flag, deliberately.** The page knows how many
keys it asked for, so a short gallery is already visible; a warning beside
something plainly fine trains people to stop reading warnings.

⚠ **The logged six are untouched.** They are deliberate apply-lag tolerance.
**The finding was the asymmetry, not the `catch`** — "make it consistent" would
have damaged six correct probes.

### The date save, separately

`updateBusinessStartDate` swallowed with a comment saying the revalidate would
show whether it persisted. It does not: the revalidate re-renders the OLD
value, identical to re-typing the date you already had.

🔑 **And the catch could not fire for the likeliest failure.** supabase-js
RESOLVES with `{ error }` on a database error rather than throwing, and the
result was discarded — so an RLS refusal or a constraint violation never
reached the catch at all. Not merely silent: unreachable.

### The guard, and the hole a sabotage found in it

`lib/every-probe-says-when-it-failed.test.ts` executes the pure rule in
`lib/probe-logging-rule.ts` rather than re-implementing it. Comments are
stripped with the repo's one stripper first — every file here names
`logQueryError` in prose, so raw matching would mark a silent catch as logged
because the paragraph above it discusses logging.

🪤 **The first cut of that rule was walked past by one of two sabotage shapes.**
It found the catch body by indentation; for a single-line
`try { … } catch { … }` the next brace at that indentation belongs to the
enclosing function, so the body swallowed unrelated code and borrowed a logger
from hundreds of lines away. The multi-line sabotage went red; the one-line one
stayed green. **Running one shape and calling it proven would have shipped a
guard with a hole in exactly the form somebody writes when being brief.** Now
brace-counted, quote-aware, and failing closed. Both shapes pinned as fixtures.

### Evidence

- New silent probe, **both** shapes → red, naming the file and line.
- An existing probe's log removed → red.
- The log replaced by a **comment naming `logQueryError`** → red (the reason
  comments are stripped).
- Clean → 3/3 pass. All 26 blocking `lint-*` guards green.
