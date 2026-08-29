## 2026-08-29 · feat(event-hub): the cinematic reveal also plays over the invitation

Owner: *"event hub should also have the cinematic reveal."* **"Also" is an
addition, not a move** — the save-the-date keeps its opening.

🔴 **WHAT IT WAS, and it is one line.** The five cinematic openings — the veil,
the flaps, the church doors — already rendered on the Event Hub. They were gated
by `revealEnabled: showSaveTheDate`, so they only ever played while the event was
still far enough out to sit in its save-the-date window. **The moment the page
became the invitation, the reveal stopped forever — which is the moment most
guests actually open the link.** A couple who bought Event Hub PRO paid for an
opening nearly none of their guests would ever meet.

⛔ **The day itself and the story afterwards are deliberately excluded** (owner
ruling, not an oversight): on the day a guest is opening this to find their
table, and a veil between them and a table number at the venue is a toll gate.
The editorial phase has its own cover. It still replays on every visit — owner
chose that over once-per-guest, so there is no new storage.

🔒 **`mayShowStdFilm` IS NOW LOAD-BEARING IN A WAY IT WAS NOT BEFORE — this is
the whole risk of the change.** A wake was previously excluded **twice**: it
never ENTERS the save_the_date phase (gated on the solemn register) *and* its
profile has no `save_the_date` surface. **A wake does reach the invitation**, so
the first protection is gone here and the surface flag is the entire fence.
`wedding-only-parts.ts` already defines that part as *"The Save-the-Date
cinematic film AND ITS FIVE REVEAL OPENINGS"* — one part — so this applies the
existing rule rather than inventing a second one.
⚖ **Measured against prod:** of the 17 event-type profiles, **only `wedding`
carries the `save_the_date` surface**. So this reaches weddings today, and a
funeral can never get a cinematic veil over its invitation.

⚠ **Two neighbouring claims were CORRECTED rather than left to rot:**
- `reveal-overlay-server.tsx` said the ownership read *"fires ONLY in the
  Save-the-Date phase … zero extra queries on the common paths"*. That is now
  false — the invitation is the busiest stage, and `eventSkuActive` is a chain
  (order → bundles → basket → promo → comp → internal host → founder seat) that
  runs to the end for an event owning nothing. Wrapped in React `cache()`,
  matching the pattern `fetchRevealConfig` already uses in the same module.
- The background-music comment cited the 2026-06-19 "the film owns audio"
  ruling. It is **deliberately NOT widened** to the reveal: the veil (z-60) sits
  above the floating speaker (z-50) so it is hidden until the veil lifts, and
  the music never autoplays. Widening it would silence a paid Event Hub PRO
  feature for the whole invitation phase to solve a clash that cannot happen.

Guards: `lib/the-reveal-reaches-the-invitation.test.ts` (6) derives the wake
protection from the **real** `WAKE_PROFILE` through the **real**
`resolveWeddingOnlyParts`, never a hand-typed `false` — a fixture would keep
passing after somebody enabled the surface on wakes. The golden phase matrix in
`site-body-plan.test.ts` gains the no-film case. **4 mutations, each landed by
occurrence count, all RED** (revert · widen to the day · drop the fence · give a
wake the surface).

🪤 The first mutation run printed **nothing at all** and I nearly read it as a
pass — two test paths in a shell variable expanded to an invocation that matched
nothing. *A run that reports no counts is not a green run.*

SPEC IMPACT: `DECISION_LOG.md` — the reveal's stage scope, and the two exclusions
as owner rulings.
