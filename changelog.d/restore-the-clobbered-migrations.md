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
