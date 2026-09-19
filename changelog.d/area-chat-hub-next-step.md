## 2026-09-19 · fix(event-hub): the "every reply is in" step opens the couple's page as a guest instead of reloading the controller (AREA-CHAT)

`resolveHubNextStep`'s `ready` branch — reached once every invited guest has
replied — carried `ctaPath: '/launch'`, the controller's own route. The page
renders that as `${base}/launch`, so the one primary button on the Event Hub
Controller ("Preview the day") reloaded the page it sat on. The step now carries
`ctaPath: ''`, which the page already renders as the couple's public address in
a new tab (the same door the day-of step uses), labelled "Open as a guest".

Guard: `lib/the-hub-next-step-never-points-at-itself.test.ts` executes the
resolver over the phases and guest states that reach all eight steps and asserts
that only "Try again" (the deliberate reload on a refused read) may name
`/launch`.

SPEC IMPACT: None.
