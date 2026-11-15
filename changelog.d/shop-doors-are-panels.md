## 2026-11-16 · fix(shop): from 701px every Shop door opens as the 440px right panel

W1 tablet/desktop walk, RW-352 · owner 2026-11-16 (DECISION_LOG "FROM 701px THE SHOP DOORS OPEN AS THE 440px RIGHT PANEL").

On a tablet or a computer, the supplier's Shop doors — **Share, Logo, Promote, QR, Cover, View shop, each badge, each Analytics tile** — filled the whole screen, while every other supplier sheet opens as the right-hand panel. From 701px they now open as that panel (440px, pinned right, the Shop page dimmed behind it), with the same title, line, action and thumb button. **On a phone nothing changes**: below 701 each door is the same full-screen rise it was, with the same props, and the server's first paint is that phone screen.

One new door (`ShopDoorScreen`) does it, built only from the shared Sheet's existing right-panel mode and the existing rise screen — neither shared file is edited. The Shop ⚙ is not a door in this list and is unchanged.

Guards: the rise guard is narrowed to "rises below 701" (kept, not deleted); a new guard pins the 701 line, the panel (440 drawer, backdrop, head, foot) and that all eight doors go through it. Sabotaged three times — Share back to the full-screen rise → red; the door never becoming the panel → red; the phone branch becoming the panel → red (rise guard).

SPEC IMPACT: None in the corpus beyond the owner's DECISION_LOG row (already written by the controller).
