## 2026-07-27 · fix(security): ten policies said couple/host but were implemented member-wide — a guest had couple-level access

`current_event_ids()` has no `member_type` filter:

```sql
SELECT event_id FROM public.event_members WHERE user_id = auth.uid();
```

so it returns an event for a **guest** exactly as it does for the **couple**. 49 policies across 29 tables are written against it. Most are correct — they are named `*_member_*` and mean it.

**Ten were not.** Each is named `*_couple_*` or `*_host_*` — the author's own stated intent — yet resolved through the member-wide function, so an ordinary *invited* guest got exactly what the couple got. This is not a judgement about what a guest ought to see; it is an implementation contradicting the intent already written on it.

**The two that mattered most:**

- **`user_reports_couple_read`** — harassment reports, including `reporter_user_id`. **A guest reported for harassment could read the report naming them and identify their reporter.**
- **`coordinator_access_consents`** — both the SELECT policy *and* a `FOR ALL` write policy on the RA 10173 consent record `lib/coordinator-money-scope.ts` reads to authorise **checkout**. Any member could read it and grant themselves scopes.

Also narrowed: `couple_reads_setnayan_ai_guard_log` · `event_vendor_policy_acknowledgements_host_select` · `event_vendor_preferences_host_select` + `_host_write` · `guest_qr_rotations_host_read` · `vendor_guest_deliveries_couple_read` · `vendor_release_history_host_read` (note: scoped by `event_id_snapshot`, preserved).

**Why it is safe:** every one of these ten tables is reached only through the **service-role client** in application code (call-site audit), and service_role bypasses RLS — so narrowing cannot break a shipped path. The single non-admin reference in the set is an INSERT into `user_reports` (`lib/chat-actions.ts`, a user filing a report); no INSERT policy is touched. The exposure-surface diff is 10 lines, each exactly `current_event_ids()` → `current_couple_event_ids()` on the same policy — a pure narrowing with nothing else moved.

**⚠ SIX MORE ARE UNRESOLVED, NOT APPROVED — and they need an owner ruling, not an engineering guess.** `booking_handovers_couple_read` · `event_access_requests_host_answer` + `_host_read` · `event_appointments_couple_read` · `event_song_picks_host_select` + `_host_write`. All are named couple/host and all still use the member-wide function, but each is reached by **non-admin** client paths whose caller role could not be established confidently from a call-site read — `event_appointments` has nine such sites including shared helpers (`lib/upcoming-items`, `lib/preparation`), and `event_song_picks` runs through `lib/songs.ts`, which serves both couple and guest surfaces. Narrowing on a guess risks breaking a live flow. The open questions: **may a guest see the couple's vendor appointments? may a guest see or change the couple's song picks? who may answer an access request — only the couple, or the vendor floor-command surface too?** They are pinned in a shrink-only `KNOWN_BROAD` list (ceiling 6) with a reason each.

**⚠ `current_event_ids()` itself is deliberately unchanged.** Narrowing the function would move all 49 policies at once, including the `*_member_*` ones that MUST keep returning guests. Its comment now records the rule.

**The durable part** — new `tests/db/couple-host-policy-scope.db.test.ts` (7 cases) encodes the naming invariant rather than the one-off fix: **T1** fails if any *new* policy is named couple/host and wired to the member-wide function, so the class cannot come back; **T1b** keeps `KNOWN_BROAD` shrink-only and reason-carrying, and fails when an entry goes stale; **T2–T4** prove the behaviour (a real invited guest cannot read harassment reports or read/write the consent record, while the couple still can); **T5** is the counterweight proving no over-narrowing — a guest still reads the `*_member_*` surfaces (`event_checklist_items`, `events`); **T6** is a NEUTRALISATION case that restores the member-wide predicate and confirms the guest regains access, so a green suite means the narrowing is what is doing the work.

Verified: new suite 7/7 · full `test:db` **549/549** · exposure baseline regenerated (10 lines, all narrowings). ⚠ Production build not run locally (SIGTERM-killed on this machine — 7 GB requested heap vs ~2.5 GB free; a control build of unmodified `main` fails identically), so that check rests on CI.

SPEC IMPACT: None — no product behaviour changes for the couple. Guests lose access they were never intended to have.
