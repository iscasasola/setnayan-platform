## 2026-08-22 · fix(board): pressing an Untold celebration opens its story

Owner, pointing at the Untold shelf: *"this will be the ones to go straight to
the story maker… we want that gone and directly jumps to the story maker upon
pressing each untold event."*

The shelf carried TWO controls for one celebration: the card (which opened the
event dashboard) and a separate **"Write the story of X"** chip below the grid
(which opened the story page). The chip was the one that mattered and the card
was the one people press. The chip is retired; the card does the job.

- `GlassEventCard` and `MobileEventChip` take an optional `storyHref`. The CALLER
  decides when — `storiesMeasured && canWriteStoryFor(event)`, the exact pair the
  retired chip was gated on — so a guest, or a board whose story read was
  refused, keeps the ordinary card → event-dashboard behaviour.
- `resolvedHref = storyHref ?? href`. The shared `deriveEventView` derivation is
  untouched and is still the fallback, so an invited guest with no public page
  still gets an inert card rather than a dead link.
- Both renderings are wired — the phone's two-up chips and the desktop grid. A
  guard now counts the override at exactly 2: a fix wired into one of them opens
  correctly on a laptop and wrongly on the phone it was shown on.

🪤 **A GUARD WAS PASSING ON A LINK NOTHING RENDERS, and removing the chip
exposed it.** `the-controls-have-a-home` asserted Your Story stays reachable by
checking two things about the BOARD: that a "Write the story of <name>" chip
existed, and that the board contained `href="/dashboard/creator"`. Both premises
were dead — the chip never led there (it opened the celebration's own story page
after 2026-08-22), and the board's only remaining `/dashboard/creator` string
sits inside `BecomeStorytellerRow`, **a component with zero call sites anywhere
in the app**. The guard now checks the door that actually renders: the account
switcher's link AND that the switcher is mounted on the board's own layout.
Both halves mutation-proved.

🪤 **A second guard was loosened by the change and is now TIGHTER, not weaker.**
`the finished cards are gated by NOTHING except emptiness` allowed a second
condition (`storiesMeasured`) because the chip sat behind it. With the chip gone
the branch is gone, so the assertion drops to `['unwritten.length === 0']` and
adds an explicit refusal of any `storiesMeasured ? (…)` branch inside the shelf —
whatever it wrapped, a failed read would make it vanish.

- 5 assertions mutation-checked by occurrence count, each red: mobile override
  dropped (1→0) · `canWriteStoryFor` guard dropped (3→2) · fallback broken (2→1) ·
  switcher link removed (1→0) · switcher unmounted (1→0).
- Full unit suite 9474 pass, 0 fail. Port baseline regenerated: 404 routes, none
  dropped, **exactly one** entry removed — the board's literal editorial href,
  which now lives in a prop the generator cannot see and is pinned instead by the
  dedicated test above.

SPEC IMPACT: None — no price, SKU or locked decision moves.
