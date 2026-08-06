## 2026-08-06 · fix(marketing,patiktok,env): stop showing engineering notes to customers, and stop lying about which switches work

Batch 2 of the "is the codebase actually messy?" audit. Nothing here is a crash —
every item is something that told a **person** something untrue.

### Customers were reading our internal notes

1. **The public features page stamped internal spec codes on every feature.**
   14 literals across three sections, rendered in BOTH locales to anonymous
   visitors and to Google — `Iteration 0001`, `Iteration 0008`, … next to each
   feature on the page whose entire job is to make the product look finished.
   To a couple deciding whether to sign up they read as version numbers or beta
   warnings. The codebase already suppresses this string class elsewhere (the
   `showIteration` prop exists explicitly "to keep internal spec-cross-reference
   strings out of couple- and vendor-facing surfaces"), so this was an oversight,
   not house style. **The field is deleted, not merely unrendered**, so a later
   edit cannot put it back on screen.

2. **The Patiktok booth showed literal `TODO(…)` markers to paying couples.**
   Two of them, in `<p>` elements — not comments — including the phase codes. A
   couple who bought the booth is *redirected straight onto that page*. Moved
   into comments, where the intent survives and the customer never sees it.

### Switches that lied about what they controlled

3. **Two coordinator flags were read by ZERO lines of code** while `.env.example`
   carried step-by-step "flip this to turn it on, default OFF" instructions and
   **six code comments** cited them as the live gate.
   🔴 **The real gate is the in-app Data Privacy board**, and BOTH controls
   (`coordinator_run_of_show`, `coordinator_day_of_broadcast`) are **`active` in
   prod — verified against the live database.** So both coordinator features are
   LIVE TODAY, the exact opposite of what the file promised. Every one of the six
   comments now names the real control; the two dead vars are removed.
   🔑 Six hits on a grep, zero of them a read — *ask whether every hit is a READ.*

4. **`NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL` removed** — 0 readers. It promised that
   setting a date makes every paid SKU resolve to ₱0 with an automatic sitewide
   banner. The feature was deleted 2026-07-27; the instructions stayed.

5. **A documented variable name that does not exist** — `.env.example` pointed at
   `NEXT_PUBLIC_PACKAGE_AUTHORING_ENABLED`. The real name has no `_ENABLED`
   suffix, so anyone following the doc created a variable the app ignores and
   concluded the editor was broken.

### The rule is mechanical now

`scripts/lint-no-engineering-notes-in-ui.mjs` fails the build when
TODO / FIXME / HACK / WIP survives in rendered UI text under `app/**`. Comments
are stripped first, so a marker where it belongs is always fine. Wired into CI.

⚠ **Two bugs in the guard itself, both caught before it shipped:**
- The comment stripper collapsed multi-line comments to one space, **shifting
  every later line number** — it blamed an innocent `name="vendor_validate_email"`
  60 lines from the real marker. A guard that points at the wrong line is worse
  than none: the reader looks, sees nothing, and stops believing it. Replacements
  now preserve newline count.
- `XXX` was in the marker set and matched the phone mask
  `placeholder="09XX XXX XXXX"`. Removed — a marker colliding with real copy
  generates exactly the noise this guard exists to prevent.

Verified by sabotage: re-inserting the booth TODO as visible text makes it fail
at the correct line; a clean tree passes.

### 🚨 A regression I shipped in #4172, fixed here

`lint-port-no-lost-controls` has been **FAILING on `main`** since #4172. Changing
the two admin links from `/admin/vendors/[seg]` to `…/edit` changed a reachable
destination, and that guard's baseline had to be regenerated **in the same PR**.
I did not, and the PR merged anyway — the check is not required.

Baseline regenerated. It also absorbed four drifts from OTHER merged PRs that
skipped the same step, and the guard's whole purpose is that each one be a
readable line, so they are named here rather than swallowed:
- route `/dashboard/[eventId]/studio/panood/reviews` **deleted** (by `cbab1de05`,
  the Live Studio Cast retirement — not this work); routeCount 404 → 403
- `+ gallery-anchor.ts`, `+ releaseAction`, `+ /api/oauth/youtube/start`, `+ /privacy`
- mine, intended: the two `…/edit` destinations and `+ /wall/[seg]` (the Live
  Photo Wall card from #4172)

### Verification

`tsc --noEmit` exit 0 · **all 14 lint scripts pass** (13 before, plus the new one).

SPEC IMPACT: None — no schema, pricing or product decision changed. But see the
owner note above: two coordinator features are live in prod while the corpus and
`.env.example` both described them as off by default.
