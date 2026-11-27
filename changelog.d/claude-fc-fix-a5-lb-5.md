### Final check · area 5 · lane B 5 — one back row and a visible title; busy states say their step

- **B18:** every supplier page with a way back wears the one pinned row (`ToolPin`: ‹ + a title you can see) — Your details, Settings, Team, Their work, Deep Search, Packages, Albums by event, Partnerships, Your requests and a request. (Spaces follows area 7 B4: its title is in the top bar.) The grey "← Today" / "← Shop" boxes, the "‹ Your requests" link and the screen-reader-only titles are gone. Your details · Settings · Team still return in place. A request's ‹ goes to Your requests; Partnerships and Packages go to the Shop.
- **B19:** a working button stays pressed and names its step ("Saving…", "Posting…", "Uploading photo…") — no spinner. This is in the shared `SubmitButton` (every form button) and in `ActionButton busy`. Loading blocks on supplier screens are the skeleton, never a pulse. The Locked QR upload says "Didn't upload" in the danger colour with Try again (the same file).
- Guards: `app/vendor-dashboard/one-pinned-row.test.ts`, `app/vendor-dashboard/busy-says-its-step.test.ts`. Lab: `/dev/busy-and-back-lab`.
- Depends on #8368 (built on lane B 4).

SPEC IMPACT: The approved B19 drawing (25 Nov) replaces the motion standard's "the label gives way to the spinner" (#35) with "the button stays pressed and names its step". The corpus row is to be updated by the controller.
