## 2026-09-20 · fix(dress-code): a role's outfit is a dress code — the section was deciding before it looked

Seen on a real event minutes after #5749 shipped. The couple set per-role outfits for ninong and
ninang and filled in nothing else — no title, no palette, no do/don't list. `hasAnything` was
computed WITHOUT looking at roles, so the section took its empty-state branch and told 38 sponsors
*"your hosts haven't shared the dress code yet"* while the answer for their own role sat in
`dress_code_config` unread.

Two lines: the personal answer is now resolved BEFORE the empty-state decision, and `mine !== null`
joins that decision. Nothing else moves — a reader with no role and an empty config still gets the
empty state.

🔑 The class, again: an answer that exists and never reaches the render. #5749 shipped with the
rule tested and the RENDER's precondition untested.

Guarded by a new case in `each-role-wears-its-own.test.ts` that pins the ORDER of the two
statements and the condition itself; reverting either turns it red.

SPEC IMPACT: None — repairs the 2026-09-20 per-role attire row.
