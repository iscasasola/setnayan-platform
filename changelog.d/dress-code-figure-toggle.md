## 2026-09-30 · feat(dress-code): the couple can turn the outfit figure off; the Do's and Don'ts are fixable in the Maker and on the Mood Board

Owner, 2026-09-30, on the guest's dress-code scene: "they can opt not to add this" · "Do's and Don'ts should be fixable also" · "both host of the event can input it and the supplier" · "do's and don'ts should be on the mood board as well".

- **Outfit figure switch.** `events.dress_code_config.show_figure` (absent = on, today's look). One "Show the outfit figure ⓘ" switch in the Dress code editor (its own page and the Maker's Dress code scene). Off hides the figure in the reader's own panel and in every role row; chips, words and lists are untouched. No schema change.
- **A Maker save no longer wipes the outfits.** The Maker's Dress code panel is not handed the guest list, so it posted no role or group rows, and `updateDressCode` rebuilt `roles` and `groups` as empty on every Save there. The saved outfits now ride along as hidden fields whenever the form cannot list them.
- **Do's and Don'ts are fixable.** Removing a row removed the wrong input once any row had been edited (rows were keyed by position, text left in the DOM); rows now keep their own id and text. The "Do" heading sat above the two role sections instead of above its list; it is back with its list.
- **Do's and Don'ts on the Mood Board.** The same stored lists, the same `ListField`s, saved by a new `updateDressCodeLists` that replaces only the two lists and keeps the rest of the dress code. In the Maker it saves to the draft beside the Dress code scene, so the two show one list.
- **Unset outfit blames nobody.** "The couple hasn't said…" → "Not set yet — your hosts or their stylist will add it here."; a host reading their own page reads "Not set yet — add it in your Event Hub Maker, under Dress code."
- **Colour names, not hex codes.** The guest's chips show the couple's name for a colour, else the Mood Board's own namer (`lib/color-names.ts`); a raw hex is never printed.
- **A zero-row save is no longer "Saved".** The live dress-code writers now check that a row was written.

Guard: `lib/the-outfit-figure-is-the-couples-to-turn-off.test.ts` (sabotaged: figure gate, unset copy, carried outfits, hex label — each went red).

SPEC IMPACT: None — a display switch inside the existing dress-code config and copy fixes; no locked decision changed.
