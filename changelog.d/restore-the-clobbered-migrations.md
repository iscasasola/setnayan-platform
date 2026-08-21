## 2026-08-22 · fix(deploy): restore three applied migrations a stale branch deleted

🚨 **PRODUCTION HAS NOT DEPLOYED SINCE 2026-08-21 14:19Z.** Every merge since —
nine of them — built and tested green and then never reached the site. The owner
reported it as *"i do not see it"*.

**The cause is not any of those changes.** `deploy-prod.yml` applies migrations
and only then fires the Vercel deploy hook, so a migration failure means the
hook never fires. Vercel's own record shows it: the last production deployment
carries `deployHookName: migrate-then-deploy` and the commit from 14:19Z.

⚠ **I FIRST READ THAT WORKFLOW AS DORMANT AND SAID SO — THAT WAS WRONG.** Its
`DORMANT` notice is one branch of a guard; the deployment metadata is the
evidence, and it says the hook is what ships production.

🔑 **THE DRIFT: THREE MIGRATIONS ARE APPLIED IN PROD AND ABSENT FROM THE REPO** —
`20271154904649_five_hundred_papic_challenges` ·
`20271155852254_requests_do_not_linger` · `20271155952591_a_real_screen_up_to_twenty`.
All three were committed and merged normally, then **deleted** by
`aa39dc5a5` (PR #4700), a branch cut before they landed. `supabase migration
list` then prints them with an empty local column and the step fails.

⚠ **THIS IS THE SMALL HALF OF THE DAMAGE, AND IT IS DELIBERATE.** That same merge
removed **24 files and reverted 43 more**, wiping most of four already-merged
PRs (#4686 Papic Challenges · #4695 requests-do-not-linger · #4696 a column of
their own · #4699 pay-path). This change restores **only the three migrations**,
because that alone unblocks the deploy, touches no application code, and is
provably safe: the objects already exist in production, so the push is a no-op.
**The remaining 21 files and 43 reverted edits are a separate recovery** and are
named rather than quietly bundled — see the PR body.

🔑 **A MERGE FROM A STALE BRANCH DELETES WHAT LANDED WHILE IT WAS OPEN, AND CI
CANNOT SEE IT** — every check passed on that PR, because a repo missing a
feature is internally consistent. The only symptom was a deploy that stopped.

### The migration and its own guard are ONE unit

Restoring the three migrations alone failed, and the failure was the right one:
`papic-story-challenges.db.test.ts` refused the seeded set — *"the-place is a
side story and must carry {who}"*. **97 side stories are seeded and 45 do not
carry it**, so this was never one row.

🔑 **BECAUSE THAT GUARD WAS ITSELF ONE OF THE 43 REVERTED FILES.** The version on
`main` today is the one that predates the 631-challenge set; the version written
FOR it was wiped by the same merge. **A migration and the guard that describes it
travel together — restoring either alone produces a repo that contradicts
itself.** Restored from `953a9d49e^1`: **20 assertions, all green.**

### The exposure baseline was UNDERSTATING production

Regenerating adds exactly two facts —
`papic_challenge_library.event_types` (`anon=-`, authenticated read-only) and
`papic_challenge_pick_counts()` — and **both were verified to exist in
production already**, with `anon` confirmed unable to read the column.

⚠ **THIS IS A CORRECTION, NOT A WIDENING.** The baseline was generated while the
migrations were missing from the repo, so the committed file has been claiming a
smaller reachable surface than the live database actually has. A freeze file that
understates reality is worse than one that is out of date: it reports green over
objects nobody has reviewed.
