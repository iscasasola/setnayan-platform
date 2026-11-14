## 2026-11-14 · refactor(help): split lib/help.ts into one file per answer-writing session — no word moved

The 378 missing Help answers will be written by eight sessions in parallel (H1–H8), so the corpus now lives in files each session can own without conflicts:

- `apps/web/lib/help/topics-existing.ts` — the 16 existing topics, word for word, same order (about-setnayan stays first for the FAQPage JSON-LD).
- Empty slots, each `HelpTopic[]` with its area map in its header: `lib/help/supplier-1.ts` (S1–S9, S22) · `supplier-2.ts` (S10–S21) · `user-1.ts` (U1–U11) · `user-2.ts` (U12–U18, U21–U24) · `user-3.ts` (U19, U20, U25–U30, U32, U36, U37) · `user-4.ts` (U31, U33–U35, UG1–UG10).
- Admin slots behind the existing wall: `lib/help-admin/admin-1.ts` (A1–A17) · `admin-2.ts` (A18–A28), imported only by `lib/help-admin.ts`, never by `lib/help.ts`.
- `lib/help.ts` keeps the types and helpers and concatenates `topics-existing` then the slots; `HELP_NOT_IN_THE_APP` moved to `lib/help/not-in-the-app.ts` (re-exported) so the topic files need no import cycle.

Proof of zero text change: `apps/web/scripts/help-corpus-digest.ts` fingerprints every public topic/article (body + appBody), the iPhone-app view, the flat order, the role cards, HELP_LASTMOD and the admin topics — same sha256 on origin/main and on this branch.

Guards: 15 guards that read help prose as raw text from `lib/help.ts` (or `lib/help-admin.ts`) now read every file via `lib/help-sources.test-helper.ts` (computed from the directory, so a slot added later is scanned with no guard edit) — each was sabotage-checked red with a planted word in an empty slot, or a removed phrase for the guards that require one. The B3 admin wall gains a test that only `lib/help-admin.ts` imports `lib/help-admin/*`. The guest-path "no Maybe" guard now checks every RSVP line, not the first. New `lib/help-slugs-are-unique.test.ts`: slugs and topic keys unique across public + admin files.

SPEC IMPACT: None.
