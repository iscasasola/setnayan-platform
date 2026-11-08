## 2026-11-08 · chore(train): train 2B — the finished PRs that conflicted with main, resolved on one branch (on top of train 2A; merge after train 1 and 2A)

Owner, 8 Nov: *"Make these go live now."* One merge commit per PR (`git merge --no-ff`), built on train 2A; generated maps and baselines regenerated once on the merged tree. Each carried PR keeps its own `changelog.d/` fragment.

- #7263 /for-suppliers wears the shared shell (its last two `origin/main` merges; the page itself already rides in 2A via #7328/#7269)
- #7378 a shop's anonymous name is built from its real city + services (migration)
- #7375 a one-line ⓘ definition for every service (migration)
- #7372 one free first booking per business, not per account (migration)
- #7292 a service they cannot use becomes Papic credits, or moves to their next event (migration)
- #7273 front page port of the 4 Nov prototype
- #7009 the group is a chatroom (train: the chatroom's ‹ People returns in place through `ReturnInPlace`, like `GroupBack`; its composer is a chat-composer template; "Take it down" under your own bubble joins the shared `useRevealOnOpen`; the hour-collage player is portalled to `<body>` like the shared Sheet; the group lab's poster stand-ins use one tint per person, inside the raw-hex ratchet)
- #7293 Live Watch venue connection check (migration; train adds the RESTRICTIVE `lh_ro_ins_*` limited-helper refusal on `live_watch_venue_checks`, the pattern of migration 20271251336140 §7 — INSERT only, since UPDATE/DELETE are never granted to `authenticated` and a policy for an ungranted verb can never fire. `cohosts-come-from-the-guest-list.db.test.ts` now counts a never-granted verb as refused; sabotage-checked: granting UPDATE or DELETE without its `lh_ro_*` policy turns it red)
- #7372 × the demo-scope trigger (`20271316355263`): its test 3 books the demo shop on a sample event, the only pairing the trigger admits

Not carried: #7268 (superseded by #7328) · #7035 (paused WIP).

SPEC IMPACT: None from the train itself. Carried PRs' own lines stand (see each fragment): #7009 DECISION_LOG 2026-10-28 "GROUPS AS A CHATROOM" → BUILT · #7292 DECISION_LOG 2026-11-05 "A SERVICE THEY CANNOT USE".
