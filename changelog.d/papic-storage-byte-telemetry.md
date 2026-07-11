# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(papic): storage byte-accounting telemetry (WS4 foundation)

The first, non-destructive slice of the Papic storage spine. Records the REAL byte sizes of every capture so the pricing councils' provisional numbers — the modelled "~8%" web-copy ratio, the 40 GB/event soft ceiling, the ₱/GB cost — get **locked from measured data** (first ~50 Unli events) instead of a guess. Pure measurement: no behaviour change, nothing gated, nothing dropped.

- **Migration `20270718100867`** — adds `orig_bytes` / `display_bytes` / `thumb_bytes` (bigint, nullable, additive) to `papic_photos` + `papic_guest_captures`.
- **`lib/papic-derivatives.ts`** — the existing derivative pipeline already holds the original bytes and produces the display/thumb buffers, so it now persists their sizes alongside the keys. **Stills get full accounting** (`orig`/`display`/`thumb`); **clips get display (poster) + thumb only** — `orig_bytes` stays NULL for clips because their original is a video, not the poster we derive from, so writing it would corrupt the ratio. `persistDerivativeRefs` gained a PGRST204 fallback: if the byte columns aren't deployed yet, it retries with keys-only so derivative generation keeps working ahead of the migration.
- **`lib/papic-storage-telemetry.ts`** (new, pure) — `webCopyBytes`, `webCopyRatio` (stills only), and `aggregateEventStorage` → the real ratio + per-event forever-hosted web-copy total + a dialable over-ceiling flag (the signal the future Drive-only-beyond governor reads). No I/O; 8 unit tests (ratio measured over stills only, clips excluded, dialable ceiling, empty-event).

Verified: typecheck clean incl. tests, 8/8 new + 58/58 papic suite, `next lint` clean.

SPEC IMPACT: None — implements the telemetry the storage-tail governor in `Pricing.md § 2.1` already calls for ("40 GB is PROVISIONAL … lock the real number only after instrumenting the first ~50 real Unli events"). The retention-changing parts (3-mo full-res drop, Drive-only-beyond ceiling, Keep Full-Res SKU) remain unbuilt, pending owner sign-off on the data-retention change.
