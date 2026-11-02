## 2026-10-04 · fix(guest): every chapter on the Event Hub shows — late-mounted sections are revealed, never left invisible

**Incident (owner, on his iPhone: "nothing is showing anything"):** on
`/maria-and-jose` seen through the host's Preview ▾ as "Guest who hasn't
replied", the personal greeting and the "YOUR INVITATION · RSVP for the event"
link stayed at opacity 0. Guests could not get to the reply button.

**Cause:** `PahinaMotionObserver` (`app/[slug]/_components/pahina-motion.tsx`)
attached its IntersectionObserver once, to the chapters that existed when the
inline script ran. The script runs only on a full page load. After that, a
client navigation (Preview "see as", any `<Link>` into the hub), a
`router.refresh()` (the day-of live tick, a reply) or a client-rendered section
adds new chapter nodes, and the script does not run again. `.pahina-js` stays on
`<html>`, which outlives the page, so the CSS kept every new chapter hidden and
nothing ever revealed it. A re-render that rewrote a chapter's `className`
removed a `.pahina-in` it had already been given in the same way.

**Fix (same script, same flag, same contract):**
- Once attached, a MutationObserver on `<body>` (it survives client
  navigations) schedules a sweep on added nodes, `class` changes and `hidden`
  toggles (tab switches). The sweep observes every chapter that does not have
  `.pahina-in`, so a late chapter still gets its fade.
- The same sweep is the safety net. Any chapter that is rendered and whose top
  is in or above the viewport is revealed outright. It runs on scroll and
  resize (at most once every 200ms) and once 1.2s after the attach. A chapter
  below the screen still waits for its fade, and a chapter on a hidden tab
  waits for its tab to open.
- If anything in the sweep throws, it removes `.pahina-js`, so the page is
  shown in full rather than left hidden.

**Guard:** `every-chapter-is-revealed.test.ts` runs the shipped script against
a fake DOM that mounts chapters after the attach. Sabotage: the pre-fix script
fails 10/10; no MutationObserver fails 5; a sweep that never reveals fails 6; a
sweep that does not re-observe fails the regression test.
`the-choreography-waits-for-the-page.test.ts`'s fake now follows the spec
(observing the same element twice does nothing), and its attach-once test
counts observers instead.

SPEC IMPACT: None. This restores the existing fail-visible contract
(design 2026-07-25 §6, build plan ground rule 8); nothing about the product
changes.
