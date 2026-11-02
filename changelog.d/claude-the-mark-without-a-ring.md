## 2026-09-21 · fix(monogram): the couple's mark renders without a ring

Owner: "a circle on the monogram that is not part of the monogram. remove
that." Every uploaded / AI monogram was drawn inside a 2px ring in the
monogram colour on a cream disc (design from 2026-06-11). The mark now renders
as itself, at full size, on the event page and everywhere else it appears.
Dark surfaces that pass `plate` (recap photo hero, Live Wall) keep a plain
cream disc so the mark reads, with no ring. Guard:
`the-mark-wears-no-ring.test.ts`.

SPEC IMPACT: None.
