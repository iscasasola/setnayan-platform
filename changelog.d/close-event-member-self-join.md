## 2026-07-27 · fix(security): close the open self-join on `event_members` — a live privilege escalation reaching 29 tables

**Any authenticated account could insert itself as a `guest` of ANY event** — no join token, no invitation, no couple approval, no relationship of any kind. `member_can_self_join` was `FOR INSERT TO authenticated WITH CHECK`:

```
((user_id = auth.uid()) AND (member_type = 'guest')
  AND (guest_id IS NULL) AND (vendor_id IS NULL))
OR (event_id IN (SELECT current_couple_event_ids()))
OR is_admin()
```

The **first disjunct never constrains `event_id`**. On its own that is a nuisance; what makes it an escalation is `current_event_ids()`, which has no `member_type` filter — so one forged row promotes the attacker into every `event_id IN current_event_ids()` predicate in the schema.

**Measured against production 2026-07-27: 47 policies over 29 distinct tables** (29 SELECT · 8 UPDATE · 6 INSERT · 3 ALL · 1 DELETE). In RA 10173 terms the reachable set includes `events` (both partners' birth dates, budget, venue coordinates), `households` (guest names + postal addresses), **`user_reports` — harassment reports together with the reporter's identity, readable by the person reported**, `coordinator_access_consents` (the consent record `lib/coordinator-money-scope.ts` reads to authorise CHECKOUT — writable *and* deletable), and `patiktok_source_clips` (another guest's media, repointable at an arbitrary object).

**The fix is a drop, and it costs nothing.** Every membership write in the app goes through the service-role client, which bypasses RLS — **14 mutating call sites, all `admin.from('event_members')`** (join/accept · create-event ×2 · the three onboarding paths · guest-claim link · autosurface · account-link · the delete/update paths). The one database function that inserts memberships, `finalize_guest_claim`, is `SECURITY DEFINER` and likewise unaffected. Legitimate joining is gated in those server actions, where the token is actually validated — which is where the check belongs, since RLS cannot see a QR token.

The couple's own legitimate INSERT (the dropped policy's *second* disjunct) is preserved as `couple_can_add_member`. The exposure-baseline diff proves the swap is a narrowing rather than asserting it: old check `A OR B OR C` → new check `B OR C`, with the unconstrained branch simply gone. Reads are untouched — `member_reads_membership` still lets a member see their own row.

**⚠ `current_event_ids()` is deliberately NOT narrowed.** Adding a `member_type` filter would change the meaning of all 47 policies at once, and legitimate guests are exactly the rows it must keep returning. Closing the entry point is the surgical fix; the function's breadth is a separate design question that should not ride along with a security patch.

**Credit: this was found by an uncommitted test, not by review.** `tests/db/t3-open-self-join.db.test.ts` — a T3 RA 10173 privilege audit written in an earlier session — documented the hole by asserting the attack *succeeded*, and sat **untracked** in the working tree where CI would never run it. Six of its seven attack assertions were still passing against the current schema. New committed suite `tests/db/event-member-self-join.db.test.ts` (10 cases) inverts it: the self-join is refused (plus three shape variations), the couple can still add members to their own event but not to an event they do not own, a member still reads their own row, the downstream reads/writes are all denied, and a **NEUTRALISATION** case re-creates the dropped policy to prove the suite measures the policy and not the harness. ⚠ The old audit file is now SUPERSEDED — its 8 attack assertions fail precisely because the hole is closed. It should be deleted; it is untracked, so it does not run on CI.

Verified: new suite 10/10 · full `test:db` **490/498** — the 8 failures are all the superseded untracked audit file · typecheck clean · lint clean. ⚠ Production build not run locally (SIGTERM-killed on this machine — 7 GB requested heap vs ~2.5 GB free; a control build of unmodified `main` fails identically), so that check rests on CI.

SPEC IMPACT: None — no product behaviour changes. Membership was already minted exclusively by server actions; this removes a client-side path nothing used.
