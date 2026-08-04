## 2026-08-04 · feat(guest-site): the bottom bar now renders what the rules resolved — the component decides nothing

The last step of the event-site menu work. `resolveSiteNav` — the per-viewer rules the owner steered through five rounds — had **zero production consumers**: it was written, tested, and the live bar kept its own parallel logic. That split let the two disagree **twice in two days**, invisibly, because each half passed its own tests.

**`SiteMenuBar` now takes `slots: NavSlot[]` and settles nothing** — not which tabs exist, not where they point, not whether one is locked. Both mounts (the anonymous tree and the guest tree) resolve from the same call, so they cannot drift into disagreeing about what moment it is.

**The one decision the component keeps is LAYOUT:** it pulls the camera out and re-inserts it at the centre. That is where the owner put it — the widest, easiest place for a thumb, because on the day taking pictures is what people are actually doing. Position is not permission.

### ⚠ Three things guests will actually see differently

Flagging these because they are **behaviour changes, not refactoring** — they are the designed rules finally taking effect:

1. **Home renames itself.** `Home` before the wedding → **`Now`** on the day → **`Recap`** after. The bar previously said "Home" always.
2. **Details and Story drop out on the wedding day.** Once it is happening, a guest needs Now / Watch / Camera / Gallery — and the bar holds five. They return in the "after" phase only as the resolver dictates.
3. **A slot whose destination could not be built now LOCKS** rather than pointing at `#`. The dead button the bar exists to avoid.

### The lock rule moved from two copies to one

The "camera closed ⇒ drawn and locked, never absent" rule used to be re-typed at each mount. It now lives once, in the resolver. That is the point of the move: one rule, not two copies that can drift — which is exactly how the camera came to vanish instead of locking.

### The design tests were re-pointed, never weakened

Six of them broke, because they pin the owner's decisions by scanning source text and the mechanism moved. **Every decision they encode survives** — icon *and* label on every slot, labels that can never wrap, the home-indicator strip, Watch owning its own slot rather than the gallery's, a closed camera drawn-and-locked with its reason, the camera gated on the host's switch and never the calendar, Papic in the middle. Each assertion now points at wherever the decision now lives; several are now pinned in **two** places (the resolver *and* the bar) rather than one.

`SiteMenuTabKey` / `siteMenuTabs` remain for `SITE_MENU_ANCHORS`, which still supplies the in-page anchor markers, and the vocabulary guard added earlier today keeps the two modules speaking the same words.

Verified: 6440/6440 unit tests, `tsc --noEmit` clean, lint clean. No migration, no new flag — still mounted only where `siteMenuEnabled` (today, the sample event).

SPEC IMPACT: None new — this completes the bar recorded in `DECISION_LOG.md` 2026-08-03, and closes the follow-up that entry named.
