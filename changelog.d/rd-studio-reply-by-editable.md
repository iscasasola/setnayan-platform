## 2026-10-08 · fix(studio): Reply by is editable in Studio › RSVP and waits for Apply

Owner, on the preview (2026-10-08), verbatim: *"where it the reply by date?"* → *"date is not changeable on studio."* Studio › RSVP printed the date read-only ("set on Guests › Setup or in Event Details"), and on a phone the new Maker had no visible place to change it. His standing rules: no go-elsewhere — the control is right there; and "draft 1-3": Reply by is edited in the Maker and waits for ✓ Apply.

- `dashboard/[eventId]/_components/guest-setup/reply-by.tsx`: the read-only `print` layout (no mount left) becomes `studio` — ONE row: "Reply by" left, the date field right, nothing else. No box, no sentence, no "Saved", no "Guests see this right away"; a refused pick is said under the row and the date goes back. Guests › Setup's `row` and the Maker's two `stack` mounts render as before.
- `launch/_components/maker-rsvp-ask.tsx` (Studio branch): mounts it with `action` and `draft` — the pick goes to the hub draft (`updatePaxSettings` + the draft field) and ends in the one render that moves the ✓ Apply count.
- Guards (each changed assertion seen red once): `studio-round-3-follows-the-owner` 9 (new, renders the row), `draft-1-3-waits-for-apply` B (all three Maker mounts drafted, the Studio's the editable row), `setup-and-maker-mount-the-same-parts`.

No new import (the part is already in the lazy `maker-guest-setup` chunk): nothing added to the Maker's first load or the shared bundle. No migration. +0 server actions.

SPEC IMPACT: None to write — `DECISION_LOG.md` already carries the 2026-10-08 row "REPLY BY MUST BE CHANGEABLE IN STUDIO › RSVP" (it amends the 2026-10-07 "printed, read only" line).
