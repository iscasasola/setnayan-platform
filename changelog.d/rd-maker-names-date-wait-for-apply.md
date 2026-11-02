## 2026-10-01 · feat(maker): names and date typed in the Maker wait for Apply · the names get Wording ▾

Owner, 2026-10-01 (DECISION_LOG "ELEVEN OWNER ANSWERS" #1, *"wait for apply"*):
names and the date typed on the Maker page are a DRAFT until Apply, like every
Maker edit.

- **The draft holds the names and the date.** `HUB_DRAFT_FACT_COLUMNS`
  (`display_name`, `bride_name`, `groom_name`, `event_date`,
  `event_date_precision`) join the draft's allow-list in `lib/hub-draft.ts`,
  each through its live writer's own rule (`lib/typed-names.ts`; the date's
  YYYY-MM-DD and its three precisions). "Changes waiting" counts the names
  once and the date once. Undo takes them back.
- **Apply asks the date's own gates.** `eventDateRefusal` (lib/events.ts) is now
  the one rule both `updateEventDate` and the draft's Apply read: never a day
  gone by; a booked supplier's date never moves. A refused date stays in the
  draft and is named ("Your date … is held by a supplier you booked"). The
  supplier count is read fail-closed.
- **Details › Your event drafts.** Names (`coupleNameColumns`, the composition
  `updateEventMatchCriteria` writes live), a one-person Name, a day (after the
  governed row's booked-supplier preview, via `GovernedFields`' new `saveDate`)
  and a month all go through `hubDraftAction`. No Maker piece calls
  `updateEventDate` or `updateEventMatchCriteria` any more (the dashboard's
  Personalization page still does). "Saves immediately" is gone from them;
  they say "Saved — guests see it when you Apply".
- **The names are a tap-to-type part.** `names` joins `HUB_TYPE_PARTS`; each
  person's name is its own caret target (`data-el-person`, Maker canvas only),
  so the joiner stays the Joiner's. Typing writes the draft's `display_name`
  through the type bar's one held write path. Their **Wording ▾** is the
  event's Name style — Full · Middle initial · Surname first, each written in
  the couple's own name (`nameStyleChoicesFor`) — the same one setting the
  prints read, saved through the prints' own door (`lib/name-style-save.ts`).
- The Guest list is untouched.
- Guards: `lib/tap-to-type-is-instant.test.ts` § 6 (6a–6f) and
  `tests/db/a-typed-name-and-date-wait-for-apply.db.test.ts` (a save leaves the
  events row unchanged; Apply writes it once, through the couple's session).

SPEC IMPACT: None
