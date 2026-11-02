## 2026-07-28 · feat(marketplace): the per-service details sheet + customization→inquiry (flag-dark)

Two couple-facing seams on `/v/[slug]` that were open, both behind ONE new flag
`NEXT_PUBLIC_SERVICE_DETAILS_ENABLED` (default OFF — with it off every surface below renders
byte-identically to today and the page runs not one extra query).

**1 · The per-service DETAILS SHEET — the screen slice D handed over unbuilt.**
`changelog.d/marketplace-d-card.md` said it plainly: "Handed over, explicitly NOT built here … the
per-service Details screen, the booked count, and the adaptive card." Two of those three land here,
and **neither needed new data**:

- The sheet renders the SAME `ServiceCard` the gallery already serializes — every showcase photo at
  a readable size instead of a 64px strip, the clip, the WHOLE inclusion list instead of three plus
  a `+N more` tail, the not-included flags, the serves line, price + basis detail + best discount.
- **The booked count is `card.record.bookedCount`**, already fetched by the page's ONE batched
  `fetchServiceCardRecords` call. The sheet mounts the SAME `CardRecordSection` the card mounts —
  no second query, no second formatting of the same numbers.
- The **adaptive card stays unbuilt**, and deliberately: `vendor_completed_events` still has no
  `service_id`, so nothing here presents vendor-level history as service-level.

The card becomes a doorway via a **stretched overlay button**, not a wrapping `<button>` — the card
already contains a `<video controls>`, and an interactive control nested inside a button is invalid
markup that eats the clip's own controls. The overlay is the last child (paints over static content
with no z-index); the clip is lifted with `relative z-10` and stays usable in place. Chrome mirrors
the page family's `RequirementsModal`, with focus/Esc/scroll-lock from the one shared
`useModalA11y`. Deep-linkable via `?service=<public id>` (`vendor_services.public_id`, never the
internal uuid; an unknown value opens nothing).

**2 · "Inquire about this" now means THIS card.** `composerInitial = activeServices[0]` meant a
couple reading the fifth card inquired about the first. The sheet's CTA now points the composer at
the clicked service through a window-event bus (`lib/service-inquiry-focus.ts`) — the pattern
`lib/budget-build.ts` (`BB_TAB_EVENT`) and `lib/cookie-consent.ts` already use, chosen over a React
context because the gallery and the composer are two client islands ~130 lines of server JSX apart.
The composer swaps `initial` / `linked` / `alsoOptions` **and the per-CATEGORY requirement facets +
saved template**, because those are keyed by `canonical_service` — re-pointing without them would
show a photographer's facets on a caterer's inquiry. The bus payload is validated against what the
server serialized, so a forged id can never redirect an inquiry. **`startServiceInquiry` is
untouched by this half.**

**3 · A customized package can now reach an inquiry instead of a payment.** The lock modal's only
CTA was `lockPackage`, a money action; a couple who customized and then hesitated had no other way
out. It gains a secondary **"Ask {vendor} about this build instead"**, which sends their current
selection through the existing inquiry channel.

- 🚨 **No second pricer.** `lib/package-picks-summary.ts` is a pure SERIALIZER: every peso figure in
  the message is a string the couple's own screen printed — the footer's `choiceTotals` total and
  "Upgrades picked", and each option row's `+₱X`. The tests assert each figure against
  `formatCentavosPhp(<the exact input>)`, so an edit that starts summing locally goes red rather
  than shipping a total the vendor reads and the couple never saw.
- 🪞 **The message may not say more than the screen.** An option is annotated **only** where the
  modal annotates it: `+₱delta` when the delta is above zero, and nothing otherwise. A picked
  follow-up (or a second pick on a pick-N line) is by construction a ₱0 option — `isOptionSelectable`
  refuses to offer a priced one there so a preference is *genuinely free* — and the modal shows it
  with no note, so the message must not invite a quote for it either. Pinned from both ends: a
  parity test over deltas, and a source pin on the modal's own option-row condition.
- **The block bounds itself** (2,400 chars, whole lines only, with an explicit "…and N more lines"
  tail). `sendChatMessageCore` rejects a body over 4,000 characters outright, and a long catering
  build could clear that on its own — which would have cost the couple the entire message.
- The block always closes with the estimate line — nothing on this path charges, reserves or
  consumes capacity.
- Gated on the SAME `blockedItemIds` / `!totals` guard as Lock: a package below a line's minimum is
  an **unfinished** order, not a cheaper one, so its total must not be quoted.
- **One threading model.** It calls the same `startServiceInquiry`, deduped on
  `UNIQUE(event_id, vendor_profile_id)`. On a brand-new thread the build rides inside the first
  message next to `buildRequirementsBlock`'s output; on a thread that already has messages the
  "only post the note on a new thread" rule stays (it is what stops re-inquiry double-posting the
  canned note) and the build appends as its own couple-authored message — dropping it would leave
  the couple believing they had sent their picks.
