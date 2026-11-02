## 2026-10-19 · fix(privacy): the policy no longer calls the connection tree a "limited pilot"

Owner ruling 2026-10-19 (corpus DECISION_LOG "TWO MORE RECOMMENDATIONS APPROVED"): remove "limited pilot" from /privacy, wording only. App Review 2.2 reads a pilot/beta as an unfinished app.

Wording-only, in /privacy's connection-tree section: the heading drops "(limited pilot)"; "Setnayan is piloting a connection tree" → "Setnayan offers a connection tree"; "During the pilot a connection can only be stored when both…" → "For now, a connection can only be stored when both…" (the restriction stays explicitly current, not permanent); "This feature is a limited pilot while our filing with the National Privacy Commission is being completed. We have kept it deliberately narrow for that reason — …" → "We have kept this feature deliberately narrow while our filing with the National Privacy Commission is being completed — …". Every promise is unchanged: both-parties-only, consent before anything counts, the retention period (still rendered from `CONNECTION_REQUEST_RETENTION_DAYS`), deletion rights, the NPC filing. The "last updated" date is not moved — the file's history moves it only for changes of substance (2026-09-14/15), not for wording passes (2026-09-22, 09-29, 09-30, 10-02).

/terms, /refunds, /acceptable-use, /cookies and /privacy/google-access carried no pilot/beta wording. "Vendor" wording on the legal pages is left alone (owner: legal wording pending review).

Guard: `app/(shell)/the-legal-pages-describe-a-live-service.test.ts` — no reader-visible string (via `copyStrings`) on any page rendered through `LegalLayout`, any `POLICY_LINKS` page, or /refunds says pilot/beta. Sabotage: the unfixed /privacy → 4 hits; "Setnayan is in beta." written into /terms → fails naming terms/page.tsx.

SPEC IMPACT: None — implements the 2026-10-19 DECISION_LOG row as written.
