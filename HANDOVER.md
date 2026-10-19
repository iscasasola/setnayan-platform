# HANDOVER — rd/seat-attire-follows-the-role (2026-10-20)

Owner: "the attire depends on the dress code of their role."

Done (code): lib/guest-outfit.ts (guestOutfitOf · guestOutfitWords · seatPlanOutfitOf), guestMeFacts uses it,
card Seat fold = K.Fact line (no attire pick), 3D lab + demo dress from it, updateGuest writes attire only when posted.
Guard: lib/the-seat-plan-wears-the-role-dress-code.test.ts.

Left: install (heavy lock queue) → run targeted tests → regenerate card golden (UPDATE_GOLDEN=1) → sabotage runs →
375 shots before (origin/main) / after via /dev/guests-lab?part=card&title=atty&gender=woman&dress=1 → corpus
DECISION_LOG row → draft PR + do-not-auto-merge → CI loop. Delete this file when CI is green.
Walk folder: ~/Documents/Claude/Projects/shots-2026-10-20/seat-attire-follows-role/work/
