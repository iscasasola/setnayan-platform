## 2026-10-27 · fix(nav): the phone drawer clears the status bar

Owner, iPhone app: "sidebar on mobile overlaps on the clock". The off-canvas rail is `position: fixed; top: 0`, so "My Home" sat under the clock and battery. It now pads by `env(safe-area-inset-top)` (and the home indicator at the bottom).

SPEC IMPACT: None
