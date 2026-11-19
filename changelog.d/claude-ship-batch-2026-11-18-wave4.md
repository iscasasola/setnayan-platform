## 2026-11-19 · chore(ship-batch): wave 4 — #7841 #7933 #7875(+#7793)

One integration branch: merges three owner-OK'd, Opus-reviewed (SHIP) PRs onto main, then regenerates every
generated file once. #7957 and #7964 already reached main on their own (18 Nov), and #7678 was dropped from
this wave so it ships only through #7678. Also one ratchet fix on #7875's `renewal-state-card.tsx`: the
"bookings carry on" phrase is now built in a `const` above the JSX. The rendered copy is unchanged, and
`vendor-dashboard/shop` stays at its template baseline.

SPEC IMPACT: None (the member PRs carry their own fragments and spec notes).
