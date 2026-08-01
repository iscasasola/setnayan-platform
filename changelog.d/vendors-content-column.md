## 2026-08-01 · docs(vendors): record why the Services takeover is deliberately NOT capped by `.sn-col`

Follow-up to #4024, which added `.sn-col` (64rem reading column) to 13 text-led event routes and listed `vendors` as a to-do. **Investigated and closed as WON'T DO** — the follow-up premise was wrong, and this commit records why in the code so it isn't asked a third time.

**The premise, and why it was wrong.** #4024's note said `vendors` had no single page root: `page.tsx` builds four slots (`shortlistSlot` / `buildSlot` / `budgetSlot` / `compareSlot`) and hands them to `<ServicesTakeover>`, so capping one "tab" would leave three siblings uncapped. That description was written from the slot names without reading the shell. `ServicesTakeover` **is not a tab switcher on desktop** — the desktop tab strip was removed 2026-07-15 (owner), and since the 2026-07-09 single-scroll change all four slots render simultaneously in a two-column grid:

```
lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6
```

Left column = the shortlist ("Browse the bench"). Right column = a **fixed 380px sticky rail** holding build + budget + compare.

**Why the cap is wrong here, measured.** The rail is fixed, so every pixel `.sn-col` removes comes out of the browse column:

| | content column | left / shortlist column |
|---|---|---|
| today @1440px | 1120px | `1120 − 380 − 24` = **716px** |
| with `.sn-col` | 1024px | `1024 − 380 − 24` = **620px** |

A 13% narrowing of the vendor-browsing surface. And because `.sn-col` only binds above a ~1344px viewport (`1024 + 256 sidebar + 64 padding`), it does nothing until exactly the widths where the two-column layout finally has room — so it can only ever hurt. This is the same category as `suite`'s deliberate `2xl:grid-cols-4`: a real wide layout, not an unfixed one.

**Also corrected:** the aborted first attempt in #4024 put `sn-col` on `buildSlot`. That would not have "capped one tab" at all — `buildSlot` renders *inside* the 380px rail, where a 64rem max-width never binds. It was a no-op, not a partial application. The revert was still right; the stated reason was not.

**Live path confirmed**, so this is about what users actually see: `isBudgetBuildEnabled()` returns true unless `BUDGET_BUILD_ENABLED=false` is explicitly set (kill-switch, owner 2026-06-09). The `return services` branch in `page.tsx` is the flag-off legacy fallback and is not the live surface.

No behaviour change — comment only.

SPEC IMPACT: None.
