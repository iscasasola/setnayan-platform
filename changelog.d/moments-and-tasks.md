## 2026-11-02 · feat(schedule): moments and their parallel tasks on a chapter's page (Step 3b)

On a chapter's page, **+ Add a moment** (thumb row, beside Edit) and a tap on any moment open the moment sheet:
What · Time · Minutes · Section (picking one moves the moment into it) · Room · Visible to guests · Optional ·
Travel to / from · Notes, each saved as it is kept (the Form Row rule). Inside it, **Tasks at this moment**: one row per
supplier, crew, role, group or person — picked from ONE Who ▾ with sections and search (people only by searching) —
with what they do, an optional call time and a place (blank = the moment's room). A task saves once it has a who and
a what; edit and remove in place. **The same person or crew in two places at once is flagged** on the task and on the
moment's row, never refused (`clashesForMoment` over the whole day's tasks). **Delete moment** warns, then Continue,
then a deleting state; the warning counts the chapter's Papic photos and videos and says they stay, because Papic
shoots into chapters (`papic_chapter_captures`), never a moment — there is no moment-level link to delete through.

Tasks and the Papic count go through `updateScheduleBlock` as a `moment_op` intent branch (the server-action budget
is at its ceiling — no new export). Reads: the chapter read now also carries each moment's room, Optional and travel
(`readChapterBook`, the same one read); tasks and Who ▾'s people/groups/roles join the page's first round.

Not built: **"This is a march"** — no moment↔march link exists on main (no column, no list of marches; plan §8 step 7).

SPEC IMPACT: None (builds plan §3 "Moments work the same way" and §3c as written; the march dropdown and the
moment-level Papic delete are reported in the PR as open, not ruled here).
