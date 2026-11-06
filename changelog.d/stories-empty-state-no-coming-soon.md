## 2026-11-03 · fix(supplier): the empty Stories page drops its "Coming soon" tag

Supplier go-live audit (2 Nov, minor). `/vendor-dashboard/real-stories` is a working page that is empty until a couple publishes — its empty state wore a literal "Coming soon" tag and promised editorials "with the wedding season ahead". Now: "Your featured events will appear here." and one line saying when. Guard `app/vendor-dashboard/real-stories/the-empty-state-promises-nothing.test.ts`.

SPEC IMPACT: None.
