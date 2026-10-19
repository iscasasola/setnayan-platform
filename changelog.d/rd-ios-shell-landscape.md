## 2026-10-19 · feat(ios-shell): the iPhone app turns to landscape

Duo/iPad audit 2026-10-19, batch B2 — row N2. `UISupportedInterfaceOrientations` (iPhone, and the iPhone Duo's outer display) was Portrait only, so the outer display could not stand like a tent. It now also allows Landscape Left and Landscape Right. Portrait Upside Down stays off on iPhone (Apple's guidance for Face ID phones). The iPad key already had all four.

⚠ HOLD: ship only after batch B3 (left/right safe areas on every fixed bar) and batch B5 (short screens) are live — landscape exposes both.

SPEC IMPACT: None.
