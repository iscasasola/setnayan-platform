## 2026-09-11 · fix(story): the minute count-up paints over a time, it never rewrites it — one cause of a hydration error on a published story

> ⚠ **Corrected after re-measuring on production (step 8, same day):** with this live (`9663550`) the #418 rate on the published story was still **6 of 32** signed-out loads. The `textContent` write was a real race and is gone, but it was **not the whole cause**; the remainder is a render/streaming difference, not a DOM write (a DOM snapshot taken at the error is a strict subset of the server HTML). Tracked as its own task. The line below originally claimed the error was gone — it was not.

Found by the Story's step-8 drive against the LIVE public page. On a published story with minutes, React reported hydration error #418 on **2 loads in 12** (signed out and as a guest, light and dark, any time zone) and threw the whole story away to redraw it on the client; another celebration without a by-the-minute spine: 0 in 12. Diffing the server's HTML against the drawn page on a failing load pointed at `story-clock.tsx`: as a minute scrolls into view its stamp counts up, and it did so by setting `textContent` on every `[data-story-countup]` on the page, reached through `document.querySelectorAll` — including minutes in streamed parts React had not hydrated yet. Observer vs hydration was a race, hence intermittent, and invisible to unit tests and to the stand-in page.

- `story-clock.tsx` — the digits in flight ride `data-story-counting`; the last frame removes it. The server's text is never touched (React does not compare attributes when it hydrates).
- `globals.css` — `[data-story-countup][data-story-counting]` hides the real text in its own box (nothing moves) and `::before` paints the attribute over it.
- Guard `the-story-never-rewrites-what-the-server-sent.test.ts`: no story component writes text/markup into the DOM directly (14 scanned), and the count-up still paints through its attribute. Sabotage: restoring the old `node.textContent =` write → 1 offender, 2 of 2 fail; restored → pass.

SPEC IMPACT: None — the count-up looks exactly as designed (`01_The_Story.md` §6); only how it is drawn changed.
