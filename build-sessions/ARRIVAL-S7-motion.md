# ARRIVAL S7 — the whole Event Hub moves, and every movement means something

**Model:** Opus 5 · **Effort:** high · **Open a NEW session and paste ARRIVAL-COMMON.md first, then this.**
**When to start:** after #5796 (the pass) and #5799 (no NFC) have MERGED. Both touch the page
you will animate.

Owner, 2026-09-21: *"make the whole event hub fully animated."*

## What ships today — find it before you add anything
· **24 files** under `app/[slug]/` already handle `prefers-reduced-motion`. Read how they do it and
  use the SAME mechanism; a second one is the defect.
· `lib/monogram-motion.ts` — the monogram already draws itself (`monogram_motion_key`).
· `app/[slug]/_components/reveal/` — the wax-seal reveal overlay on the way in.
· The living hero and the Save-the-Date film.
· `lib/the-walk-turns-and-yields-to-reduced-motion.test.ts` — a guard shape to copy.
There is no animation library in `package.json`. Adding one is a decision to surface, not to make
quietly: CSS transitions plus one small client observer may be all this needs.

## The delta: motion that tells the guest something
Each of these is one movement with one job:
1. **Arrival** — the mark draws in (reuse monogram-motion), then the names, then the one action.
   In that order, once, on first paint. Not on every return visit.
2. **Sections** — rise and fade in once as they enter the viewport. Never again after that.
3. **The action label** — when a reply changes it ("RSVP" → "You're going"), the words cross-fade
   in place so the guest sees their answer land.
4. **Sheets** — the RSVP and everything-else sheets slide up from the bottom and settle; closing
   reverses it.
5. **The pass** — opening it brightens the ground and lifts the card, so it reads as the thing to
   show at the door.
6. **The day** — "happening now" gets one quiet pulse on its dot. Nothing else loops.

## The rules that keep it from becoming noise
· **One motion token set** — durations and easings in ONE module, imported everywhere. The research
  on the best event sites found restraint is what reads as premium: two durations, one easing.
· **`prefers-reduced-motion` turns every one of these off**, and the page must be complete without
  them. A test executes both states.
· **Nothing moves while it is being read.** No looping text, no parallax on body copy, no motion on
  the schedule, the address, the dress code or the pass's facts once they are on screen.
· **Motion never gates content.** If JavaScript fails, everything is already visible — animate FROM
  a visible state, never TO it.
· **No new fixed chrome.** `GuestHubBar` was retired for covering the menu.

## Fence
A new `lib/motion.ts` (the tokens + the pure "should this animate" decision), one small client
observer component, and the minimum class changes on the six surfaces above. Do not restyle
anything; do not touch copy.

## Handback
The PR number, the list of the six movements with where each lives, proof that reduced-motion turns
them all off, and what you could not verify on a real phone.
