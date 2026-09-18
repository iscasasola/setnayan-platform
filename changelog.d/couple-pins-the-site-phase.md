## 2026-09-18 · feat(website): the couple can keep one version of their site up — "always show RSVP" (DAY-33 · PH-6)

The guest site picks its face from the date: save-the-date far out, the invitation with RSVP in the
run-up, the day-of page, then the after page. With "Open browsing" off (the default) the RSVP form
exists only in the run-up window, and the couple's only override was the host-only `?phase=` preview.

The owner ruled this on 2026-07-02 (DECISION_LOG): *"a manual toggle to set it automatic or manual
launch … activating one will deactivate the other … save the date, rsvp, event and editorial."*
PR #2562 built it and was **closed unmerged as stale**; only its migration landed. So
`events.launch_mode` / `events.manual_phase` have existed in prod since then with **no reader and
no writer**. This PR revives the intent on today's tree. There is **no new schema**, and prod
grants already cover both columns for `authenticated`.

- `manualLaunchPhase()` in `lib/invitation-widgets.ts`: pinned only when the mode is `manual` and the phase is real.
- `/[slug]`: `phaseOverride ?? pin ?? clock` feeds both the body phase and the day-of phase, the same way the host preview does. The host's `?phase=` preview still wins.
- The arrival door (`lib/invite-destination.ts`, `invite/enter`) composes the same pin, so the door never describes a face the page isn't wearing.
- Website editor: a new rail row, "Which version guests see", offers Automatic (showing today's clock phase) plus four "Always show" options. It is a single radio group. `setLaunchPhase` writes through the couple's session and asks for its row back, so a refused write says so instead of re-rendering as saved.
- Guard: `lib/the-couple-can-pin-a-phase.test.ts` checks the resolver, runs the arrival door, checks that every face-picking site composes the pin, and checks that every loader SELECTS both columns. Sabotaging the loader select or the door turns it red.

⚠ A pin holds on the wedding day too. A couple who pins "Invitation" and forgets gets no day-of
layer until they switch back to Automatic. The panel says the date no longer moves it.

SPEC IMPACT: `registers/ONE_REGISTER.md` DAY-33 closed as built (corpus). No product decision changed: this implements the 2026-07-02 ruling.
