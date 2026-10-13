## 2026-10-08 · fix(maker): a new version arriving mid-session reloads the Maker back to the same place, and says so first

Owner, live (Studio › Look, a background pick in his draft), verbatim: *"clicking on music reset the maker and reloaded"*. Measured: production's version changed in that same minute.

- **Cause.** The press reloads nothing (`StudioLookBar` → a client `select`; its segments are `type="button"`). A page open across a deploy is reloaded by Next itself: any page data answered by a newer build (`router.refresh()` after a save) makes `fetch-server-response.js` (`getAppBuildId() !== response.b`) answer `doMpaNavigation`, and `app-router.js` does `location.assign(canonicalUrl)` — silently. The "reset" was ours: `maker-shell.tsx` treated its own reload as a cold door (`?tool=details&item=music`) and, by rule 3 (DECISION_LOG 2026-10-07), landed on Studio's tiles.
- **Fix.** `lib/maker-resume.ts`: the Maker keeps a small one-shot note of where it is (side · Studio tool · item; this tab's session storage). A page that came back to ITSELF — a reload, or a hard navigation from this very page to itself — opens where it was (`makerCameBackToItself` → `takeMakerResume` → `makerDoorLanding`); from anywhere else the note is thrown away and rule 3 stands. A reload on the Stages side also stays on the stage now (the address's old `?tool=details` is not a door).
- **Said first.** `maker-updating.tsx` (lazy): where the browser has the Navigation API, "Updating Setnayan…" is laid over the screen as the page starts to reload itself by script — never for a link, the browser's own buttons, a section press, or a navigation elsewhere.
- The draft is untouched: it is server-side, and the ✓ count is read from it on every load.
- Guard: `lib/a-reload-returns-to-the-same-place.test.ts` (8 tests on the real functions, incl. a pin on the Next branches that do the reload); one pin in `the-stages-panel-is-the-prototypes.test.ts` amended.

SPEC IMPACT: None. Rule 3 keeps its words; its one exception is the page's own reload.
