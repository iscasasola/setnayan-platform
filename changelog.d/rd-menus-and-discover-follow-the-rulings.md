## 2026-10-23 · fix(nav): the side menu lists no tools — one Features row (the 1 Oct rulings, built)

Owner, 23 Oct on live prod: *"why do i see so many menu. this is supposed to change already?"*
The front-door rail (desktop rail and the phone ☰ drawer, every tree outside an event) drops the
Planner · Builder · Together · Studio lists with their one-line descriptions and "things you …"
subtitles (DECISION_LOG 2026-10-01 "THE SIGNED-OUT FRONT DOOR STOPS LISTING EVERY FEATURE IN THE
SIDEBAR", "THE SIGNED-IN SIDEBAR ALSO DROPS THE PLANNER · TOGETHER · STUDIO FEATURE LISTS").

- Signed out: Discover · Find suppliers · Features · How it works · Sign in.
- Signed in: Discover · My Home (Events · Memories · People · shop · HQ) · Features.
- Inside an event: unchanged — the rail is focused on the event's own menu, where each tool is a row.
- /features gains **Date picker** (the "SIDEBAR COLLAPSE + FEATURES PAGE" row's missing entry).
- Dead code removed with the lists: `lib/free-tools-rail.ts`, the doorway/signed-out row builders,
  `STUDIO_APPS.railLine`, the tool-row CSS; the rail no longer reads a "Studio event" (one fewer read
  on `/` and every app page).
- Guard: `the-rail-lists-no-tools.test.ts` renders the rail signed in/out on every variant and fails
  if any row opens a tool's page or the Features row is missing/doubled (sabotaged: red twice).

SPEC IMPACT: DECISION_LOG row "23 Oct: the 1 Oct menu rulings built; Tagalog hidden; Planner mode
removed" (corpus). Not built here: the rail collapse toggle ("press SETNAYAN") — it conflicts with
the 2026-10-21 ruling that the app's mark goes to Events and with the OAuth-pinned front-door
wordmark; left for the owner.
