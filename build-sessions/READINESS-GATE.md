# READINESS GATE — what must be true before the Redesign group builds unattended

> Owner, 2026-09-22: *"we want everything ready first before we start building autonomously. to make
> sure everything will render and deploy properly"* · *"you tell me from this session if there is
> anything i need to prepare first that you cannot do."*
>
> Every line below was measured at 03:00–03:05 UTC against `origin/main` **1915ce9f5**.
> **All Redesign building is HALTED.** Both active sessions were stopped mid-build.

---

## 1 · The deploy path is HEALTHY — measured, not assumed

| check | result |
|---|---|
| `deploy-prod` last 8 runs | **8 × success** |
| what production is serving | `1915ce9` — **exactly `origin/main`**, no drift |
| prod migration ledger vs `origin/main` | **1474 rows · 1474 files · 1474 in sync — no orphans** |
| `/api/health` | `{"ok":true,"region":"sin1","env":"production"}` |

Nothing is stuck. The pipeline that stranded seven PRs on 2026-09-02 is clean today.

## 2 · 🔑 THE RENDER PROBLEM — found, explained, and it needs NOTHING from the owner

**No Redesign branch can ever produce a Vercel preview, and the reason is one line in the repo.**

`apps/web/vercel.json`:

```
"ignoreCommand": "case \"$VERCEL_GIT_COMMIT_REF\" in claude/*) exit 0;; main) exit 1;; esac; cd \"$(git rev-parse --show-toplevel)\" && git diff --quiet HEAD^ HEAD -- apps/web packages/shared …"
```

Vercel treats **exit 0 as SKIP** and **exit 1 as BUILD**. So:

| branch | exit | result |
|---|---|---|
| `claude/*` — **every branch this group uses** | 0 | **build SKIPPED** |
| `main` | 1 | build |
| anything else touching `apps/web` | 1 | **build — a real preview** |

**PROVEN, not reasoned.** I pushed a throwaway branch `rd/preview-probe` with one file added under
`apps/web`. Vercel started deployment `dpl_7Cy4hHC36Mh5wvobWQRo6tJReS8X`, **state BUILDING, target
`null`** — a preview. A `claude/*` branch on the identical tree reports "Canceled by Ignored Build
Step".

**The preview is live and reachable:** `https://setnayan-platform-8e8t1usyx-icasa-offroad.vercel.app`
returns HTTP 302 to Vercel SSO — i.e. it is deployed and served, behind Vercel's deployment
protection. **You can open it because you are signed in to Vercel. I cannot, and that is correct** —
previews stay private.

⇒ **The fix costs nothing and needs no owner action: name wave branches `rd/…` instead of
`claude/…`.** Nothing else in the repo keys on the `claude/` prefix — I grepped every workflow and
script; the only match is an unrelated absolute path in a generator comment.

⚠ **Two corrections to what was reported earlier in this session**, both of which would have sent
someone to the wrong place:
- A session concluded "there is no `vercel.json` in the repo — it is a project-side setting". There
  **is** one, at `apps/web/vercel.json`, and it is the cause.
- The same session recommended the owner verify locally or merge blind. Neither is necessary.

🔑 **"Verify against production after the change serves" is in the charter and was read as a rule.
It is a symptom.** The project had no previews, so production was the only place to look. That is
now a choice rather than a constraint.

## 3 · 🛑 WHAT ONLY YOU CAN DO — I tried each of these and failed

### 3a · Blocking — the group cannot be proven ready without these

| # | what | why I cannot |
|---|---|---|
| **O1** | **Confirm the env vars are set in BOTH scopes** — production AND **preview**. At minimum `RESEND_API_KEY` (no email sends without it, silently), the Supabase vars and the R2 vars. | The Vercel API returns **403 Forbidden** on project env vars for this token, and the CLI is not linked. I can read neither the values nor the set/not-set list. **Absence and unreadable look identical from here.** |
| **O1b** | **The preview scope specifically.** ⚠ I proved a preview BUILDS and reaches **READY**. I did **not** prove it RENDERS WITH DATA. If the Supabase / R2 / Resend vars are missing from the **preview** scope, a preview serves 500s that look exactly like our own bug — and every "look at the preview" check below becomes worthless. 🔑 **A build that reaches READY has not been shown to render.** | Same 403. Found by the ONE DOOR session, which caught the hole in my own claim. |
| **O2** | **Look at one preview and say whether it renders.** Once wave branches are `rd/…` there is a URL — proven today. | **Two** doors I cannot pass. The preview itself sits behind Vercel SSO (yours, and it should stay that way). And the pages in this wave sit behind an app sign-in, which needs a password I will not enter. |
| **O3** | **Answer the 5 product decisions** in `WAVE-PLAN.md` §4. Three of them each unblock an idle session. | They are yours. |

