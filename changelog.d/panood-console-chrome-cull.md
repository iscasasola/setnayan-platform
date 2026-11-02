## 2026-07-21 · feat(live-studio): cull the console chrome into one 44px status strip

Owner, pointing at the page header: *"this is taking up space. use the council to fix the whole
screen and maximize it for its full potiential"*. First build off the council verdict
(`Live_Studio_Console_Redesign_Council_Verdict_2026-07-21.md`).

### Removed from above PROGRAM

| Element | Why |
|---|---|
| Back-link row | → 24px chevron in the strip, hidden while on air |
| Duplicate "Connect cameras" button | The canonical doorway is in the sources rail, where an operator notices a camera is missing |
| `sn-eye` "BROADCAST" | The URL and the sidebar already say it |
| `sn-h1` couple name + Tv icon | → 12px in the strip. `.sn-h1` is a fixed 36px with no responsive step |
| Three-line description | Describes an interface the operator is looking at. Belongs on the setup page |
| `UpgradeBanner` | See below — this one is not about pixels |
| Streaming-off warning banner | Verified **4th** restatement of the same message (it also appears on the monitor, the tiles and the overlay). → one word, `No video yet` |
| Board \| Compact row | A set-once, persisted control does not earn a permanent row → icon at the end of the strip |

### The upsell banner was deleted for a reason that isn't space

The purchase rail is **apply-then-pay with a 24-hour manual reconciliation SLA** — every automated
method in `setnayan_pay_methods` is inactive. **Mid-show conversion is impossible by construction**,
so an in-console upsell cannot convert; it is chrome that costs the operator screen. The free tier's
paywall is the SETNAYAN overlay on every video surface, which is unmissable.

### What the strip carries instead

Back chevron (hidden while live) · couple's name, truncating · `Preview` chip when unpaid ·
`No video yet` when the streaming flag is off · on-air tally · Connect cameras · Pop out for OBS ·
Board/Compact toggle. 44px, not 32 — `globals.css` sets `min-height:44px` on every `<button>` and
this row holds several; overriding that would be a lie about the tap targets.

The page wrapper becomes `contents`, so the console's measured fit (PR #3442) now starts at the top
of the content area. PROGRAM takes every pixel the chrome gave back.

124 unit tests pass; typecheck + production build clean.

SPEC IMPACT: Implements the § 2 cull from the console redesign verdict. The source-bus and
moment-rail restructure (§ 3) and the ScreensManager deletion are **not** in this PR.
