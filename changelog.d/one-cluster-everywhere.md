## 2026-08-15 · fix(shell): one bell and one account menu, on every signed-in surface

Owner, 2026-08-15, two screenshots side by side: *"why does the top nav differ?"*

**Two of the four differences were deliberate. Two were a fallback showing through.**

`FrontDoorShell` renders `topBarSlot ?? <a 🔔 emoji link + a plain initials button>`.
The five signed-in trees each hand in their own cluster, so they got the real one.
**`/` and every `variant="doorway"` page handed in nothing**, so a signed-in visitor
got a placeholder written for a stranger.

🔴 **AND IT COST A REAL THING, NOT A LOOK.** The emoji is a static link — it cannot
carry a count. `UnreadBellBadge` server-renders the unread number and keeps it live
over a realtime subscription. So on `/`, About, Alaala, Explore, Real Stories, the
eight product doorways and the legal chrome, **a person with unread notifications was
shown a bell that could never say so.** The owner's own inbox was full in the very
screenshot that showed the emoji.

⚠ **THE GUARD FILE HAD ALREADY WRITTEN THIS HAZARD DOWN AND DID NOT COVER IT.**
`one-top-bar.test.ts`'s own header says *"a tree that stops passing `topBarSlot` still
renders a perfectly good-looking bar."* It then checked exactly the five trees in its
`TREES` list. 🔑 **The guard was right about the disease and wrong about the patient
list** — the surfaces that were never in the list are precisely where the defect went.

- New `signed-in-cluster.tsx` — **the app's own two components**, same props, same
  fallback (RULE 0: reused, not rebuilt; a second bell would drift within a week).
  Returns `null` signed out, so the public doorway is byte-identical for a stranger.
- `AppRailShell` now defaults `topBarSlot` to it when signed in; a host that hands in
  its own still wins. `/` passes it directly.

✅ **No caching cost, measured not assumed:** `/`, `/about`, `/explore` and `/papic`
already answer `private, no-cache, no-store` with `x-vercel-cache: MISS`. Nothing was
made uncacheable. Both reads are React `cache()`d and shared with the resolver the
rail already calls.

🔒 **THE SEARCH DIFFERENCE IS DELIBERATE AND UNTOUCHED.** On `/` the box searches
suppliers and stories (it is the public shopfront); inside the app it is the palette
over the person's own events. That is the settled 2026-08-14 split and is not
re-litigated here — only the cluster was ever accidental.

🛡 **Two new guards, three mutations, counts printed before → after:**
A) doorway reverted to bare `topBarSlot` 1→0 red · B) `/` cluster removed 1→0 red ·
C) the bell gutted while its import stayed 1→0 red. All restored 21/21 green.
🪤 **Mutation A silently did not apply on its first run** (my pattern dropped
`: undefined`) and would have read as a passing guard — re-targeted against the real
text and re-measured. *An unmeasured mutation proves nothing.*

Neighbouring suites green: `signed-in-can-see-it` 3 · `one-main-per-page` 4 ·
`rail-active` 16 · `front-door-invariants` 19 · `doorway-shell` 16.

SPEC IMPACT: None. Chrome consistency on existing surfaces; no price, SKU, schema or
flag change.
