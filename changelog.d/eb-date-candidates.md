## 2026-11-16 · fix(supplier): a booking card shows the couple's date while it is still an option

Found on the phone walk of every supplier button (16 Nov 2026, EB-286). A supplier's customer card said **"No date set yet"** under *Agreed now · Event date* while the couple's own event read **June 19, 2027**.

Cause: the row read only `events.event_date`, which is the LOCKED day and stays empty until the couple locks it. The couple's picked option(s) live in `date_mode` / `date_candidates` / `date_window_start` / `date_window_end` / `event_days`, and the couple's own screens already show them. The card now reads those too:

- a locked day reads as before ("Jun 19, 2027");
- one open option reads "Not settled · Jun 19, 2027"; several read "Not settled · 2 options · Jun 19, 2027 – Jul 3, 2027"; a window reads "Not settled · between … and …" (with "· N days" for a multi-day event). Years are kept, because these dates can be a year out;
- only when there is neither does it say "No date set yet".

A refused read was already handled: the card draws "Couldn't load what is agreed" instead of any row. All six columns are granted to signed-in readers in prod (checked by `has_column_privilege`), so adding them cannot empty the read.

Guard: `lib/agreed-now-date-options.test.ts` (5 tests). Two sabotages, each measured 1 → 0 and each red: the row builder back to `event_date` only, and `date_candidates` dropped from the read.


Left as is, on purpose: the same card's day check still says "Their date isn't set to a day yet, so there is no day to check." That is true while the date is only an option: there is no locked day to check the calendar against.

SPEC IMPACT: None.
