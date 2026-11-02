## 2026-07-31 · Alaala absorbs the Memories Hub, and "saved vendors" stops being a promise nobody kept

Owner, looking at the live home: *"the memories hub is still not integrated"* · *"ala ala is not fixed"* · *"people still not fixed."*

He was right on all three, and the third was the worst.

### Two names for one idea

`Alaala` is the single memory dimension — that is the whole point of the four-surface model, and **Memories Hub is its old name**. The home rendered both: the Alaala tile, and directly beneath it a **peer** row titled "Memories Hub". Same idea, twice, side by side, so neither read as the answer to "where are my photos?"

The row is now Alaala's own content — **"Photos & videos · Every album, across every event"**. Same panel, same data, one brand.

### The subtitle was advertising something that isn't there

It read **"Photos · videos · saved vendors"**. The panel renders `PhotosTab`, which contains **zero** vendor code — `grep -ci vendor` returns **0**. The third item was never shown, on any account, in any state.

Saved vendors do exist — as a **tab on `/dashboard/library`** (`?tab=vendors`), rendered by `VendorsTab`. The home just never inlined it while naming it.

So they now sit where the owner put them (*"saved vendors can be with the group of your shop, hq, and creators lab, and favorite vendors"*): **in Spaces**, beside the shops and consoles, as a real link to the tab that actually renders them. The Alaala row now names only what it contains.

### What this does NOT fix — stated plainly

**"People still not fixed" is only half-addressed here.** People is a *lens inside* the Alaala tile (Recent · Owned · Attended · **People** · With me), and my earlier pill nav added a phone door — but there is still **no rendered People block** on the desktop home. The only other reference in `page.tsx` is a ⌘K palette entry, and a palette entry is not a doorway (`Route_Wayfinding_Audit_2026-07-15`). A People surface on the home is a design decision about what it should *show* — 1° connections, alaga, samahan co-members — not a rename, so it is not bundled into a consolidation PR. It stays on the list.

### Verified

**5,790 unit tests, 0 failures.** `tsc` clean · `next lint` clean. `LayoutGrid` dropped — it became an unused import once the row was retitled.

⚠ Note for the next session: `tsc` OOM'd at the default heap on this tree (exit 134). `NODE_OPTIONS="--max-old-space-size=8192"` is now needed locally — the repo is close to the ceiling that already makes `next build` impossible here.

SPEC IMPACT: None. No data, pricing or entitlement change — naming, placement, and one link that now points at real content.
