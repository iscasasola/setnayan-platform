## 2026-11-07 · fix(vendor-dashboard): a refused read of the stored logo now says why, and still scans

A3 (logo framed by hand) added a read of `vendor_profiles.logo_url` in the shop-details save (`app/vendor-dashboard/actions.ts`). It
decides whether a save only moved the frame, which skips the QR re-scan, or is a new picture, which is scanned.

A refused read already failed toward the scan, which is correct. But the error was used only as a condition and its
reason was recorded nowhere: `ugat-both-ends` flagged it as a new `result-dropped-silently` orphan, red on #7353's DB
replay. The read now logs the reason with the house `[supabase-error]` line and still fails toward the scan.

No baseline line was added. Proven both ways on `tests/db/ugat-both-ends.db.test.ts`: the old line is red and names
this read; the fix is green.

SPEC IMPACT: None.
