## 2026-10-27 · fix(create-event): the New event sheet drops "← Back to events" and the gold NEW EVENT label

Owner 2026-10-27, on the Create Event sheet: *"All of these are not needed. You can bring up the what kind of event you are
planning and also you can keep the (x) on upper right"* → refined on a screenshot: *"This arrangement is fine if you have not
designed yet"* — keep the panel's "New event" title row with its ✕. Inside the panel (`data-create-event-in-panel`) the
page's own head (Back + label) is hidden and the question moves up (`pt-4`). A cold load of /dashboard/create-event keeps
its Back. Supersedes the WIP branch `claude/new-event-head-is-the-question` (which hid the title too).

SPEC IMPACT: None.
