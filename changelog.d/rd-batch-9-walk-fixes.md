## 2026-10-16 · fix(batch-9): walk fixes — Home lit on a short page, map tiles wait, every logo reader follows the switch, palette names at 12 px, the stranger's cover at 375×667

- W1: Home is lit until the guest scrolls past it (`litJumpMark`), even on a Save the Date whose Story mark starts inside the lit line; a tapped mark stays lit until the guest's own touch, wheel or key. Guard `app/[slug]/_lib/home-is-lit-until-the-guest-scrolls.test.ts`.

SPEC IMPACT: None
