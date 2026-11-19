#!/bin/bash
# Table test for no-double-build.sh's build matcher. Run: bash .claude/hooks/no-double-build.test.sh
# Every build form this repo uses must match (root package.json, apps/web/package.json and the
# workflows ci.yml / e2e.yml / lighthouse.yml / release-rehearsal.yml); lookalikes must not.
hook="$(cd "$(dirname "$0")" && pwd)/no-double-build.sh"
fail=0; n=0
check() { # check <want: build|pass> <command>
  n=$((n + 1))
  if bash "$hook" --is-build "$2"; then got=build; else got=pass; fi
  if [ "$got" != "$1" ]; then fail=$((fail + 1)); echo "FAIL want=$1 got=$got :: $2"; fi
}

# ---- MUST match (a production build) ----
check build 'pnpm build'
check build 'pnpm run build'
check build 'npm run build'
check build 'yarn build'
check build 'pnpm --filter @setnayan/web build'
check build 'pnpm --filter=@setnayan/web build'
check build 'pnpm -F @setnayan/web build'
check build 'pnpm -C apps/web build'
check build 'pnpm --dir apps/web run build'
check build 'npm run build -w apps/web'
check build 'pnpm -r build'
check build 'turbo run build'
check build 'turbo build'
check build 'npx turbo run build'
check build 'pnpm turbo run build --filter=@setnayan/web'
check build 'pnpm exec turbo build'
check build 'turbo run typecheck build'
check build 'next build'
check build 'npx next build'
check build 'pnpm exec next build'
check build 'pnpm --filter @setnayan/web exec next build'
check build './node_modules/.bin/next build'
check build 'NODE_OPTIONS=--max-old-space-size=8192 next build'
check build 'cd apps/web && pnpm build'
check build 'rm -rf apps/web/.next && pnpm --filter @setnayan/web build'
check build 'pnpm install; pnpm build 2>&1 | tail -50'
check build 'LOCK=~/Documents/Claude/Projects/heavy-lock.sh; $LOCK acquire b && ( pnpm --filter @setnayan/web build ); rc=$?; $LOCK release b'
check build 'time pnpm build'
check build 'nice -n 10 pnpm build'
check build 'env NODE_ENV=production pnpm build'
check build 'timeout 900 pnpm --filter @setnayan/web build'
check build 'bash -c "pnpm build"'
check build 'if pnpm build; then echo ok; fi'
check build 'pnpm --filter @setnayan/web \
  build'
check build 'echo start
pnpm build'

# ---- must NOT match ----
check pass 'pnpm dev'
check pass 'pnpm --filter @setnayan/web dev'
check pass 'pnpm preflight'
check pass 'pnpm preflight --only guards,lint,types,pins'
check pass 'pnpm typecheck'
check pass 'pnpm test'
check pass 'pnpm rebuild'
check pass 'pnpm tauri:build'
check pass 'cargo tauri build'
check pass 'docker build .'
check pass 'node scripts/check-build-budget.mjs'
check pass 'node apps/web/scripts/check-build-budget.mjs'
check pass 'pnpm build:icons'
check pass 'git commit -m "fix: pnpm build failed"'
check pass 'git commit -m "next build"'
check pass 'echo "run pnpm build later"'
check pass 'grep -rn "next build" .github/workflows'
check pass 'gh pr view 7984'
check pass 'git push -u origin claude/x'
check pass 'ls build/'
check pass 'turbo run lint'
check pass 'next dev'
check pass 'next start'

echo "$((n - fail))/$n passed"
[ "$fail" -eq 0 ]