### 3b · Not blocking this wave, but you carry them alone

| # | what |
|---|---|
| O4 | The launch list, still open from earlier sessions: captcha on · Supabase Pro (backups are not downloadable and the project can be paused) · R2 bucket versioning on all four buckets · clickwrap vs browsewrap · `dpo@` inbox · uptime and Sentry alerts. |
| O5 | `supabase migration repair`, if a ledger orphan ever appears. **Deliberately owner-only** — a session must never run it. Healthy today. |
| O6 | Dependabot: GitHub reports 2 moderate vulnerabilities on the default branch. |

### 3c · Decisions about the tooling, where I have a recommendation

| # | question | my recommendation |
|---|---|---|
| D1 | Should `claude/*` keep skipping previews? | **Leave it.** It exists to save build minutes across dozens of throwaway branches, and it is doing that. Use `rd/…` for the small number of branches you actually want to look at. |
| D2 | Collapse the 7 in-flight PRs into one merge? | **No.** Seven rebases and seven CI runs to save six merges, with the sign-up conflict forced to resolve under pressure. One-merge starts with the next wave. |
| D3 | Event Overview's #5874 — merge blind, verify locally, or drop the slice? | **None of the three.** Re-cut it onto an `rd/…` branch and look at the preview. The question was framed before the preview mechanism was understood. |

## 4 · What is still unresolved in the code, and is not yours

- **#5867 × #5872 conflict** on `apps/web/app/signup/actions.ts`, in either landing order. One must
  rebase; both changes must survive (a terms gate and an email-confirm gate). This also blocks two of
  the three approved ONE DOOR builds.
- **#5866 was red**; the fix is pushed and CI is running.
- **The chat frame** is owned by the Event chatbox session, which is the only one of the seven that
  has not enrolled. Two sessions wait on it, and it has inherited two requirements from other
  people's decisions that it cannot discover from its own brief: the quote card replacing the
  offered card in the thread, and the thread-page read that was wrongly scoped into the quote maker.

## 5 · Nothing in the chat or quote work can be verified by looking at anything

`select inquiry_status, count(*) from chat_threads group by 1` → **one row: `accepted`, 3 threads.**
`pending`, `declined`, `displaced`, `withdrawn`, `expired` — **zero rows.** No proposal has ever gone
through the composer the quote maker is redesigning; the supplier's Accept/Decline block has never
rendered for a real inquiry.

So for that area there is **no preview to look at and no production data to look at**. Fixtures or
db-tests are the only evidence that will ever exist, and "it looked fine" is a claim about one state
out of six. This is a gate on the wave, not a nicety.

## 5b · HOW WE PROVE A BUILD RENDERS, without a human clicking six states per session

Adopted from the ONE DOOR session, whose framing was better than mine: **a scripted walk, not a look.**

The repo already ships Playwright (`apps/web/playwright.config.ts`, `tests/e2e/health.spec.ts`), so
this costs a spec and not a framework. Against the wave's **preview URL** (now obtainable, via an
`rd/…` branch), one spec per surface asserts the states that can be wrong — not that the page loaded.

Worked example, the `/open-shop` walk, signed out: a short password refused **on step 3** · an email
that already has an account refused there **with the typed shop name still in the box** · no pin
refused at step 4 · unticked Terms refused at step 4 · the happy path landing signed in · "Sign in"
opening the popup and step 3 losing its password field while the shop name survives. Then a row
check, then delete the throwaway account.

**What this still cannot prove, and needs the owner once:** the OAuth leg. Playwright cannot log in
to Google, so the Google consent round trip and the draft being restored afterwards needs one human
tap on the preview.

## 6 · Clean-up owed by this session

`rd/preview-probe` and its preview deployment are mine and throwaway. **Delete the branch once you
have seen the preview URL work.**
