## 2026-11-13 · fix(discover): the empty "More upcoming" shelf no longer offers Create an event

Owner: "on discover we do not want to create an event there. we want to create on our home". The empty shelf keeps its line and ⓘ; `EmptyShelf`'s action is now optional. Guard: `discover-never-creates-an-event.test.ts`.

SPEC IMPACT: None
