## 2026-11-21 · fix(dates): "Some months" is read back on every screen that says the open date

Onboarding wrote `date_mode = 'months'` + `events.date_months`, but no reader selected `date_months` and no caller passed it to the shared date words. A couple who picked "Some months" saw their months nowhere after creating the event. Now said in nine places:
- the Suppliers date line ("Feb · Apr · May 2027");
- the Suppliers date sheet (Year and Month lit, "considering Feb · Apr · May 2027"; it no longer folds months into an empty "specific");
- Event details and "Your event" ("Not settled · in …");
- Papic's "switches on when you pick the day" line;
- a supplier's "What is agreed" card in chat;
- a supplier's customer list, inquiry facts and event lines ("Feb · Apr · May 2027 · months").

The supplier-side three read `date_mode` too and pass the months only while it is `months`.

The sheet's "A few dates" editor still writes days or a range; saving one, or picking a day, moves the mode off `months` and now also clears `date_months`. Guard: `lib/some-months-are-read-back.test.ts`. It derives every select that reads the open date and every call of the shared words, so the next reader is caught. Find's free-on-your-date filter is deliberately left alone: it filters and words nothing, and months there would be a new filter rule.

No migration change: the column, its grants and `events_host` come from the GO'd `20271355916558`, unchanged.

SPEC IMPACT: None
