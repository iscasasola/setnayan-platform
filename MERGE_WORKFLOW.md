# Merge & deploy workflow — the short version

> One page. What ships, how, and the few phrases that change it.
> Mechanics + history live in the spec corpus (`project_setnayan_merge_workflow_reality`, `project_setnayan_deployment_phases`).

## Right now: AUTO-UPLOAD (owner-set 2026-06-14)

Open a pull request → it **merges to production by itself** the moment all CI checks pass. Vercel then auto-deploys `main` to the live site. No one has to run a command — it's enforced by GitHub (`.github/workflows/auto-merge.yml` arms auto-merge on every non-draft PR; branch protection's 7 required checks gate the actual merge, so broken code can never ship).

**You usually say nothing. PRs just ship when green.**

## The 4 phrases that matter

| Want to… | Do this |
|---|---|
| **Hold a PR from shipping** | Open it as a **draft**. Drafts never auto-merge. Mark it "Ready for review" → it ships. |
| **Pause one already heading out** | "Pause auto-merge on #1234" → runs `gh pr merge 1234 --disable-auto`. |
| **Go to the safe phase** (stop shipping straight to prod once real vendors are live) | Say: **"We're now publicly accepting vendors."** → all website + app updates move to a temporary/staging site; we promote to prod deliberately, and the auto-arm workflow is retired. |
| **Reset a session that forgot** (shouldn't happen now) | Say: **"Auto-upload mode — merge to the website automatically."** |

## Why it's safe

- Broken code can't auto-merge — **7 required checks** must pass first (typecheck+lint · production build · secret scan · migration timestamp guard · playwright e2e · bundle size · lighthouse).
- A change that would **regress a live surface** is still held and surfaced for a decision, even under auto-upload (e.g. a hero PR that would roll back a just-shipped one).
- The "hold" knob is just **draft status** — no special process.

## When this changes

The two-phase plan: **auto-upload now** (pre-public-vendor, ~no real users to disrupt) → **temp/staging site** once you say *"we're now publicly accepting vendors."* That trigger is the one thing worth remembering.
