## 2026-10-02 · fix(event-types): P6a follow-up — the misses the audit of #6249 found

- The seat-plan pack's table signs say the event's own word ("Scan to visit our birthday", "this gathering" for a wake) instead of "our wedding" for every type. `lib/print-seating-pack.ts` is left to P1b.
- Rite readers that kept only the primary column now read BOTH rite columns: the dress-code editor's INC prefill and the guest card's INC wedding flag. The sponsors page's Muslim redirect stays primary-only on purpose (`lib/chinese-wedding.ts` names it as the one check that must not read both).
- `CEREMONY_TYPE_READABLE_LABEL` covers all 18 rites (derived from the faith registry + Civil · Mixed); the "your wedding is now …" chips no longer print a raw key like `born_again`.
- A nameless event is titled in its own words in the Kwento magazine PDF and the emcee script header (`untitledEventName`), never "The Wedding" on a birthday. A wedding is byte-identical.
- Guards: extended `the-wedding-words-stay-at-weddings.test.ts` and `wedding-religion-reaches-the-day.test.ts` (each sabotaged once). Dropped the deleted `unlock-categories-list.tsx` from the first guard's file list after merging #6249 onto the train.

SPEC IMPACT: None
