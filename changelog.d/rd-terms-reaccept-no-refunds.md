## 2026-10-25 · feat(terms): every account re-agrees once to the no-refunds Terms

Owner 2026-10-25, verbatim "Yes" to: *"after the no-refunds change, should everyone re-agree to the Terms once on
next login?"* On 2026-10-23 the Terms' refund line changed from "a full refund whenever we fail to deliver" to
"purchases are not refunded, and a paid service you cannot use becomes Papic credits" (#8bec5bd31c), but `/terms`
kept `Effective 2026-06-30`, so `TERMS_VERSION` never moved and nobody was asked.

Extends the shipped re-ask (#6001, `users.terms_accepted_at` + `terms_version`, `needsTermsAgreement`). No migration.

- `TERMS_VERSION` 2026-06-30 → **2026-10-23**; `/terms` now reads `Effective 2026-10-23 · last updated 2026-10-25`
  (the guard tying the two is unchanged).
- `needsTermsAgreement` asks by **version**, not account age: an older `terms_version`, or none, is asked once;
  a new sign-up records the current version and is never asked. Fails open on a failed read or an unselected column.
- One sheet (house `Sheet` + `OverlayBackdrop` + `ActionButton`) over the page, mounted by the couple, supplier and
  admin layouts — never a guest page: "Our Terms have changed" ⓘ · "What you buy from Setnayan is no longer
  refunded." · Read the Terms · **I agree**. The agreement is built inside the press (no hidden field); the save is
  server-side with a timestamp, own row only, never re-dates a current agreement; a failed save says so with Retry.
  Replaces the dashboard's full-page "One quick thing" screen; moved to `app/_components/terms-reaccept/`.
- Guard: `lib/terms-reaccept.test.ts` (8 tests, each sabotaged once → red).

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-25 (the ruling, verbatim). Owner sign-off flagged: the one-line summary
wording, and moving the Terms' effective date to 2026-10-23.
