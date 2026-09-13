## 2026-09-08 · fix(build): pin one Node major, so CI's build predicts Vercel's

Root `package.json` `engines.node` goes from `">=22.0.0"` to `"22.x"`, and
`apps/web/lib/one-node-version-everywhere.test.ts` holds `.nvmrc`, that field and
every workflow `node-version:` pin to the same major.

**Why.** On 2026-09-07 four consecutive production builds OOM'd on Vercel
(#5287, #5289, #5292, #5295) while CI's own `production build` job passed on the
same commits — #5287 went green in 7m38s. Production served a four-day-old
deployment for hours and nothing was red.

They were not the same build. CI pins `node-version: 22`; the Vercel project
resolved to **24.x**, because Vercel takes the newest supported major that
satisfies `engines.node`, and `">=22.0.0"` satisfies 24. Different V8, different
heap high-water mark — so CI could pass at a ceiling Vercel blew through.

🔑 **A range is not a pin.** `">=22.0.0"` reads like "we target 22" and means
"whatever is newest". It was the only line in the repo that let production run a
major nothing was tested on, and it hid in plain sight: `.nvmrc` said 22, all 17
workflow pins said 22, the owner's own machine runs 22.

The guard is mutation-tested three ways — restoring the open range, pinning
engines to a different major than `.nvmrc`, and drifting a single workflow to 24
— each turns it red, and the third names the offending file.

**What this does NOT do.** Nothing in a repo can read the Vercel project's own
Node setting, which still says `24.x`; `engines.node` overrides it at build time,
so the two now disagree on paper and agree in practice. Setting the project to
`22.x` in Vercel's dashboard would remove that last inconsistency — a one-click
owner action, not required for correctness.

SPEC IMPACT: None — build configuration, no product behaviour or schema change.
