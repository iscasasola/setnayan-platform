## 2026-09-06 · fix(guests): the quick view's Remove takes a second, deliberate tap

The quick view gained a Remove earlier the same day. It shipped as ONE unguarded
tap on a full-width danger button sitting directly beneath the full-width "Open
full details" button — two stacked full-width targets, the lower one
destructive, on a panel a host opens casually while scanning a roster.

Every other delete path in this feature already had a guard, and this one had
none:

| Path | Guard |
|---|---|
| mobile swipe-to-delete | the swipe IS the confirmation (iOS-style) |
| desktop bulk delete | optimistic remove + 6s undo snackbar |
| quick view | *nothing* |

**And it is the least undoable of the three.** `softDeleteGuest` soft-deletes the
guest (`deleted_at`, recoverable) but HARD deletes their
`event_seat_assignments` row first. The desktop bulk path captures the released
seats so its undo can put them back; this single-guest path does not. A mis-tap
cost the seat placement permanently even when the guest themself was restored.

The button now arms on the first tap ("Tap again to remove"), submits on the
second, offers Cancel, and disarms itself after 4s so an armed delete cannot lie
in wait after the host scrolls away. Two taps rather than a dialog: the panel is
already an overlay, and stacking a modal on an overlay is where focus management
goes wrong — the sheet's own `useModalA11y` would be fighting a second trap.

The action, its gates and the couple branch are unchanged; only the number of
taps in front of them moved. Guarded by the existing
`the-quick-view-can-act.test.ts`, extended — the assertions FOLLOW the action
into its new file rather than pointing at the body, which would have gone green
by finding nothing. New mutations: making the resting button a submit (first tap
deletes) → RED; dropping the auto-disarm timer → RED.

Suite 56/56 · route-scoped `tsc` exit 0 (run after the last edit,
sentinel-confirmed) · `lint-server-only-boundary` clean ·
`modal-a11y-adoption` 2/2.

SPEC IMPACT: None.
