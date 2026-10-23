# HANDOVER — booth capacity strip says "could not read" on a refused count

Branch: `claude/booth-capacity-strip-says-unread` (cut from `origin/main` @ `7862e27e15`).
Open PRs: **none**. Nothing merged, nothing deployed.

⚠ Delete this file before the PR is opened. It is a handover note, not product code.

## Goal

When the booth page cannot read its "submissions in the last 24 h" count, the soft-cap strip
must say the count could not be read. Today a refused read looks exactly like a quiet booth.

## The owner's words (the task as given)

> `apps/web/app/dashboard/[eventId]/studio/patiktok/booth/page.tsx` counts `patiktok_render_jobs`
> enqueued in the last 24 h for the soft-cap strip. It computes
> `const submissionsMeasured = !submissionsCountError && submissionsCount !== null;` and then never
> uses it: `const submissions = submissionsCount ?? 0;` feeds `CapacityStrip`, so a refused read
> renders "0 / 40" and "40 left before soft cap" — identical to a quiet booth. This is the repo's
> "a failure that renders identically to success" disease (see CLAUDE.md, and the pattern in
> `apps/web/lib/guests.ts` + `apps/web/lib/guests-read-is-honest.test.ts`).
>
> Fix: when `submissionsMeasured` is false, `CapacityStrip` must say the count could not be read
> (no number, no "N left", no green pill). `app/dashboard/reads-are-honest.test.ts` currently only
> checks that the `submissionsMeasured` line exists — extend it so it fails unless the strip is
> handed the measured flag and draws no figure when it is false (sabotage-test it: break it, see it
> go red). Home's new Video booth card (`lib/home-booth-card.server.ts`, PR-C "every Home service
> as a widget") already reads this count honestly; this task is only the booth page itself.
>
> House rules: no new server actions; add a `changelog.d/<branch>.md` fragment; run
> `pnpm preflight` before pushing; open the PR as a draft.

## What's done

- Located the code; there are **no code changes yet**:
  - `booth/page.tsx`: find it with `grep -n "submissionsMeasured\|CapacityStrip" "apps/web/app/dashboard/[eventId]/studio/patiktok/booth/page.tsx"`.
    `submissionsMeasured` is computed and never read. `submissions`, `remaining` and `overCap` all
    come from `submissionsCount ?? 0`. The call site is `<CapacityStrip submissions remaining overCap />`.
    `function CapacityStrip` draws `{submissions}` / cap, and a pill reading either
    `Past the soft cap` or `${remaining} left before soft cap` (the green success pill).
  - Guard: `grep -n "submissionsMeasured" apps/web/app/dashboard/reads-are-honest.test.ts`.
    The block is commented "A COUNT THAT IS ALSO A CAP". It only asserts the `const submissionsMeasured = …` line exists.
- Checked for duplicate work: no open PR touches booth or patiktok or capacity, as of 2026-10-24.

## What's left, in order

1. **Page:** pass `measured={submissionsMeasured}` to `CapacityStrip`. Inside the strip, when
   `!measured`, draw no figure, no `/ cap`, no "N left" and no green pill. Draw a neutral line
   instead, e.g. "Couldn't read today's count. Refresh to try again." Keep the soft-cap
   explanation paragraph. Make `overCap` false when the count was not read, so no warn styling
   shows on a fake number. Better still, compute `remaining` and `overCap` only when the count
   was measured. Follow the house UI rules: details go in the ⓘ InfoTip, and a frame goes only on
   things you can press.
2. **Guard:** extend the "A COUNT THAT IS ALSO A CAP" block in `reads-are-honest.test.ts` so it
   asserts (a) the call site hands the strip `submissionsMeasured`, and (b) inside the
   `function CapacityStrip` body, the figure, the `left before soft cap` text and `bg-success`
   are all reachable only on the measured path. Anchor these on strings and the component
   window, never on line numbers. Run it against `stripComments(...)` like the rest of the block.
3. **Sabotage:** remove the `measured` prop at the call site and confirm the guard goes red. Then
   draw `{submissions}` outside the measured branch and confirm it goes red again. Restore after
   each. Commit before you mutate anything.
4. Add `changelog.d/claude-booth-capacity-strip-says-unread.md`. Use the format
   `## 2026-10-24 · fix(patiktok): …`, and set `SPEC IMPACT: None`.
5. Install dependencies in this worktree (`pnpm install`; it has no `node_modules`). Then run
   `pnpm preflight` from the repo root. Delete this HANDOVER.md, push, and open the PR as a
   **draft**: `gh pr create --draft`.

## How to check it

```bash
cd apps/web && npx tsx --test app/dashboard/reads-are-honest.test.ts
```

- Run it from `apps/web`, or the `@/…` imports fail.
- A refused read should show the "couldn't read" line, with no number and no green pill.
- A real read should look exactly as it does today: "N / 40" with a green "M left" pill, or warn
  styling once past the cap.
- Take a screenshot of the strip in both states at 375 px for the check card.