- 🚨 **AND DELIVERY IS REPORTED, NOT ASSUMED.** The build is the only carrier of what the couple
  configured, and it can legitimately fail to post — most sharply when the vendor has not accepted
  and the couple already spent their ONE pre-accept follow-up (`lib/chat-send.ts` accept-gate). That
  gate is deliberate anti-spam and is **not** bypassed here; it is surfaced. The send goes through
  `sendChatMessageCore` (a discriminated result) instead of the `sendChatMessage` action, which
  *throws* for `followup_used`/`declined` and returns *silently* for `contact_blocked` — both
  unusable to a caller that must know whether the message landed. `startServiceInquiry` returns a
  distinct **`ok_build_not_sent`** with a `reason`, and the modal renders a warn-styled "this
  wasn't sent" state carrying that reason's own sentence (for a contact block, the server's own
  teaching copy verbatim) plus a door into the conversation. It never says "your build is in the
  message" when it isn't.
- **The ask target comes from the package's own `primary_canonical_service`**, matched against the
  vendor's active services — with **no `activeServices[0]` fallback**. Filing a hotel's wedding
  package under whatever card happens to be first seeds a wrong `thread_service_interests` row that
  the vendor reads as the couple's stated intent. No anchor match ⇒ no doorway for that package
  (documented at the resolution site): `startServiceInquiry` hard-requires a real vendor-owned
  active service at two separate guards, and none of its three shipped interest sources describes
  "a package", so the alternative was widening a shipped action's invariants for an edge case.

**Two dedups fell out and were taken:** `toSavedRequirements()` (the `event_vendor_preferences` →
pre-fill mapping, now read once per category instead of once) and `leadTierNoteFor()` + a single
`leadTierClock` for the render, so two `new Date()` calls can no longer resolve two different
early-booking rungs on one page.

**⚠ THE SCOUT'S MAP WAS WRONG ON THE SETNAYAN EXCLUSIVE, AND IT IS DELIBERATELY NOT IN THE SHEET.**
The brief said it was "public copy already shown elsewhere on the card". It is neither.
`vendor_services.exclusive_perk_text` is documented **"Never shown publicly. Revealed in-thread when
the vendor token-pursues"** (`lib/vendor-services.ts:64`), and the only thing that renders it is
`revealExclusivePerks` posting a `Setnayan Exclusive unlocked 🎁` system message AFTER the vendor
answers (`lib/chat-actions.ts:518`). It is the reward for the conversation. Printing it on a public
sheet would spend the vendor's incentive before they earn it, so it is absent — with the reason
written into the sheet's header comment so the next session does not "fix" the omission.

**Flag-OFF is byte-identical including the WIRE, not just the DOM.** `publicId` and
`inclusionsFull` are attached by a conditional spread, so with the flag off neither key exists in
the serialized card — a `: []` / `: null` default would have shipped two extra keys per card to
every anonymous visitor and quietly broken the contract this flag advertises.

Verification: `tsc --noEmit` clean · `next lint` no warnings in the 12 touched files ·
`lint:dup-rule` no new duplicated rules · `lint:retired` · `lint:radius` · `lint:entitlement-gates`
· `lint:chat-guard` · `lint:changelog-dir` all pass · `pnpm run test:unit` **5169/5169** green
(36 new cases: pure serializer tests for labels + deltas + totals, the empty selection, removed
lines, a refused pricer, the sanitizer + a JSON round trip; annotation parity across five deltas
plus the free-preference and extra-hours cases; the block budget under the 4,000-char chat cap;
every core rejection code → its reason, and every not-sent sentence asserted never to claim
delivery; the flag's dark-by-default test; and static pins that `ServiceCardView`, the affordance,
the sheet, the focus bus, the lock modal's ask action, the flag-OFF payload shape, the deleted
`activeServices[0]` fallback and the deleted throw-and-swallow send are ALL where they should be).
Production build not run — `npm run build` needs 7 GB and is impossible on this machine.

`lib/package-followup-not-priced.test.ts` caught a real mistake mid-build: the picks summary was
first written with an inline `pkg.items.filter(...)` in the lock modal, which is exactly the second
local definition of "which lines count" that guard exists to stop. The derivation moved into the
tested serializer instead.

SPEC IMPACT: None. No schema change, no migration, no pricing change — the only money figures
involved are strings copied from a screen. Corrects the record on one point for future sessions:
the "per-service Details screen" and the "booked count" items handed over in
`changelog.d/marketplace-d-card.md:81-84` are now built (the **adaptive card** is not, and still
waits on a `service_id` on `vendor_completed_events`).
