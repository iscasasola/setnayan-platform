## 2026-10-17 · feat(closing): "See you soon." takes the couple's own words, a cover word's look, and Animate

Owner, 2026-10-17: *"and also allow styles on the see you soon and customization. so we can edit the text there."*

The closing (#6595) is its own Maker part whose Style was one Accent ◆ ▾ and whose words were fixed. Its LINE is now
a part like a cover word, on the shipped machinery (`lib/element-style.ts`):

- **Edit** — the couple types their own closing line (one line, ≤ 60). Empty, spaces, or the default words store
  nothing and draw "See you soon." — never a blank band. The band's names and date stay the couple's facts (Details /
  the cover's Event title); "Powered by" is Setnayan's — neither is typed here.
- **Style** — the Accent ◆ ▾ (None · Oval frame) is kept, and Style's last row is a cover word's Colour · Size ·
  Width (the shipped cover-word Style has no Font row — "there is already a universal font"; a stored font is drawn).
- **Animate** — the part's sheet: Build in, Drift · Shimmer · Glow ◆. A Build in "On arrival" plays as a guest reaches
  the foot of the page (its own `view()`), not on the clock at load. No Words ▾, no Delay, no Leaves (it ends the page).
- **Where it lives** — `elements.closing` on the HERO row's canvas (no table, no column, no migration): one draft
  key, one sanitiser, one Pro comparison. Motion is Pro at Apply (named, "Go to" reaches the Closing); words and look
  are free — exactly as a cover word's are today.
- **Guest page** — `ClosingLine` (`app/[slug]/_components/closing-line.tsx`) draws the line for both sign-offs (the
  plain footer and the art kit's) and the Maker lab. A line nobody touched is byte for byte the old sign-off.

Guarded by `apps/web/lib/the-closing-takes-the-couples-words.test.ts` (6 sabotages, each caught).

SPEC IMPACT: Owner ruling 2026-10-17 (verbatim above) extends DECISION_LOG "THE CLOSING ('SEE YOU SOON') IS ITS OWN
SCENE IN THE MAKER" — the closing's words are the couple's and its line takes a cover word's Style and Animate. Row
left for the controller to record.
