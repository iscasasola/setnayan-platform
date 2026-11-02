## 2026-07-27 · feat(marketplace): Explore Replan PR-D — the three-action bench card + lock-on-bench (flag-dark)

The Marketplace bench card was a link. It is now a card you can **act on**: `＋ Add to build`, a
**stateful** `Inquire` / `💬 Check inquiry`, and `Lock this` — plus locked-vendor names on collapsed
category rows and a rail end that invites the next pick once a category is locked. Everything is
behind `isExploreReplanEnabled()` (`NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED`, default OFF); with the flag
off the card renders as a bare `InspectorTrigger` with no wrapper element and no extra DOM.

**Every leg is a PORT of shipped machinery, not a second copy of it.** That was the whole design
constraint — three parallel implementations of "lock", "inquire" and "pin" is how this surface
would rot.

- **`＋ Add to build`** calls `setBuildPick` / `removeBuildPick` — the same actions
  `AccordionBuildButton` already calls. The hard-single swap rule stays where it lives, server-side
  in `replacesSiblingsOnPin` (`lib/build-pick-rules.ts`); this card never re-decides it.
- **`Lock this`** renders the shipped `AccordionLockButton`, so the hard-single conflict gate, the
  slot picker, the date-lock modal, the reservation-terms gate, the payment-gated downpayment
  modal, the milestone toast and undo all carry unchanged. There is exactly one lock path in this
  app and this is not a new one. Its label is **not** "Lock now — it's final": per the §7 handshake
  amendment a lock is a REQUEST until the vendor accepts the payment, so no customer-facing control
  may promise finality before that step.
- **`Inquire`** renders the shipped `ContactShortlistVendorButton` (→ `contactShortlistVendor` →
  `startServiceInquiry`, deduped on `UNIQUE(event_id, vendor_profile_id)`), which until now was
  rendered from exactly one place — the legacy kill-switch accordion. It gained presentation props
  whose defaults reproduce that call site byte-for-byte.

**The inquiry button is stateful on thread EXISTENCE, and it cost zero new queries.** The spec's
integration contract claimed the guard lives in `InquiryComposer`; the code says otherwise —
`inquiry-composer.tsx` has no guard at all, it is a pure prop consumer. So the composer is
deliberately NOT mounted on a card (it needs seven props the bench doesn't load). Instead the
page's **existing** batched `chat_threads` select gained ONE column (`thread_id`) and threads it
through the pipe that already exists: `VendorEnrichment` → `buildShortlistFolders` →
`ShortlistVendor`. No per-card `.maybeSingle()` probe — a rail holds dozens of cards.

**One predicate, two surfaces, provably identical.** `hasLiveInquiry` is exported from
`lib/shortlist-taxonomy.ts` and `app/v/[slug]/page.tsx` was refactored to call it. Before this,
four divergent "does a thread exist" implementations existed and the bench's did **not** exclude
`declined` — so the same vendor read "💬 Check inquiry" on the bench and "Inquire" on their own
profile. Only the PREDICATE is shared: `/v/[slug]` keeps resolving the couple's **primary** event
(`events[0]`) and the bench keeps its **current** event. Those are different questions and mixing
them is the trap.

**Three gates that each prevent a real defect:**

- The inquiry button gates on `marketplaceVendorId != null`, **never on a manual/source
  heuristic** — `NewManualVendorModal`'s LINKED mode writes a real profile id, so a linked manual
  add IS bookable. An off-platform pick gets no inquiry button at all, because
  `contactShortlistVendor` returns `not_marketplace` and the couple would hit the dead end "This
  vendor can't be messaged here."
- Build + Lock require a resolvable plan group. `planGroupForCategory` returns null for a category
  no group claims, and both `setBuildPick` and `AccordionLockButton` demand a real group id — so
  the card **hides** them rather than passing null. That is the #3466 class of bug. The group is
  resolved from the vendor's **own** stored category (not the tile's), which is the same
  resolution the finalize conflict gate and the budget bucketer key on, so a pin from the bench
  lands in exactly the group Build/Budget read it back from.
- Verification is carried as a **tri-state** (`verifiedState`), not the badge's boolean. Coercing
  unknown→false would client-block a manual vendor from a lock they're entitled to — spec §9:
  manual vendors skip the handshake and lock directly.

**A deviation worth naming.** The shipped rule (owner 2026-06-09) is that only a service the vendor
has priced may enter the build. Applied literally to the bench that would disable the slice's
primary action on nearly every card, and "Waiting for the vendor's price" is a lie on a vendor
you've never contacted. So the card uses the price basis the bench **already** reasons about for
its budget badge — a real quote first, else the marketplace "starts at" — and only when there is no
price signal at all does the CTA degrade to a quiet "Ask for a price to add this to your build",
sitting directly above the Inquire button that gets you one. The rule's intent (never pin a ₱0 row
into the budget) is preserved; its accordion-shaped wording is not.

**Also carried from #3789, which shipped only on the legacy accordion:** collapsed category rows
now name their locked vendors, and the rail-end card reads `＋ Add another {category}` once the
category holds a lock **and** its group allows more — every hard-single group (venue · officiant ·
coordinator · host · LED) stays at "Find more" and never invites a second pick.

**Visuals are the bench's, not the prototype's.** The playable prototype is the BEHAVIOURAL spec;
its emoji, red pills and generic cards are not the design. The action rail lives inside the real
`.slcat` stylesheet using its own `var(--sans)` / `var(--mono)` tokens, gold-deep accent and pill
radii, with Lucide icons. `.vcw` is a new wrapper that takes over the carousel sizing and snap so
`.vc` itself is untouched — coverflow width, hover shadow and the inspector selection ring all
behave exactly as before.

**Handed over, explicitly NOT built here** (spec §16.2, from the Booking session): the per-service
**Details screen**, the **booked count**, and the **adaptive card**. All three need service-level
completed-event data, and `vendor_completed_events` (`20270321252758:160`) has **no `service_id`** —
the package cascade never stamps one. Presenting vendor-level events as service-level would be a
fabricated signal, so they wait for that column rather than shipping a lie.

Verification: `tsc --noEmit` clean · `next lint` no new warnings in touched files · `pnpm run
test:unit` 4697/4697 green (24 new cases in `lib/bench-card-actions.test.ts` covering the shared
predicate, every action-resolution branch, and the rail-end rule across all six hard-single groups)
· production build green.

SPEC IMPACT: Corrects `Integration_Contract_Booking_x_Explore_2026-07-27.md` §2 — the stateful
Inquire guard does NOT live in `InquiryComposer` (no guard exists there), and contract §2 line 28
("manual-added vendors with no thread keep 'Inquire' on the bench") is wrong and is deleted: a null
`marketplace_vendor_id` dead-ends. Both corrections are already recorded in
`Explore_Replan_BUILD_SPEC_2026-07-27.md` §12.1. No SKU, price, or money-path change; no migration.
