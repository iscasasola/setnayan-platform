## 2026-08-29 · fix(admin): the Papic tab is only the credit ladder and the Thank You video

Owner 2026-08-29, on the shipped Papic tab: *"free credits should be here. with
the rest of papic services and the thank you video."* Then, narrowing it after
seeing it live: *"papic is only the papic shot prices and the thankyou. so the
rest should be removed."*

An earlier build of this session also drew the four switched-off
`PAPIC_CAMERA_*` per-day rates on this tab, reasoning that two of them still
price a live purchase despite being off sale. That reasoning is true of those
rows, but it does not make them belong on THIS tab — the Papic tab is Papic's
credits, not every Papic-prefixed row in the catalogue.

### What changed

`otherPapic` on the Papic surface now selects exactly `PAPIC_ADDON_THANK_YOU`,
not "everything that is not a rung." The free-credits cell stays, as asked. The
now-unreachable "still charges" plumbing (`stillCharges` field, its banner, its
tag branch) is removed from `PapicRestEditor` rather than left dead — with only
one product left on the tab, that state can never fire.

### What did NOT move

The four camera rates are neither deleted nor hidden. They remain exactly where
every other switched-off price lives — the main Pricing tab's "Switched off"
shelf, tagged "Still wired" — and stay editable there through the ordinary row
card. Only their second appearance, invented for the Papic tab, is gone.

### Verification

`tsc` exit 0 · `lint-port-no-lost-controls` 410 routes / 1,494 controls / 4,144
blocks — nothing lost · unit suite already green on this exact file content
(11,454 pass / 0 fail, verified before this diff moved branches).

SPEC IMPACT: None — no price moves, no product changes, no capability removed.
