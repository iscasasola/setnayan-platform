## 2026-11-25 · fix(final check, area 3, batch 2): Event Hub editor saves stop claiming success

From the final check of the staging copy (area 3, lane A: no screen change).

- **E-10:** Our story refuses to save when the stored story could not be read ("Couldn't read your story, so nothing was saved"). It used to merge into nothing and drop the couple's moments.
- **E-11:** Photo moments, and section visibility, mode and order, count the rows they wrote. RLS refuses by matching zero rows with no error, which used to read as "Saved".
- **E-17:** Set the mood shows no Save when both parts are locked. A zero-row write is a failure.
- **E-15:** Privacy's visibility cards mark the choice the person tapped (`:checked`); "Current" still names the saved one.
- **E-02:** Our photos, draft path: a photo the automatic check blocked is now said, as on the live path.
- **F-01:** the "event page" door sends every member of the event to the public Event Hub (a coordinator no longer gets a 404). A failed read is an error page, never a 404.
- **N-04:** one song limit. Save the Date said 40 MB for the same `site-music` file the Maker and Set the mood take at 20 MB. Upload boxes no longer repeat the types and limit the box already prints, and "wedding-site" is gone.
- **L-09 (copy part):** the live-studio "Copy" says when the clipboard is blocked.
- **P-07:** Apple Pro with no App Store product shows the store's silent line instead of a button disabled forever.
- **M-08 (Alaala part):** a failed stories read says "Couldn't read your guests' stories" instead of vanishing sections.
- **Guard:** `app/dashboard/[eventId]/website/editor-saves-are-honest.test.ts` (seen red on the old E-10 line).
- **Server actions:** no new export. No migration. No price, plan or sign-in rule changed.

SPEC IMPACT: None. Honest-state fixes on shipped pages; the song limit follows the two places that already said 20 MB.
