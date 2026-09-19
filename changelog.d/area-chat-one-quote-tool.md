## 2026-09-19 · fix(chat): one quote tool on the supplier's conversation — the template shortcut moves inside the builder's panel (SUP-H · AREA-CHAT)

The supplier's tool registry carried two quote panels and two launchers —
`send-proposal` ("from a saved template") and `build-quote` ("line items,
freebies, crew and transport"), the second marked primary — and the client
brief's two Quote buttons opened a different one each. One job, two doors, two
rooms (register row SUP-H, confirmed open after #5614).

Now there is ONE panel, `build-quote`, labelled "Send a quote · line by line, or
from a saved template", and ONE launcher. Both composers still mount — once
each, so the gift line, the forms and the anchor ids stay unique — inside it:
the builder first (it works for every shop; production holds no proposal
template on any shop), the saved-template card under it, its button now
reading "Send from a saved template". The panel id is unchanged because every
deep link and `?compose=quote` name it; the brief's "Quote" button now opens
`#build-quote` like its "New quote" button already did.

Guard: `lib/one-quote-tool.test.ts` executes the registry (exactly one quote
panel, exactly one quote launcher, primary), counts both composers inside the
one panel body and nowhere else, and walks `app/` for any `#send-proposal`
deep link.

SPEC IMPACT: None.
