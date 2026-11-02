## 2026-10-02 · chore(cleanup): slice B — dead files nothing imports

Code only; no tables, migrations or data touched. Every file re-checked on fresh `origin/main` (imports, dynamic strings, routes, tests, baselines, all open PRs) before deletion.

Removed — replaced by:
- `OfflineSyncProvider.tsx` + `lib/indexedDB.ts` + `lib/mediaPipeline.ts` — replaced by `lib/offline/{db,sync-daemon,types}.ts` mounted via `offline-daemon-mount.tsx` (flag `NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED`).
- `lib/supplies/*` (4 files) — the Supplies vertical was dropped by migration `20271234329420`.
- `lib/event-initials.ts`, `lib/use-escape-key.ts`, `lib/use-tracked-mutation.ts` — zero users (plaque-as-menu rails no longer build the chip).
- `thread-call-launcher-lazy.tsx`, `app/papic/_papic-motion.tsx` — launcher is mounted directly; `/papic` uses `DoorwayPage` + `_pa-motion.tsx`.
- `app/vendor-dashboard/verify/actions.ts` (4 server actions) — old verify page retired to the papers screen 2026-09-11; `shop/inline-docs-actions.ts` is the live gate. Two guard tests re-anchored onto it (nothing they protect was weakened).
- Dead Maya manual-QR chain: `ManualCheckoutModal.tsx`, `api/v1/billing/initialize-maya/route.ts`, `lib/maya-catalog-line.ts` (+ test), `routes.ts` builder — payments are the receiving-accounts page. Supersedes the 2026-07-21 "parked pending KYC" note in `manual-checkout-modal-fit.md`.

Skipped: `lib/calligraphy.ts` — still imported by `scripts/build-cipher-fonts.mts`.

Baselines: `no-card.baseline.txt` and `port-control-baseline.json` regenerated; `ugat-both-ends.baseline.txt` loses 3 component rows and gains 2 (`manual_payment_logs` no-writer, `resolve_supplies_pricing` no-caller — their only callers were the removed files; the table/RPC are untouched).

SPEC IMPACT: None.
