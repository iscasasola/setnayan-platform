## 2026-07-26 · feat(vendors): specialization entitlement gate — generic kit is the floor, specializations are the paid layer

Implements the owner lock of 2026-07-26: *"specializations work only if they are
subscribed. if no subscription, stay as generic vendors."*

Ships the reusable CAPABILITY, not the surfaces — the thing the song desk, the
MC script/cues desk, and the coordinator's floor-command kit will each ask.

**New — `apps/web/lib/vendor-specialization-gate.ts` (pure, no I/O).**
`resolveVendorSpecializationAccess({ subscription, services, eventTiles })`
answers "does this vendor get their category's specializations?" and returns a
small model: `genericKit` (typed as the literal `true`), `unlockedSet` (the
entitlement), `eligibleSet` (upsell copy only), and a `reason`. Three sets keyed
to canonical taxonomy tiles — `song_desk` (reuses `MUSIC_CANONICALS` from
`lib/songs.ts` so the two can't drift), `stage_script` (`host_mc`),
`floor_command` (`coordinator`). Multi-set vendors resolve deterministically by
registry order, and optional `eventTiles` narrows to the role actually booked —
both mirroring `resolveDayOfFamily` in `lib/vendor-dayof-modules.ts`.

**The tier floor is ONE constant.** `SPECIALIZATION_MIN_TIER`, defaulted to
`'solo'` (any paid tier). ⚠ **Open owner decision, not a ruling** — Solo-and-up
vs Pro-and-up is still unsettled; moving it is a one-line change with no other
edits. Default reasoning is in the constant's doc block: specializations are what
make a solo emcee or small band useful at all, while Pro-and-up is already where
cross-event *intelligence* (Market Intel) sits.

**New — `apps/web/lib/vendor-specialization-gate.server.ts`.** Reuses the
existing resolver `resolveVendorTier` (`lib/vendor-feature-gate.ts`), so the gate
inherits the admin free-window tier promotion for free, plus one narrow
`tier_state, tier_expires_at` read for the explicit lapse check (lapse is
login-driven, so a past-due vendor can still carry a paid `tier_state`). A live
promotion beats a stale expiry. **No new table, no new column, no migration.**

**Degrades to the generic kit, never to empty or error** — an explicit owner
requirement. Null subscription, lapsed subscription, unknown/misspelled category,
junk inside `services[]`, unrecognised tier string: every path grants the generic
kit. `genericKit: true` is a literal type, so a future edit that tries to deny it
fails `tsc`.

**Not wired to any surface — deliberately.** Free-during-launch is active and
every vendor in prod is on a free tier, so enforcing this anywhere today would
take away tooling vendors currently have. Ships as capability + tests only,
following the `#3764` owner-gate precedent (shipped inert, consumed later). No
behaviour changes for any vendor.

Tests: `apps/web/lib/vendor-specialization-gate.test.ts` — 24 cases covering no
subscription, each paid tier at/above the floor, tiers below it, lapse mid-event,
unknown categories, junk input, category mapping, event-tile narrowing, registry
integrity, and a direct proof that moving the floor constant flips the outcome.

SPEC IMPACT: None. Records an owner decision already logged in the corpus
`DECISION_LOG.md` (2026-07-26 specialization lock); no pricing, SKU, or schema
claim changes. The Solo-vs-Pro floor remains an open owner question and is
flagged as such in code rather than being written into the corpus as settled.
