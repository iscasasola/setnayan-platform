## 2026-08-10 · diag(outage): make production name the caller behind the signed-in `/dashboard` failure

**Temporary instrumentation, not a fix.** It exists because reading the code has been tried and is exhausted.

### The outage

Signed-in users get Next's default crash screen. Safari's console shows:

> `SecurityError: Attempt to use history.replaceState() more than 100 times per 10 seconds`

Established, not assumed: signed **out** the site is fine (`/`, `/login`, all chunks resolve); it reproduces in a **private window**, so it is not one browser's cache or session; **two production rollbacks did not fix it**; and the server logs show no dashboard errors at all.

### Why reading the code could not finish the job

Every app-level candidate has been cleared — all seven `replaceState` call sites are user-gesture callbacks, the param-stripping effect is ref-guarded and early-returns, the interval refresher is 45 seconds and is not mounted on this route, and no launcher component loops.

🔑 **And there is a structural reason it cannot be found by reading.** Next's `HistoryUpdater` calls `history.replaceState` on **every router-state change** — its effect is keyed on `[appRouterState]`, not on the URL. So *">100 replaceState in 10s"* does **not** mean anyone wrote the URL 100 times. It means the router dispatched 100+ times: a `router.refresh()`, a server action, or a resolving RSC subtree fetch each cost one. **The throwing call is Next's own; the cause is several frames further up** — which is information a stack trace has and the source does not.

### What this ships

A probe that wraps `history.replaceState`/`pushState`, and when writes cross **40 in 5 seconds** — deliberately under the browser's 100/10s, so the stack is captured while the storm is live rather than after the throw — posts the stack to a route that logs it. One page load then names the caller.

Rules it obeys, because a diagnostic that changes behaviour is worthless for diagnosing behaviour:

- **Always calls through** to the real function.
- **Reports once** per page load — a storm must not become a report storm.
- **Never throws.** A reporter that explodes is caught; the real call still happens. Tested.
- **Path only, never the query string** — this app's query strings can carry guest tokens, and a diagnostic must not become the thing that leaks one. Tested.
- `keepalive` on the POST, because the page it reports from is about to die; without it the request goes with the document and the one piece of evidence never arrives.

⏭ **Remove this once the caller is identified.** It is marked temporary at the mount site.

Verified: 8 probe tests · `tsc` clean · 20/20 `lint-*.mjs`.

SPEC IMPACT: None.
