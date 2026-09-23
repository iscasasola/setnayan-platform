## 2026-09-23 · fix(launch): "Open as a guest" does not open as a guest — retired where it is false, kept where it is true

All three `ctaLabel: 'Open as a guest'` values in `lib/event-hub-control.ts` carry
`ctaPath: ''`, which `launch/page.tsx` renders as `/<slug>` in a new tab. The host's
session travels with that click, `site-body.tsx` mounts `<OwnerRibbon>`, and
`buildOwnerRibbon` lights it from the server-verified capability **alone** — no query
param, no cookie, no prop a caller may set (`lib/owner-ribbon.ts`, owner-locked
2026-07-26). What opened was the **host's** page, with the host's ribbon across the
top, under a button promising a guest's view.

- three `ctaLabel`s → **`Open the live page`** (the house idiom already in use: "Open
  the live hub", "Open the live desk")
- `key: 'preview'` headline `Look at the page the way a guest does.` → `Look at the
  page your guests are opening.`
- `key: 'ready'` blurb `Look at the day the way your guests will see it…` → `Look at
  the page your guests will open…`

⛔ **The fix is the label, never the gate.** A "hide the ribbon" param would be
weakening a locked capability check to win an argument with a caption.

### The claim was not only in the button

Two of the three steps repeated it in their own **prose**, one line above the button
and in a larger typeface. A guard on `ctaLabel` alone would have gone green while the
promise stayed on screen. So the new guard reads **every word of every step** —
headline, blurb and label — across all eleven branches `everyStep()` reaches. The
sabotage it is built to fail is *"rename the button, leave the sentence"*, and it does:
all three sabotages (revert a label · revert the headline only · revert the blurb only)
break it, and only it.

### ✅ `plan3d-stage.tsx` KEEPS the label, deliberately — the sweep's own premise is
false there

The task that opened this work said to rename it. Measured on `origin/main` instead of
taken on trust, and the reasoning does not reach it. Its door is `/<slug>/venue`:

- `git grep -n OwnerRibbon -- 'apps/web/app/[slug]/venue'` → **nothing**. No ribbon,
  and no `SiteBody` to carry one.
- the route reads no guest session and no seat, so it has nothing personal to withhold
  from a host.

A host opening the room sees what a guest opening it directly sees. Renaming it would
have been consistency bought by making a true label vaguer — a false fix. Its eyebrow
"As your guests see it · right now", which the controller had to give up, is true there
for the same reason and also stands. A comment at the call site records this so the
next sweep does not re-open it, and names what to re-measure if it ever changes.

⚠ **`hub-stage.tsx`'s own copy of the label is NOT touched here** — it is already
fixed on `rd/the-controller-shows-the-page` (#5902) and touching it in two open PRs
would be a conflict for nothing.

SPEC IMPACT: None. Copy only. No schema, no price, no route, no locked decision — the
owner-ribbon gate is respected as written, not relaxed.
