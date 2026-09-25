## 2026-09-25 · fix(event-hub): the active Maker bar item stays in view when the window resizes

Follow-up to #5974. Measured in a real browser at 768 and 1024: after a resize, the active bar pill
sat past the scrolled edge. The scroll-into-view that runs when the Maker opens and when the
selection changes now also runs on resize. Logo, Details and Prints & Tickets were already reachable
at 375, 768, 1024 and 1440.

SPEC IMPACT: None.
