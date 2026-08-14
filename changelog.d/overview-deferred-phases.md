## 2026-08-14 · feat(overview): the four deferred council phases — shape-honest widgets, event-type breadth, the day-of takeover, one action list

Closes the deferred rows of `Event_Overview_Council_Verdict_2026-07-12.md` § Build phases (4 · 5 · 6 and the "fold the What's next rail in" row). Phases 1 · 2 · 3 · 7 shipped in July. The design was already decided in that verdict; nothing here re-opens it, and the single hero card is untouched (owner lock 2026-05-22, Headspace pattern).

### RULE 0 — half of Phase 5 was already built, and the brief said it was not

The task brief stated the per-type **plan-group and role maps** "were never built". The plan-group half **ships, is wired and is tested**: `lib/plan-groups-by-event-type.ts` is consumed by the Overview at `fetchPlanGroupScope` (line 617) and `planGroupsForEventType` (line 738), has 8 unit tests, and is backed by real data — **74 of 75** tier-2 `service_categories` rows carry an `applicable_event_types` allow-list in production. Its docblock describes fixing the exact "birthday host told *21 categories still open*" bug the brief attributes to the gap. **Nothing was rebuilt.**

The **role** half was genuinely missing, and that is what landed.

### Phase 4 — the shapes were backwards

The Guests tile drew a `ProgressRing` at `attending / total`; the Budget tile drew a flat bar. A ring is a part-of-whole shape that can only say ONE number, so it folded *declined*, *maybe* and *never replied* into one grey remainder — three states a host acts on completely differently. Committed-against-target, meanwhile, is the one genuinely part-of-whole number on the grid and had the shape that could not hold its own figure.

So they swap. Guests gets a four-state segmented bar with a legend; Budget takes the ring (`ProgressRing` is already an inline-SVG donut — **no new primitive**) with the percentage in the hole.

- Segment arithmetic is pure and tested in `lib/rsvp-segments.ts`: widths total **exactly 100** by largest-remainder apportionment (independent rounding renders as a hairline gap or a clipped final segment on a wide thin element), and a state with even one person in it can **never** render at zero width — a legend claiming "1 declined" beside an invisible segment is worse than no bar.
- **Fail-honest, not fail-pretty:** `GuestStats.total` is counted separately from the four buckets, so a row with a status outside them would make the buckets sum to less. Rather than rescale the bar to fill itself — overstating every segment and hiding the discrepancy — the remainder becomes a visible `unaccounted` segment.
- ⚠ **There is no `--urgent` token in this codebase.** The brief said one was "already reserved"; a grep of `apps/web` returns **zero** occurrences. What sign-off #5 actually reserved was the existing amber `warn` scale, and "no reply yet" uses `--sn-warning` accordingly. A test asserts no segment ever reaches for a gold token, so the hue survives the wine→gold turn.

### Phase 5 — a birthday host was choosing between "Maid of honor" and "Best man"

Eleven of the thirteen host roles are wedding vocabulary; the picker iterated all thirteen for all **16** event types. **2 of the 5 production events are not weddings.** New pure module `lib/host-roles.ts` maps roles per event type and fails **open** (an unknown type gets every role — the cost of offering an odd option is a strange dropdown line, the cost of withholding one is a bride who cannot be recorded as the bride). Four generic roles added: `celebrant` · `parent` · `host` · `co_host`. `ninong`/`ninang` are deliberately **kept for christenings** — they are that event's own principal sponsors, not borrowed wedding words.

🔑 **The dropdown does not decide what is legal — a CHECK constraint does.** `event_moderators.role_subtype` is `text` guarded by a CHECK listing the thirteen. Shipping the new roles in TypeScript alone would have produced an invite the **database rejects**, surfaced to the host as a generic "please try again" and to an engineer as nothing at all — the documented house failure (phantom column · enum value · RPC argument · the un-widened `location_city` CHECK): *rejected, not thrown, and the only symptom is an absence*. Migration `20271141655967` widens it in the same PR, and `tests/db/host-roles-check-constraint.db.test.ts` reads the constraint back and fails **in both directions** if the two lists ever disagree. Verified against production: **0 existing rows** would violate the new constraint.

The vocabulary moved to its own import-free module so it is testable without dragging `event-moderators.ts`'s `server-only` into a unit test — the same split that already put the permission rule in `delegate-areas.ts`. Every existing consumer is unchanged via re-export.

### Phase 6 — the planning stack did not recede

`page.tsx` rendered the prep CTA → the live grid → **the full-weight planning dashboard**. A couple opening this at their own reception got "74% planned" and a nudge to book a caterer whose food they were eating. The dashboard now collapses behind one calm disclosure on the day, with a lead link to the live desk. **Receded, not removed** — the hours before a ceremony are the worst possible moment to hide a vendor's phone number.

🔑 **The verdict names `getLifecyclePhase`; that function was renamed** to `getMenuLifecyclePhase` to end a collision with a *different* function of the old name in `lib/invitation-widgets.ts`. Following the verdict literally would have imported the public-website resolver.

`getMenuLifecyclePhase` gained optional `tz` / `nowMs` and **delegates** to the existing window — the bounds are not restated. Without a zone the anchor is the runtime's midnight (UTC on Vercel), 8 hours out for a Manila event, which now decides whether a couple keeps their vendor list. `events.timezone` is threaded from the page. The stale `T-1h..T+8h` comment there is corrected: the real window is `T-12h..T+36h`.

### The fold — one ranked list, not two

The AI "What's next" rail was a separate horizontal scroller **below** the Decisions board, so the doorstep asked the couple to read two ranked lists and work out which was the real one. Dated items are decisions with a clock on them, so they become a `deadline` group inside the board, urgency-toned by proximity. The de-dup rule holds: every folded item is "only you can resolve" — **inbox is still never a decision**, and unread still lives only on the Conversations tile.

`'deadline'` is listed in **both** order arrays deliberately: `order.indexOf` returns `-1` for an unlisted id, which would sort the group *above* everything else.

### Verification

- **8,054 unit tests pass under `UTC`, `Asia/Manila` and `America/New_York`** — CI runs UTC, the one clock where date-vs-instant mistakes cancel out.
- **Every guard was mutation-tested with occurrence counts printed before → after**, because an unmeasured mutation proves nothing. Disabling drift correction killed 2 tests; removing the min-width guarantee, swallowing the unaccounted remainder, and swapping the amber hue for gold each killed 1; adding a TypeScript role the migration never legalised was caught by the db guard with the exact intended message; making the takeover ignore the venue timezone failed in both UTC and New York.
- Typecheck clean; all 24 CI lint scripts pass (`lint-server-only-boundary` included); ESLint reports **0 errors and no warnings in any touched file**; both required Ugat map db-tests pass.
- ⚠ **Not verified by me:** the rendered pixels. `pnpm build` cannot run on this machine (~7 GB heap), so CI is the only valid build claim, and nobody has yet seen these tiles on a real phone.

### Named, not built

The "promote your coordinator to a host" path still assigns `wedding_planner_external` on every event type. It is vendor-promotion rather than the host picker, it only appears when a coordinator vendor is actually booked, and giving it a generic role is its own product decision — deliberately left rather than widened here.

SPEC IMPACT: `Event_Overview_Council_Verdict_2026-07-12.md` § Build phases — rows 4, 5, 6 and the "fold AI What's next rail" row move from *Deferred* to *Shipped*, with the Phase 5 row corrected to record that the plan-group half already shipped and only the role half was outstanding.
