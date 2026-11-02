## 2026-09-19 · fix(reads): result-dropped-silently, UNCLASSIFIED tier batch 1/2

S41c, batch F of 2 — the UNCLASSIFIED tier of the `result-dropped-silently`
class from the S26 orphan-baseline scanner (PR #5625): a Supabase call whose
`error` is read only as an if/else condition, where the branch it selects
records nothing. Every site below now either logs the error at the point it
was discarded (shape 1 — the caller already fails closed or degrades
correctly), or carries a distinct "unreadable" sentinel through to a page a
person actually sees (shape 2), per the pattern in PR #5650 / #5656.

- `app/[slug]/_components/editorial/consent-veto.ts` — both `from:<src.table>.select` call sites now log (shape 1; the fail-closed FaceBlock/consent-veto behaviour is unchanged).
- `app/[slug]/_components/editorial/data.ts` — `from:panood_broadcasts.select` logs (shape 1).
- `app/[slug]/_lib/loaders.ts` — `from:coordinator_broadcasts.select` (day-of announcement) logs (shape 1).
- `app/auth/callback/route.ts` — `from:users.update` (OAuth vendor promotion) logs (shape 1).
- `app/open-shop/actions.ts` — `from:dependents.select` logs (shape 1).
- `app/panood/actions.ts` — `from:panood_camera_operators.select` logs (shape 1).
- `app/u/_actions/audience-actions.ts` — `from:user_follows.delete` (unfollow) logs (shape 1).
- `lib/alaala-wall-data.ts` — `from:people.select` logs, on top of the file's existing `unreadable` honest-render plumbing (shape 1).
- `lib/coordinator-broadcasts-server.ts` — `fetchLatestBroadcasts` (`from:coordinator_broadcasts.select`) now returns a distinct `BROADCASTS_UNREADABLE` sentinel instead of `[]` on a refused read, logged via `logQueryError` (shape 2). Threaded through `BroadcastCardData.broadcastsMeasured` (`lib/coordinator-broadcasts.ts`), `app/dashboard/[eventId]/page.tsx`, and rendered as a distinct "We couldn't load recent broadcasts" state in `coordinator-broadcast-card.tsx` — previously byte-identical to "No broadcast yet" on the couple's day-of dashboard. The guest-facing caller (`app/[slug]/announcement-actions.ts`) treats the sentinel as "no new hint this poll", consistent with its documented best-effort design.
- `lib/data-privacy-controls.ts` — `isDataPrivacyControlActiveWith`'s `from:data_privacy_controls.select` logs (shape 1; fail-closed unchanged).
- `lib/entitlements.ts` — `fetchBundleComponents`'s `from:bundle_components.select` logs (shape 1; const-fallback unchanged).
- `lib/faith-vocab.ts` — `getFaithVocab`'s `from:faith_vocab.select` logs (shape 1; fallback list unchanged).
- `lib/honoree-dependent-link.ts` — `resolveHonoreeDependentId`'s `from:dependents.select` logs (shape 1; drop-the-link behaviour unchanged).
- `lib/interconnect/verdicts.ts` — `from:interconnection_probe_runs.select` logs (shape 1; admin map tool, unprobed-stays-unlit behaviour unchanged).
- `lib/known-hash-match.ts` — `from:media_hash_checks.select` logs (shape 1; `countsUnavailable` honest-render was already correct, just silent).

New test: `apps/web/lib/s41c-unclassified-batch-f-reads-are-honest.test.ts` (9 tests, sabotage-proven locally against each fix).

SPEC IMPACT: None.
