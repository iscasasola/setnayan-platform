# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-04 · fix(guest-site): the veil stops covering the whole website, and Papic joins the menu

Both caught by the owner on his own phone, neither by any check.

### 1 · The Save-the-Date reveal belongs to the Save-the-Date

Owner: *"the save the date reveal only stays on the save the date and not the rest of the website."* Rose petals were falling across the dress code, the schedule and everything else.

**It was not a bug — it was an owner ruling colliding with a newer one.** `reveal-overlay.tsx` says so outright: *"The veil is a PERSISTENT top layer, not a one-shot gate… we never fade it out / unmount it"*, citing **2026-06-18 "reveal stays on top, not under"** and **2026-06-19 "I still want the veil accessible but also want to navigate the messages."** Both were exactly right **when the film WAS the whole page** — a curtain permanently over a film is one experience, and the top valance is how you pull it back down.

Then the film handoff put the browsable **site** under that same `z-60` layer, and a decision about the Save-the-Date silently became a decision about the entire website.

**The veil now retires when the visitor steps out to the site, and returns with "Watch our film again."** Both June rulings survive — it stays on top for exactly as long as the film is the experience — and it is never unmounted on lift, which would have deleted the re-cover gesture and degraded the **paid** cinematic opening.

The exit/return event names are **imported, never re-typed**: a hand-copied name drifts silently and the veil simply stops standing down, with nothing failing.

### 2 · Papic is in the menu

Owner: *"the papic button and gallery? why does the menu looks different from our plan?"* — a fair question with an uncomfortable answer: the nav rules shipped in #4074 were **never connected**. The live bar was the old five-anchor list, which has no camera slot at all.

The camera now sits in the **middle** of the bar — the widest, easiest place for a thumb, because on the day shooting is what people are actually doing — in **both** the anonymous and guest trees. A guest gets their own roll; the public gets the couple's shared camera.

**And a closed camera is DRAWN AND LOCKED, never absent.** An absent slot tells a guest the wedding has no camera; a dead button tells them the app is broken. Locked, with the reason, tells them the truth: the host has not opened it yet.

Verified: 6,339/6,339 unit tests, `tsc --noEmit` clean, guest-legibility clean. Mutation-verified — removing the veil's retirement fails its test. No migration, no flag.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-04. The full role/phase resolver (#4074) is still unmounted; this connects the camera slot only.
