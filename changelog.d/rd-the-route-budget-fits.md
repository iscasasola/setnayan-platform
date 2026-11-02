## 2026-09-23 · fix(build): the route budget fits — production can deploy again

`experimental.clientSegmentCache: false`.

**Production could not deploy at all.** Three builds died at
`process-and-upload-routes` with `Maximum number of routes … Max is 2048, received 2053` —
including the fix for a live outage, so every page inside an event kept 500ing for signed-in
couples while the fix sat behind a feature merge.

**Four causes tested and eliminated before touching anything:**

| suspected | measured |
|---|---|
| new pages | **0** route files added between the last good build and the first failing one |
| more prerendering | **360** static pages in BOTH builds |
| routing config | `next.config` redirects / rewrites / headers unchanged |
| the build cache | a **no-cache** rebuild of the same commit still reported **2053** |

🔑 **The five were never a feature — they were the last of the headroom.** The count is
structural: ~495 app pages × ~4 route entries each (the page, its `.rsc`, and two
`.segment.rsc` prefetch entries). The client segment cache is 2 of those 4, so switching it
off returns on the order of a thousand routes.

**What it costs:** client-side navigation prefetch is less eager. Nothing renders differently.

⚠ **Re-measure before turning it back on.** A deployment's route count is reported ONLY when it
fails. `routes-manifest.json` does not count what Vercel counts — believing it did cost most of
a day.

SPEC IMPACT: None.
