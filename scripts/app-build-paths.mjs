#!/usr/bin/env node
// The files whose change means production must be REBUILT.
//
// 🔑 ONE LIST, THREE READERS. `deploy-prod.yml` builds only when one of these
// changed since the last publish; `deploy-drift-doctor.mjs` counts production as
// "behind" only by commits that touch one of these; and `apps/web/vercel.json`'s
// `ignoreCommand` names the same paths for preview builds. If they disagree, a
// commit can be skipped by the deploy and then reported as drift forever (or the
// reverse: a real app change skipped and called "up to date").
// `deploy-drift-doctor.test.mjs` fails if vercel.json's list stops matching this.
//
// Why it exists (owner, 2026-11-21, "Yes, fix it"): `deploy-prod` rebuilt the
// whole app for ANY new commit on main — a changelog fragment, a docs edit, or
// the bot's own prod-schema snapshot — and a build is the Vercel bill.
//
// `node scripts/app-build-paths.mjs` prints them space-separated for a shell.

export const APP_BUILD_PATHS = [
  'apps/web',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
];

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(APP_BUILD_PATHS.join(' ') + '\n');
}
