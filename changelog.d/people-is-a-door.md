## 2026-08-14 · fix(front-door): People is a door, not a "coming soon" notice

The rail carried **"People · coming soon — waiting on a legal review"**. Both
halves were wrong.

`/dashboard/people` ships, and its **Samahan section works today** — a person
can create a group, invite by link, and see its members right now. The notice
hid a shipped feature on the one surface built to lead people to it.

What is genuinely still to come is the **connections** half (family ·
godparents · friends), and the page's own copy already scopes the claim to
exactly that. It was corrected there once before for the same reason — the
wider sentence ("nothing to do on this page yet") was false for anyone holding
a samahan, and the owner read it. **The rail never got that correction.**

🔑 **A COMING-SOON LABEL IS A CLAIM ABOUT A WHOLE SURFACE.** Scope it to the
unfinished part, or delete it. Never let it cover a shipped feature standing
beside the unfinished one.

🪤 **A dangling registry key would have looked like a mechanism.** Every other
account row reads its label through the nav registry so an admin rename reaches
desktop and phone alike. There is no `customer.account.people` slot, and
`slotLabel` **fails open** on a miss — so passing that key would have rendered
correctly forever while quietly never being renameable. The row uses a plain
label and says why, with the order to fix it: registry entry first, then the
line.

Guard: `people-is-a-door.test.ts` — 4 assertions, comment-stripped so the prose
naming the retired notice can neither hold it green nor turn it red.
Mutation-proved 3/3, occurrence counts printed before → after.

SPEC IMPACT: None (`DECISION_LOG.md` 2026-08-14 already records the ruling).
