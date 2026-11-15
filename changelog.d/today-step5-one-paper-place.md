## 2026-11-15 · fix(supplier): Today's step 5 is the one upload place — the three Add rows are retired

The owner found Today › "Send your documents" still drawing three rows (DTI or SEC · BIR 2303 · Business Permit), each with its own Add, after #7624 shipped the one upload place on Your details. Step 5 now renders that same `PaperUploadPlace` (through `SetupPaperPlace`, `app/vendor-dashboard/_components/setup-paper-place.tsx`): one button for all three papers, each ticking Reading… → Recognised, per the approved demo and the 14 Nov "supplier papers demo approved" ruling. It uses the same read (`loadInlineDocs`) and the same save (`updateDocUploadInline`, intent `intake`), so it adds no new server action.

- `setup-papers.tsx` (the three-row `SetupPapers`) is retired, together with its swipe-to-remove test (`a-saved-paper-removes-by-swipe.test.ts`). The one place has no per-paper remove; a new upload replaces a paper. `lib/setup-papers.ts` stays, because `details-data.ts` and the first-steps rail still read paper states from it.
- A refused application read still says "Couldn't load your papers" and never draws an empty place to upload into. A send-back made before 14 Nov (it named no paper) still says its reason once, above the place.
- The Get verified fold's "Go to your papers" still lands on the place, which keeps the `setup-papers` id, and now presses at 46 (`sn-hit`). The "About the documents" ⓘ already presses at 46 through `.sn-dot-btn`'s halo.
- Guards: new `today-step-5-is-the-one-paper-place.test.ts` (step 5 renders `PaperUploadPlace`, never `SetupPapers`; the link lands and presses at 44+; sabotage seen red). `the-papers-and-the-qr-hold.test.ts` § B, `a-send-back-names-only-its-paper`, `three-verification-papers` and the generic-signer roster were re-aimed at the one place.

SPEC IMPACT: None — implements DECISION_LOG 2026-11-14 "supplier papers demo approved" on the screen it had not reached.
