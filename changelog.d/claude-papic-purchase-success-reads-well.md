## 2026-10-26 · fix(iap): the Papic purchase lands as one clear moment

Owner on TestFlight build 6, after a sandbox purchase: "make it more presentable". The success screen of the in-app Add credits sheet read "Add credits ⓘ · 100 credits are on this event · [✕ Done]" — the buy title kept, a close icon on Done. Now: a check, "100 credits added", "On this event now. Guests can start taking photos.", one full-width Done (✓), Apple's receipt line. `PapicCreditsAdded` is exported so `/dev/iap-doors-lab?door=papic-added` draws it without a purchase. Web-only — reaches the app without a new build.

SPEC IMPACT: None
