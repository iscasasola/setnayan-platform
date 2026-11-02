## 2026-07-17 · feat(samahan): remove the kind taxonomy — groups are just names (owner-locked) + RA 10173 disclosure fixes

**Owner 2026-07-17: "remove parish … there is no specific samahan — they just name the group."** The whole kind classification (barkada/parish/clan/org/other) is removed, not just the parish option. Privacy by design: the structured 'parish' kind made membership a religious-affiliation signal (RA 10173 §3(l)-adjacent) that the platform had no need to hold. A free-text name the group picks is the group's own speech; a classification column was ours. With the column gone, no query, export, or breach can ever enumerate "members of parish-type groups."

- Migration `20270819300000` (applied to prod — table was empty, zero data loss): drops `communities.kind` + its CHECK; table comment records the no-classification rule.
- Code sweep: `CommunityKind`/`COMMUNITY_KINDS`/`COMMUNITY_KIND_LABEL`/`isCommunityKind` deleted from `lib/communities.ts`; kind picker removed from the create form; kind chips removed from the samahan list, detail header, join-invite card, and the People-page samahan rows; peek copy updated ("you name them").

**Bundled RA 10173 disclosure fixes (from the 2026-07-17 gap audit):**
- `/privacy` gains a **"Samahan (groups)"** section: what's stored (chosen name · optional description · role · joined date), the no-classification promise, and member-visibility scope.
- The data export ships **`samahan_memberships`** (group name · role · joined_at).
- Year view: a claimed profile no longer nudges its own person ("your alaga's debut" ≠ your own debut); a former guardian's history rows still nudge.
- People list: a claimant's own row now reads **"You"** instead of the guardian's relationship word ("Child").

Tests 9/9 · typecheck clean · prod column drop verified.

SPEC IMPACT: DECISION_LOG.md 2026-07-17 row (samahan = unclassified named groups; kind taxonomy removed; NPC dossier ROPA line for samahan memberships still owed — flagged to owner/DPO)
