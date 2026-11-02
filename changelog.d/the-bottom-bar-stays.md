## 2026-08-23 · fix(home): the bottom bar stops vanishing the moment you use it

- **The phone thumb bar disappeared when you pressed anything on it.** `HomePillNav` was rendered
  in exactly ONE place — `(launcher)/page.tsx`, i.e. the single route `/dashboard` — while three of
  its four targets (People · Memories · Create) live in the `(account)` group. Every one of them
  landed on a screen with no bottom bar. It is now rendered by the two LAYOUTS that cover those
  destinations, from the switcher data both already load, so the capability-gated fifth slot costs
  no new query. Deliberately NOT pushed into the shared `AppRailShell`: the event and supplier
  trees share it and carry their own phone bottom nav, and a second bar under the first is a worse
  bug than the missing one.
- **Which made the active state a real question.** It was a server component with
  `aria-current="page"` hardcoded on Home — true while Home was the only route it appeared on, a
  lie on every other. It reads the pathname now: Home matches exactly, the spokes match their own
  subtree so a deeper page still shows you where you are.
- **Four dead components deleted** — `SpaceRow` · `CreateSamahanRow` · `OpenShopRow` ·
  `BecomeStorytellerRow`, the remains of the "Yours to run" tile the owner removed on 2026-08-19.
  ZERO call sites app-wide, measured with test files excluded. No door is lost: every destination
  they carried is on the account switcher, and that was checked, not assumed. The port baseline is
  regenerated and its diff is exactly two removed destinations, both verified reachable elsewhere.
- **A third guard was passing on that dead code.**
  `app/_components/frontdoor/rail-carries-what-you-run.test.ts` asserted that the launcher page
  contains `href="/dashboard/creator"` — and the only such string in the file lived inside
  `BecomeStorytellerRow`, which nothing mounted. Deleting the component is what turned it red. It
  is repointed at the account switcher, the same correction its sibling
  `lib/the-controls-have-a-home.test.ts` received on 2026-08-19, and it still holds the property
  that matters: writing is open to every signed-in person, so the door must not be
  capability-gated.
- **The FAB's action is recorded as settled** rather than awaiting an owner it was never going to
  reach.

🪤 **The trap this item is named for, reproduced deliberately.** A naive `grep -rn '<OpenShopRow'
app` returns ONE hit, and it is inside a guard's own regex — the assertion contains the component
name it is looking for. The new sweep excludes test files and is floored (`files.length > 500`) so
an empty sweep cannot pass in silence.

⏭ **AP-6 ("no name is cut to Y… on a phone") is NOT fixed and is not silently dropped.** Every
truncating block in the launcher was read: each one is either a block-level `<p>` inside a padded
card or a flex child with `min-w-0`, and none can collapse to a single character at 375px. The
finding came from a signed-in phone screenshot, which is not reproducible from a session — and the
brief itself records that this stream once nearly filed a false nav finding off a DOM probe. What
would settle it: the screenshot, or the surface name and the text that was cut.

10 sabotages, every one measured by occurrence count before → after, all red. 9,513 unit tests
green under `Asia/Manila`.

SPEC IMPACT: None. No migration, no schema, no price or SKU change.
