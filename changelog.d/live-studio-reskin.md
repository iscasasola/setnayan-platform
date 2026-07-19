## 2026-07-09 · style(panood): "Energy, not skin" reskin of the Live Studio control surface

Presentational-only reskin of the logged-in couple/operator Live Studio (Panood)
control surface — the go-live card and the Panood App Store detail page — into the
wine/serif brand.

- `apps/web/app/dashboard/[eventId]/studio/panood/setup/go-live-card.tsx`
  - Serif (`.m-serif`) section heading; kept wine (`bg-mulberry`/`bg-burgundy`)
    primary controls and champagne-gold (terracotta) as the secondary accent.
  - Added a **broadcast-readiness `ProgressRing`** in the card header — a dense,
    legible read of the go-live status the card ALREADY derives from its props
    (the three prerequisites: owns Panood · YouTube app review cleared · channel
    connected), flipping to a full wine "Live" ring once a broadcast is active.
- `apps/web/app/dashboard/[eventId]/studio/panood/page.tsx`
  - Re-expressed the existing "% of events use Panood" adoption figure as a wine
    `ProgressRing` status tile in the preview rail (graceful glyph fallback when
    no adoption data exists yet).

No changes to WebRTC transport, the streaming flags, server actions, or the
go-live handshake — look pass only. No new queries; the public viewer /
camera-operator pages (`apps/web/app/panood/**`) and the shared `AppStoreLayout`
were left untouched.

SPEC IMPACT: None — UI reskin only
