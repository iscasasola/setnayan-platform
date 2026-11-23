## 2026-11-23 · ship(batch-ab): #8199 Apple plan follow-ups · #8192 the nine reveals · #8196 /for-suppliers redraw · #7614 + #8174 Help · #7988 Home and Discover share one layout

Six reviewed PRs batched with merge commits, stacked on batch X.

- **#8199**: Apple shop plans bind to the server-issued token and keep every REFUND/REVOKE, even one that arrives first. Migration `20271360318379_apple_plan_token_binding_and_early_reversal.sql` (controller GO pinned to blob 9325a3eb8b). Exposure +16 is exactly its two tables: own-shop admins and platform admins may read; anon gets nothing; nobody can write from the client.
- **#8192**: the controller restored the 16 Oct 2026 ruling on reduced motion. A guest with reduced motion on gets no veil and no hold; the page is complete at once. The builder's still reveal plus one tap is reverted for reduced motion only; the normal-motion reveals are kept. The e2e guard `the-veil-hides-the-cover-words.spec.ts` is unchanged.
- `/dev/help-lab` (from #7614) is a dev lab that `notFound()`s in production. It is recorded in the root map's no-door baseline.

Ship controller: generated files regenerated once (screens map, port baseline, admin jobs, design rules, no-card, exposure surface, FK-behaviour map, root map).

SPEC IMPACT: None (each PR's own fragment carries its spec notes)
