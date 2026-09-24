# Design-system coverage register — 2026-09-24

Generated against `origin/main`. **Re-measure, never quote these as current.**

```
431 page.tsx  ·  82 pure redirects  ·  349 REAL SCREENS
  145  MAPPED      render through PageMasthead — restyle it once, they follow
   57  EXEMPT      see the split below
  147  UNMAPPED    no template, no exemption — this is the work
```

## The exempt 57, split by whether they can still adapt

### Genuinely cannot wear the skin — leave them

| n | reason | why |
|---|---|---|
| 6 | `print` | ships without the app stylesheet by design; the radius lint already excludes it |
| 12 | `canvas3d` | a 3D viewport, not a page — nothing to restyle inside the canvas |

### Forced, but they CAN adapt — bring them in

| n | reason | what still follows the system |
|---|---|---|
| 20 | `capture` | camera / stream surface — the chrome, type and overlays around it still follow the system |
| 7 | `chromeless` | deliberate full-viewport escape — still uses tokens for colour and type |
| 12 | `owner-excluded` | `/[slug]` guest tree — a DECISION (keeps Cormorant), not a technical limit |

**18 genuinely exempt · 39 forced-but-adaptable.**

## The 147 unmapped, by archetype

⚠ **The archetype column is a HYPOTHESIS, not a verdict.** It is keyword scoring over each
screen's own source. It is right often enough to sort the work and wrong often enough that
every row needs a human glance — `vendor-dashboard/shop` is scored Gallery because it renders
`<Image>`, and it is plainly a console. Use it to batch, not to decide.

| archetype | screens |
|---|---|
| Gallery | 45 |
| Editorial | 32 |
| Ledger | 26 |
| Wizard | 18 |
| Detail | 12 |
| AdminConsole | 7 |
| Unclassified | 6 |
| Sheet | 1 |

## Most forced — ranked by off-token marks

`hex` = hard-coded `#rrggbb` · `arb` = arbitrary `[12px]` · `inline` = `style={{…}}`.
Total across the 147: **2,452** marks. These are where the brief
costs the most and buys the most.

| route | archetype (guess) | hex | arb | inline |
|---|---|---|---|---|
| `vendor-dashboard/shop` | Gallery | 39 | 21 | 265 |
| `vendor-dashboard/performance` | Editorial | 0 | 55 | 117 |
| `tour/budget` | Ledger | 144 | 25 | 0 |
| `vendors` | Ledger | 8 | 0 | 158 |
| `dashboard/[eventId]/vendors/[vendorId]/workspace` | Ledger | 0 | 128 | 1 |
| `vendor-dashboard/on-the-day` | Gallery | 10 | 15 | 95 |
| `onboarding/wedding` | Gallery | 45 | 4 | 47 |
| `open-shop` | Wizard | 1 | 6 | 75 |
| `vendor-dashboard/customers` | Ledger | 1 | 17 | 59 |
| `v/[slug]` | Gallery | 0 | 69 | 6 |
| `tour/gallery` | Gallery | 59 | 8 | 1 |
| `(shell)/explore` | Gallery | 4 | 61 | 3 |
| `creators` | Editorial | 4 | 0 | 56 |
| `u/[userSlug]` | Gallery | 56 | 0 | 0 |
| `tour/vendors` | Gallery | 38 | 5 | 1 |
| `tour/seating` | Editorial | 35 | 6 | 0 |
| `monogram` | Editorial | 31 | 8 | 1 |
| `u/[userSlug]/c/[chapterId]` | Editorial | 29 | 0 | 0 |
| `tour` | Gallery | 20 | 5 | 1 |
| `vendor-dashboard/messages/[threadId]` | Ledger | 0 | 25 | 1 |

## What this register cannot see

It reads each screen's own folder **plus one hop** through its `@/…` imports. A screen whose
renderer lives two hops away is invisible to it. That is not hypothetical: `plan3d` was missed
on the first run because its 3D lives in `lib/seating-3d`, and an earlier pass matched the WORD
"three" in 504 files. Both were caught by calibrating against five routes whose answer I already
knew. **Any re-run must keep those probes** — `invitation/print`, `plan3d`, `panood/control`,
`[slug]/seat`, `seating/lab` — and fail if one of them lands wrong.

## The conflict that gates all of it

`design_handoff_setnayan_redesign/README.md` says, verbatim: *"separate cards by border
`#E1DCD1` + shadow, **never a second surface**"*. The new brief bans borders outright. That is
not a per-screen question — it is an amendment to a committed system, and it has to be settled
before any of the 147 are touched.