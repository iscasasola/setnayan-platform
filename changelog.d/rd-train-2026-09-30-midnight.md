## 2026-09-30 · fix(train): midnight train — the sideless-event guard counts the Access column

Merge train for the 2026-09-30 RSVP & Invitation release. #6198 (a sideless event draws no Side column) pinned the guest table's section and self-join `colSpan`s at `hasSides ? 9 : 8` / `hasSides ? 7 : 6`; #6191 adds an Access column beside Role on every event, so on the folded tree the spans are `hasSides ? 10 : 9` / `hasSides ? 8 : 7` (10 header cells with Side, 9 without). The guard now pins those. Conflicts resolved in the fold, both intents kept: the "signing out erases your selfie" line (#6195) now lives inside the shared `signOut` element (#6197), so it shows on the Me tab too; the guest table keeps `hasSides` (#6198) and uses the new access props (#6191).

SPEC IMPACT: None
