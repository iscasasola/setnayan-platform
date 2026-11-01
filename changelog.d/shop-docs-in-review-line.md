## 2026-10-31 · fix(supplier-dashboard): documents in review say so again, on the Shop ⚙

PR #7124 moved Verification and documents off Shop › Details into the Shop ⚙ and lost the old "Your documents" fold's
"Setnayan is checking your documents" line and its status badge, so a shop in review read only a count. Owner: "Come back
to shop." The Shop ⚙'s Verification and documents row now draws the same words and the same `Checking` badge, only while
the documents are in review, from the same Details read (`docsRow`). No migration, no new action, no new read.

SPEC IMPACT: None
