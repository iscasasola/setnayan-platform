## 2026-11-13 · feat(rise): Rise full screen, everywhere — the audit, and every ⚙ rises

Owner rulings 9 Nov (DECISION_LOG 44a4c660) and 10 Nov: *"risefull screen is what we call it"* · *"fullscreen everything"*.

- **The audit** — `build-sessions/RISE-AUDIT-2026-11-13.md`: every door on the couple dashboard, the supplier dashboard, Home / account / the avatar sheet and admin that opens something over the page or jumps to a page — file, trigger, what it does today, the target, and the batch it lands in. Small sheets that are correctly small (menus, pickers, confirms) stay.
- **Batch 1 · every ⚙ rises.** `MenuSettingsButton`'s `rise` is now the DEFAULT, so the ⚙ on Home, Guests, Event Hub, Suppliers, Memories, People, Today, Clients, Portfolio and the supplier Hub opens in the ONE `RiseScreen` (out of the ⚙ · bars away 0.32 s · ✕ the exact reverse · a tab re-tap closes it) instead of a popup sheet — the Shop ⚙ already did. The rows inside are unchanged. The one ⚙ that keeps its sheet is the picked client's own (`rise={false}`): it already sits inside a risen view, and a Rise is one level only.
- Guard: `the-rise-screen-is-one-full-screen.test.ts` § 4 now pins the default and the single opt-out (sabotage: default back to `false` → red).

SPEC IMPACT: None — implements DECISION_LOG 2026-11-09 / 2026-11-10 as ruled.
