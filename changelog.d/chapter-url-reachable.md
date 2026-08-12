## 2026-08-13 · fix(routing): a storyteller's chapter page had never been reachable in production

**Found by testing the previous PR on the live site rather than trusting it.** A
published, video-less chapter rendered a real 46 KB share card — so the data was
correct — while **its own page returned 404**. A brand-new chapter URL, never
requested before, also 404'd on its first request.

### The cause

The middleware rewrites `/u/{userSlug}/{eventSlug}[/rest]` → `/{eventSlug}[/rest]`
so the event subtree renders under the pretty nested URL. It fired on **segment
count alone** — "3 or more segments ⇒ nested event" — which ate the only other
route under a user profile:

```
/u/ana-at-marco/c/S89C-CK46HS1VSS   →  rewritten to  /c/S89C-CK46HS1VSS  →  404
```

Measured live: `/u/{slug}` → **200**, `/u/{slug}/{anything}` → **404**, and the
rewrite target `/c/{id}` → **404**, identically.

### Two reasons it survived

1. 🔑 **The chapter page's own comment reasoned about the wrong layer.** It
   argued the route could never collide because *"the `c` segment is a single
   static char, and real slugs are ≥3 chars"*. True — and irrelevant. That is a
   fact about **Next.js route matching**; the middleware rewrite runs **before**
   any route is matched and never consulted it. *A correct argument about one
   layer is not a guarantee at another.*
2. 🔑 **The route had no data, and a route with no data looks exactly like a
   route that works.** Publishing a chapter required an external video account
   until 2026-08-12, so prod held **zero chapters** and this URL had never been
   requested for a real one. Nothing threw. The only symptom was an absence —
   the same family as the phantom column, enum value, RPC argument, blocked
   iframe and wrong catalog.

### The fix

The decision moves into a pure `userNestingRewritePath()` (`lib/u-nesting.ts`),
which returns null for reserved `/u` subpaths. Reserving `c` costs nothing: an
event slug is `^[a-z0-9-]{3,32}$`, so a one-character segment can never be one.

🛡 **The guard derives its truth from the filesystem**, not from a second
hand-typed list — it reads `app/u/[userSlug]/` and fails if a real route
directory is missing from the reserved set, so the *next* route added there
cannot silently 404 in production. It asserts the directory scan is non-empty
first, because a search that cannot match is not a negative result.

Mutation-tested with counts printed: restoring the count-only rewrite (1 → 0
occurrences, marker present) turns the regression test red.

SPEC IMPACT: None (routing defect; the storytelling model row was logged
2026-08-12).
