## 2026-10-29 · fix(home): Event settings ⚙ crashes on a real event

Owner, on his real event in the iPhone app: *"Event settings not working"*. Pressing Home's ⚙ (#7036) dropped Home to
"Something on our end didn't work".

- **Cause.** The ⚙ reads its rows with a server action (`openEventSettings`) that RETURNS rendered rows: the Maker's
  editors (`details-lazy.tsx`, `details-go.tsx`). Next sends a client component in an action's answer through the
  CALLING route's client manifest, and builds that manifest from the route's SERVER imports only. Home reached the
  action only from the browser (`import()`), so the editors were never in Home's manifest. Production logs show the
  action POST answering **200** (no server error is logged, because Next routes action-render errors to
  instrumentation only), then a client-fault report a second later. Reproduced on a minimal build with the repo's own
  Next 15.5.28: the answer carries `E{digest}` for the editor, plus the server line "Could not find the module … in the
  React Client Manifest". A client `import()` of the editor does NOT fix it. A server-side import of the action does:
  the answer then carries `I[id, [chunks], "Editor"]`. The Home lab never saw it because its rows were drawn by the lab
  PAGE, whose own server imports reach the editors.
- **Fix.** One side-effect import, `import './_components/open-event-settings'`, in `app/dashboard/[eventId]/page.tsx`,
  so the action and the editors it draws are in Home's server graph. The ⚙'s place, the sheet and its rows are unchanged.
  Home's first load gains only the editors' lazy stand-ins (`details-lazy.tsx`, `details-go.tsx`). The editors still
  load when the sheet opens.
- **Guard.** `_components/the-settings-sheet-is-in-homes-graph.test.ts` walks the action's server graph to the first
  `'use client'` modules and requires each one to be reached from Home's server files. Sabotaged once: with the import
  removed it fails and names `details-lazy.tsx` and `details-go.tsx`.
- **Known, not fixed here (TODO test in the same file).** `openGuestCard` has the same shape: a parent in the sheet,
  or a walker or parent in the Maker, opens a guest card whose client pieces neither Home nor the Maker imports from a
  server file. Importing them would put the whole guest card into those first loads, so that needs a decision first.

SPEC IMPACT: None.
