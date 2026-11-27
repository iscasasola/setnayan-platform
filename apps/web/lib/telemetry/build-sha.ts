/**
 * The live build's commit, read from the deploy's environment. Pure of `server-only` on purpose: the fault recorder
 * (`fault-log.ts`, which re-exports it), the Problems page and the Work count (`problem-merge.ts`) all ask the same
 * question, so it has one home. `null` = not deployed by Vercel (a local run): "is a newer build live?" is unknowable.
 */
export function currentBuildSha(): string | null {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null;
}
