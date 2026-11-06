## 2026-11-05 · fix(act-first): the owner's 5 Nov rulings on the small "act first" items

From DECISION_LOG 2026-11-05 "THE 15 'ACT FIRST' ITEMS (APP DIGEST UPDATE 5 NOV), RULED ONE BY ONE".

- **#4 battery handoff QR — retired.** The Papic camera help no longer describes a battery-low handoff QR (nothing like it exists).
- **#9 no email, only notification.** The four Live Watch lines that said "we'll email you the moment it's ready" (setup page ×2, controller ×2) now say "you'll get a notice in Setnayan". Copy only: readiness comes from deploy-time YouTube OAuth settings, not a per-event moment, so there is no natural place to send a notice from.
- **#10 old "Mark highlight" — retired.** Button, toast and the stub `markHighlight` (which wrote nothing) removed from the older control room. The newer controller's real highlights are untouched.
- **#11 Live Studio confirm before go-live.** Every Go live button (controller, Home's Live card, setup card, older room) now asks "Go live now?" first, from one shared `lib/live-studio-go-live-confirm.ts`; `live-studio-go-live-confirm.test.ts` fails if a go-live caller skips it. Copy says nothing about money — since LS6 the unlock is once per event with no clock. No admin undo was built: `releaseChannel` only returns a stuck pool channel; there is no paid day left to give back.
- **#13 team service-credit pool — retired.** `grant_team_pool` is no longer offered or executed (old rows still read "Team Pool eligibility (retired)"); the Team Pool accounts filter is gone; "pool" labels read "team member". `users.is_team_member` is kept — it is staff admin access. The § 9.1 "adding a team member to the shared pool" row is REMOVED (owner 2026-11-05: *"no remove it."*) from the two-admin list and the admin help article. A single admin may still set the team-member flag (owner: *"no. admin has power."*).
- **#14 venue screens copy.** The cameras page no longer says a screen can't be paired; it points to Venue screens in the controller (`#screens`).
- **#15 day-of desks free.** New `FREE_SPECIALIZATION_SETS = {floor_command}`: any booked coordinator holds cue-the-show, the requests inbox and the seat scanner with no Solo plan. Song desk and Script & cues keep the Solo floor.
- **#5 seven "soon" supplier benefits — retired** from the plans list. The computed benefit count drops from 99 to 92; the stale "84 … = 102" comment is gone.

Note for the corpus: the 2026-11-04 "DAY-OF DESKS STAY FREE" row says "no code change needed" — true for the console, false for the specialization gate (an unset free-until date means no window there). This PR is that code change.

SPEC IMPACT: `Setnayan-specs` commit 654b9fc — `01_Contracts/Setnayan_Vendor_Agreement.md` § 9.1 loses the team-pool row (now eight major decisions), § 10b carries a RETIRED banner, `.docx` regenerated; DECISION_LOG row 2026-11-05 "TEAM POOL FOLLOW-UPS". Reason: owner rulings on this PR's two questions.
