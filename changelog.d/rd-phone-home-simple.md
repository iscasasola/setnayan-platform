## 2026-10-01 · feat(home): the phone Home leads with one Next card, Edit your Event Hub, three numbers and the money line

Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SIMPLE PHONE APP — APPROVED", `prototypes/phone_app_simple_2026-10-01_fable.html` frame 1 "Home"). The event Home (`app/dashboard/[eventId]/page.tsx`) now opens, in the plan phase, on a first screen:

- **ONE Next card, one button.** The Home's existing nudges collapse into it, in the order the page already stacked them (`HOME_NEXT_ORDER` in `lib/home-first-screen.ts`): the guided "What's left" (Details part 5) → set your date → your free camera is ready → Setnayan AI → "You are on track · See your plan". The card that wins is not drawn a second time below; every other nudge stays where it was.
- **Edit your Event Hub** — always drawn (the Maker left the bar), marked Recommended as in the approved frame.
- **days to go · coming · no reply**, and one **Paid / Still owing** line. Guests come from `fetchGuestsByEventMeasured`, and the money from the Budget page's own Paid/Owed core (`budgetLiveSummaryMoney` over `buildBudgetLiveSummary`). The money is only read for viewers the budget is shared with (`resolveBudgetVisibility`). A read that did not happen prints "—", never 0 or ₱0.
- **Your services** (owner, same day: *"how about papic? and sai? … let's add it"*): one compact row under the money line — **Papic** (the dashboard's own `resolvePapicHomeTile` readiness: "On · N photos" / "Free camera ready" / "Not added") and **Setnayan AI** (`isSetnayanAiActiveForEvent` under the resolved paywall: "On" / "Try it"), each opening its page; "—" on a failed read. Absent in the store shell (both are `STORE_SHELL_HIDDEN_ADDON_KEYS`, and the Papic Next card is withheld there too). The service that is the Next card is left out of the row.
- On a phone the first screen fills the screen and ends in **See all**; the whole existing dashboard follows under `#home-all`, unchanged. The day-of and After branches are unchanged.

The guided-flow tile (`DetailsGuideHomeCard`) became `readHomeGuide()` — it always IS the Next card when it exists. `event-dashboard.tsx` only exports `daysUntil`. New server component `_components/home-first-screen.tsx` (no client code). Dev lab `/dev/home-lab`. Guard `app/dashboard/[eventId]/the-home-leads-with-one-next.test.ts` (render harness; sabotaged five ways). Port-controls baseline regenerated (removed: `DetailsGuideHomeCard`, `Suspense` — deliberate).

SPEC IMPACT: None
