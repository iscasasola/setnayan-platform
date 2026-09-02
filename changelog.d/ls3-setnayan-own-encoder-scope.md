## 2026-09-03 · docs(live-studio): scope Setnayan's own encoder — the last hop to YouTube

Scoping session (LS3). **No runtime code changed.** Adds
`Live_Studio_Encoder_Scope_2026-09-03.md`: what already ships, the three ways to close
the browser→RTMP gap, their real cost against the LIVE ₱1,500/day price, a
recommendation, and the smallest shippable slice.

Four measured findings that change the decision:

1. **`getYoutubeStreamStatus` has ZERO callers.** `apps/web/lib/panood-youtube.ts`
   already reads `liveStreams.list(part=status)` → `{ streamStatus, healthStatus }`
   for 1 quota unit, and nothing in the repo calls it. So when the couple's encoder
   dies mid-ceremony, Setnayan **can** know within seconds and **never says so**. This
   is the repo's signature defect (a failure that renders as success) sitting on the
   most expensive surface it has. Verify: `grep -rn getYoutubeStreamStatus apps/web`.
2. **The "native capture app was scoped but never built (§ 4c)" citation is wrong
   twice.** § 4c of `Live_Studio_Unified_Spec_2026-07-25.md` is "Wave 1 + 2 shipped"
   and scopes no capture app. The real scope is **B4** in
   `Live_Studio_Cast_and_Roam_2026-07-23.md` — and B4 is a *phone* app pushing
   per-camera RTMP for Roam, **not** a desktop app encoding the program output. Two
   different apps; building the desktop encoder does not deliver B4.
3. **Audio reaches air only via a manual OBS step.** `program-surface.tsx`'s own
   docblock: OBS "does not capture a muted element's audio… the operator must add
   Desktop/Application Audio Capture." An operator who skips it broadcasts a **silent
   ceremony**, and nothing checks.
4. **Live Studio is ₱1,500/day** (`platform_retail_catalog_v2`, read live), not the
   ₱2,999 the spec still asserts. A LiveKit-style relay costs ~₱500 (6h) to ~₱1,000
   (12h) per wedding — **33–67% of gross revenue** — which is what "breaks the ₱0
   marginal-cost lock" actually means in pesos.

RECOMMENDATION: the Tauri desktop app already ships and is downloadable, but it should
**not** window-capture. It should composite → encode in the webview (the
`lib/reel-render.ts` WebCodecs H.264 path already proves this in-repo) and push RTMP
from Rust. That removes the OS audio-routing step, the Screen Recording permission, and
the occlusion failure modes in one move.

NEXT CONCRETE STEP (path-independent — do this before any encoder work): wire
`getYoutubeStreamStatus` to the controller behind a pure `decideIngestHealth` helper so
a dead encoder is visible on the console. It is correct for OBS today and for the
native encoder later.

SPEC IMPACT: **Yes, but NOT applied — owner sign-off first.** `09_Panood § 6`, and
`Live_Studio_Unified_Spec_2026-07-25.md` §§ 4c/4f/4h all assume an external encoder and
carry the wrong § 4c citation plus the stale ₱2,999. Flagged for the owner, deliberately
not edited unilaterally: the price and the relay/desktop choice are money decisions.
