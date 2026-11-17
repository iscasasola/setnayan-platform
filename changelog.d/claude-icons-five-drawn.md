## 2026-11-17 · feat(icons): the last five icons get their drawing

Five items still showed a stock lucide glyph with no animation. They are now drawn in the same style as the rest of the animated set (24×24 line art, a press colours it, a short play runs, the colour fades back).

- **Gifts group** (`gifts_giveaways`): a gift box. The lid lifts, the bow bounces, a glint.
- **Livestream** (`livestream`): a video camera with a live dot and broadcast waves. The dot blinks, the waves go out.
- **Officiants** (`officiants`): a person behind an open book. The book opens, the head lifts, a glint.
- **Counseling & Seminars** (`counseling_seminars`): two speech bubbles. They pop in turn, a heart shows.
- **Everything else** (`everything_else`): three squares and a plus. The squares pop one by one, the plus turns.

The four services reuse the shared moves already in `apps/web/app/service-icons.css`. The Gifts group adds one small block there (`gf-` prefix, two new keyframes, two reused). No call site changes: `taxonomy-icons.ts` picks a drawing up the moment one exists.

The prototype `service-icons.html` is not kept in this repo, so these five were added by hand in `apps/web/lib/service-icon-art.ts`. The file header says so. A later regenerate from the prototype must carry them over.

`apps/web/lib/no-taxonomy-literals.baseline.txt`: the `service-icon-art.ts` line goes from 1 to 2, raised by hand with the reason. The group drawings map now reads as a taxonomy list because Gifts joined it. It is the same art data, not a new list of services.

SPEC IMPACT: None
