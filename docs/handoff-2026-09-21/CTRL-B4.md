# CTRL-B4 — THE INVITATION ACTUALLY REACHES A GUEST

**Model · effort: Opus · high.** The largest single gap on the couple's side.

```
cd ~/Documents/Claude/Projects/setnayan-platform && claude --model claude-opus-5
```

**Read first:** `build-sessions/BUNDLE-COMMON.md`, then `build-sessions/AREA-AUDIT-TEMPLATE.md`.

**One branch, one PR, three commits.** Branch from `origin/main`.

⚠ **COORDINATE BEFORE YOU START.** A live session is working on the guest list (PRs around
`claude/guest-list-three-fixes`) and another on people/name search. Run
`gh pr list --state open --limit 40 --json number,title,headRefName` and `git worktree list` first,
and read anything touching `apps/web/lib/guests.ts` or the roster components. **Do not edit files
they hold.** If there is real overlap, say so and stop rather than racing them.

---

## The measured problem

142 guests exist. **2 have an email address. 1 has a mobile number.** There is no invitation send
path of any kind, and no bulk "mark as given" — so a 142-name list is 142 individual toggles, and the
Invite step of the couple's checklist can never complete.

```sql
select count(*) total,
       count(*) filter (where email is not null) with_email,
       count(*) filter (where invitation_sent_at is not null) marked_sent
from guests;
```

**What already exists — find it before building anything (RULE 0):**
- `markGuestInvitationSent` in `app/dashboard/[eventId]/invitation/actions.ts` — the guest writer.
  **It exists and works.** The gap is volume, not the writer. Do not rebuild it.
- `fanOutSaveTheDateEmails` in `lib/save-the-date-emails.ts` — the save-the-date already fans out
  emails. **Read it first; it is the shape to follow, and possibly to extend rather than duplicate.**
- Every guest already holds a `qr_token`.
- Email is live: `RESEND_API_KEY` is set and 20 deliveries have been accepted.

State, in one line each, **what exists · what is missing · the delta you will build** before you
write code.

---

## Build in THIS order. The order is the cut line.

### 1 — Bulk "mark as given"
The cheapest real relief and the safest place to start. A couple hands out printed invitations; today
they must click 142 times.

- Select a set of guests and mark them sent in one action, with an undo.
- ⚠ **A zero-row UPDATE is success-shaped.** Add `.select()` and count the rows before the screen
  says it worked. Report the number actually marked, not the number requested.
- ⚠ A refused write must not leave the screen unchanged and silent — 73 couple-dashboard reads
  already swallow their errors; **do not add the 74th.** The shape to copy is
  `apps/web/lib/guests.ts` + `guests-read-is-honest.test.ts`.
- **Property:** the count shown equals the count written, and a refusal says so.

### 2 — Send an invitation by email
For the guests who have an address. This is the step that lets "N to send" ever reach zero.

- **Extend the save-the-date fan-out rather than writing a second mailer** unless you can show why it
  cannot serve. Two mechanisms for one fact is a defect this repo has been bitten by before.
- The notification type must be on `EMAIL_ENABLED_TYPES` in `lib/notification-emit.ts`. **The
  notification and the allowlist are two halves of one mechanism — having one is indistinguishable
  from having neither.** Assert both in one guard.
- Record the send so `invitation_sent_at` advances through the existing writer.
- ⚠ `sendEmail()` returns `{ok:false, reason:'not_configured'}` and no-ops when the key is missing.
  **A send that quietly did nothing must not mark a guest as invited.**
- **Property:** a guest is marked invited only if a send was actually accepted; a failed send is
  visible to the couple and retryable.

### 3 — Say the truth about who cannot be reached
With 2 addresses out of 142, a screen that reports "invitations sent" is a lie of omission. The
couple must be able to see, in one place, **who has no way to receive one** — that is what turns an
empty result into an action they can take.

- **Property:** the unreachable count is shown wherever the sent count is shown. A guard should hold
  that the two are rendered together, so a later change cannot drop one and keep the other.

---

## Do NOT build here

- SMS. **No SMS in V1** — email only, via Resend. Locked decision.
- A new guest-import path, a new roster, or anything the live guest-list session is holding.
- Anything that needs a migration, unless you can show no existing column encodes it. **A flag or
  filter flip beats new schema** — check `invitation_sent_at`, `std_sent_at`, and the existing
  `guests` columns first.
- If you do need a migration: allocate forward with `pnpm migration:new`, land it through the
  pipeline, and **never apply it directly to production.** The Ugat map must keep up — two db-tests
  enforce it and will tell you.

## Files this bundle may touch

`apps/web/app/dashboard/[eventId]/invitation/` · `apps/web/lib/save-the-date-emails.ts` ·
`apps/web/lib/notification-emit.ts` · the invitation step's checklist reader · new guards + one
changelog fragment.

**Not** `apps/web/lib/guests.ts` or the roster components without checking with the guest-list
session first.

## Before you push

`git diff --stat origin/main...HEAD` and read every file. An unintended deletion — especially of a
helper a recent PR added — means a restore loop wrote over your merge. CI cannot see it.

## Report

Per build: done or dropped · the property the guard holds · the sabotage you watched go red.
Say plainly whether a real invitation can now reach a real guest end to end, or which link is still
missing. **Nothing here has ever run in production — "it should work" is not a verdict.**
