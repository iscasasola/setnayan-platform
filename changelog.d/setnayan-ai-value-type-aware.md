## 2026-07-29 · fix(setnayan-ai): the capability list is per event type — it was promising Pre-Cana tracking on a birthday

`SetnayanAiValue` renders the nine "what Setnayan AI keeps for you" capabilities on the studio surface. Its `GROUPS` was a **static const written for weddings**; `eventWord` templated only the two closing sentences, so every capability *body* stayed frozen wedding prose. Three were outright false on any other event type:

| Said | On a… |
|---|---|
| "your **PH marriage paperwork** — license, Pre-Cana, PSA" | birthday |
| "when another **couple** starts looking at a vendor" | corporate event |
| "distance to your **reception**" | tournament |

Harmless while the surface was wedding-only. It stops being harmless the moment this component is mounted in the onboarding of all 15 vendor-bearing types — which is exactly what it's being reused for (`Onboarding_Papic_AI_Cards_BUILD_SPEC_2026-07-27.md` §1.4/§2.3), and why this lands first.

A capability list is a **promise**. The component is built to the standing "no fake doors" rule — dormant guards are deliberately excluded from it — and promising Pre-Cana on a birthday breaks that rule just as surely as a dead button would.

**Derived, never named by type.** The paperwork clause keys off `EventTypeProfile.statutoryPackKey` — the column that already encodes this: `'ph_marriage'` on wedding, **NULL on all 12 other seeded types** (verified in prod). The organizer noun comes from `terminology.organizerNoun`. There is no `=== 'wedding'` anywhere, so a future statutory type inherits the clause by setting its pack key, and a future vendor-bearing type gets correct prose for free. Same house pattern as `lib/papic-event-access.ts:154` — *"this is how `simple_event` is excluded, for the right reason, not by name."*

The page previously derived its one word from a hardcoded `eventType === 'wedding' ? 'wedding' : 'event'` ternary; it now reads the profile.

**Structure.** Copy moved to a pure, string-only `setnayan-ai-value-copy.ts` (no React, no icons, no I/O) so the promises are asserted directly in a unit test. The component keeps only what can't be a string — icon and live-figure maps, keyed by **stable capability id** rather than by title, since a title is copy and copy moves.

**Two deliberate calls on the wedding copy itself:**

- *"your reception" → "your venue".* True for every type including a wedding, whose reception *is* the anchor venue. Coupling reception-ness to the statutory flag would have been semantically wrong — they're unrelated facts.
- *"faith" stays, for every type.* It was briefly dropped as a wedding-ism; that was wrong. `faithFit` is a real weighted dimension in the matcher (0.07, a lift for a vendor declaring the ceremony/faith) and it is not wedding-only — a christening ranks on it too. Listing an input that scores NEUTRAL when your event declares no faith is not a false promise, whereas dropping it would **under-claim a running capability** — the same rule broken from the other direction.

**Tests (9 new).** Beyond the specific three fixes, two generic drift guards: one builds the copy for a type with no wedding traits and asserts none of the wedding vocabulary (`couple`, `wedding`, `bride`, `groom`, `reception`, `pre-cana`) survives — catching the whole class rather than today's three instances; the other pins `CAP_ICON` to the authored ids, since a capability without an icon renders `undefined` as a JSX tag and crashes the surface. Also asserts the non-wedding deadline row still promises something real (booking windows) rather than becoming a stub, with no orphaned punctuation from the removed clause.

Verified: typecheck 0 · `next lint` 0 errors · unit **5277/5277**. No migration, no schema change. Wedding behaviour unchanged apart from the two copy calls above.

SPEC IMPACT: None. No SKU, price, or capability changes — this stops three of the nine existing capability descriptions from lying on 12 of the 13 event types.
