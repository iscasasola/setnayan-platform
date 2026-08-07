## 2026-08-07 · fix(deploy): production sat 35 app files behind and nothing said so

**Compound failure. Two reasonable mechanisms combined to strand production.**

1. The Supabase CLI broke `supabase link` (fixed in the previous change), so the
   deploy job failed for the four merges that carried app changes. It is
   fail-closed, so the Vercel production hook never fired for any of them.
2. The fix for **that** was CI-only. And `apps/web/vercel.json`'s `ignoreCommand`
   asked:

   ```
   git diff --quiet HEAD^ HEAD -- apps/web …
   ```

   — *"did the LAST COMMIT touch the app?"* The last commit was the CI-only fix,
   so the answer was no, and Vercel **skipped the build**. Twice: once on the
   merge, once when the deploy was re-triggered by hand.

🔑 **The rule answers the wrong question.** It should ask *"has the app changed
since what is DEPLOYED?"* Measured at the time of writing: `HEAD^..HEAD` showed
**zero** app changes, while the deployed commit `0bf1343b5` → `main` showed
**35 files, +939/−595**. Production was serving code from 10:39 while `main` had
moved four merges on — including the four-path Google-credential fix.

**Fix: `main` always builds.** Previews keep the fast path (and `claude/*`
branches keep skipping entirely). A production deploy that silently does not
happen is worth far more than the build minutes a doc-only merge to `main` costs.

⚠ **Tradeoff, stated:** doc/CI-only merges to `main` will now build. If that
proves expensive, the principled alternative is `turbo-ignore`, which asks the
Vercel API what actually shipped last instead of guessing from `HEAD^` — but it
is a bigger change and this one is provably safe in the direction that matters:
it can only cause an unnecessary build, never a missing one.

SPEC IMPACT: None.
