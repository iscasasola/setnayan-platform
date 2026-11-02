## 2026-09-20 · fix(supplier): every action on a client lands on the panel that reports it

PR #5736 fixed the two DEPOSIT answers the owner caught live ("clicked confirmed
and it just bounced to the chat page"). The same defect was in twenty more
places, and `NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED` is `"true"` in
production — so a tab-less landing on `/vendor-dashboard/clients/<eventId>` is
forwarded to the conversation, which reports nothing about what just happened.

Fixed in `apps/web/app/vendor-dashboard/clients/[eventId]/actions.ts` (22 call
sites) plus the five sibling page bails (`production-sheet`, `challenge-photos`,
`seat-plan`, `mood-board`, `cocktail`):

- `?completed=` (mark service complete, and its "not your booking" bail) →
  **Details** on the live shell, **Overview** with the flag off
- `?tab=activity` on the three private-note actions → **Details** / **Activity**
- `?handover=` ×6, `?change_order=` ×3, `?change_order_resp=` ×2, `?suggest=`
  → **Schedule** on both shells
- `?tab=quote&ask=` ×4 → **Quote & Payments** on both shells (unchanged
  destination, now built by the rule so nothing can quietly drift off it)
- the `createVendorChallengeAction` bare redirect → **Details** / **Overview**

🔑 **A TAB IS NOT ENOUGH — three of these already carried one.** The page renders
TWO shells whose tab vocabularies share only `quote · files · schedule`, so
`?tab=activity` is a real tab on the flag-OFF Customer Card and an unknown id on
the live RelationshipTabShell, which drops the supplier on its first panel
(Quote) while the note they just wrote sits on Details. A tab-shaped wrong
answer is the same failure in a new costume. `lib/vendor-client-return.ts` now
names the SURFACE (`asks · delivery · notes · completion · brief`) and resolves
the word each shell uses, via `vendorClientSurfaceHref`.

Also: **`?completed=1` was read by nothing at all.** It has been redirected with
since the completion handshake shipped, and no component in the tree ever looked
at the word — the supplier landed on the right card and was still not told. Both
mounts of `VendorCompletionCard` now render it, plus a `notyours` failure notice
where there was previously silence.

Guarded by `apps/web/lib/every-client-landing-names-a-tab.test.ts`, which walks
every file under `app/`, prints what it scanned and found, and asserts zero
hand-built client-page redirects (0 of 2,334 files; 27 rule-built landings). It
also re-reads both tab vocabularies from their own source files, checks each
surface against the shell it is aimed at, and pins each notice to the panel that
draws it. Sabotage-proven three ways: restoring one literal redirect (2 tests
red, offending line printed), pointing a surface at a tab its shell lacks, and
removing the notice from one of the two completion mounts.

One assertion in `lib/the-confirm-lands-where-you-pressed-it.test.ts` was pinned
on the exact text of an import line and went red when a second symbol joined it;
it now asserts the property (the symbol comes from the rule module) instead of
the phrasing.

SPEC IMPACT: None.
