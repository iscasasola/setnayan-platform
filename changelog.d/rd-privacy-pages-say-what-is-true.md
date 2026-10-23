## 2026-10-23 · fix(legal): /privacy, /cookies and /terms say what the code does (DRAFT · the DPO approves the words)

The DPO's 2026-10-22 pack measured the public pages against the shipped code. This PR changes the copy only, plus the guard and the admin pack:

- **Added to /privacy and /cookies:** the daily Visits count (no cookie, a code mixed with a value that changes daily, deleted the next day, raw IP never stored). Also added to /privacy: Sign in with Apple, Apple in-app purchase ("when available in the app"), the 12-hour selfie and face-vector erase with its separate tick, and Pabuya gift records.
- **Promises removed or corrected:**
  - The "30–90 day tail" (/privacy) and "30 days" (/terms) are replaced by the real flow: a request, reviewed within 24 hours, then the personal fields are blanked and the records the law makes us keep stay.
  - Support tickets at 2 years, device records pruned at 24 months, and "device hash deleted with the account and in the export" are removed. No job does any of these.
  - "Then delete" after the BIR period is removed. The 7-day Supabase backups are now named on /privacy and /terms.
  - Error reports are now described as deleted by Sentry under its own limit.
  - The Public Summary opt-out path now names the real route.
- **Dates:** "last updated" is now 2026-10-23 on all three pages. The /terms effective date and `TERMS_VERSION` stay at 2026-06-30.
- **Admin pack:** `/admin/data-privacy` now serves the 2026-10-22 pack v1.1 (members 00–12, the merged packet, and the new Data Privacy Summary). The 2026-08-17 packet is removed from the bundle and stays in the corpus.
- **Guards:**
  - `npc-pack-is-true.test.ts` replaces its "ENFORCEMENT NOT YET BUILT" check. Every period the pack states must now be matched by a job in `PERIODIC_JOBS` that uses the same number.
  - New guard `lib/legal-retention-promises-have-a-mechanism.test.ts`: every keep-or-delete sentence on the three pages maps to a named job, code path, queue or vendor setting.

SPEC IMPACT: Applies the website-copy items from `~/Documents/Claude/Projects/Setnayan/NPC_Compliance/00_WHAT_CHANGED_2026-10-22.md` §3 and `Setnayan_Data_Privacy_Summary_2026-10-22.md` Part 3 ("Gap" rows on Visits, account deletion, retention). This PR edits no corpus file. The wording is held for DPO approval.
