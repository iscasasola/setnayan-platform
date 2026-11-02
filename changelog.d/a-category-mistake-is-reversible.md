## 2026-08-28 · feat(taxonomy): a trade can be merged, and an old key still lands on its replacement

**SPEC IMPACT:** `DECISION_LOG.md` row 2026-08-28 — answers the owner's own question
("can we reroute / combine / rename a category in the future?"). Corrects the standing claim
that `service_categories.merged_into_category_id` is the column for it.

Combining two TRADES did not exist anywhere in the admin — no leaf merge, no leaf delete.
Renaming was already safe, moving a trade between branches shipped, and combining two
BRANCHES shipped. This adds the missing one, with the forwarding reader in the same change.

- **`merge_canonical_service()`** — folds trade A into trade B in ONE transaction, moving all
  TWELVE columns that hold a canonical trade key. `service_role` only; not executable by
  `anon` or `authenticated`.
- **`canonical_service_taxonomy.merged_into`** — the trade forwarding pointer. The merged trade
  is TOMBSTONED, never deleted: the row stays so an old key on a printed QR still resolves.
- **The reader ships with the writer** — `/explore?category=<old key>` resolves to the
  replacement. Fails open: an unknown key passes through unchanged, so this can never be a gate.
- **`lib/taxonomy-merge-holders.ts`** — the registry of who holds a trade key, declared once as
  data, with the guard deriving from it.
- **`lib/dangling-trade-keys.ts`** — reports a shop-held key that points at no trade, because no
  foreign key ever will.

### Corrections this change records

- 🛑 **`service_categories.merged_into_category_id` cannot forward a TRADE.** That table holds
  only tier-1 folders (16) and tier-2 tiles (78) — read out of prod, there is no tier 3. Trades
  live in `canonical_service_taxonomy`. Wiring it would have built a forwarder for the one case
  that already had a merge. It is left alone; its writer is named as follow-up, not half-built.
- 🚨 **A remembered list of holders had THREE. Enumerating the columns out of production found
  TWELVE**, including `vendor_screen_name_sequences` (2052 live rows) and
  `vendor_packages.primary_canonical_service`.
- 🚨 **SIX of the twelve sit under a UNIQUE constraint that includes the trade key**, so a plain
  `UPDATE … SET col = dest` throws `23505` the moment one shop holds both trades — the ordinary
  case for a merge. Each drops the colliding source row first.
- ⚠ **`event_vendors.category_key` is a TILE id, not a trade key** (its own column comment says
  so), so it does not constrain a trade merge.

### Proof

- Dry-run against **production** inside `BEGIN…ROLLBACK`, seeding a shop holding BOTH trades;
  rollback verified by re-reading prod afterwards (2 shops · 2 coverages · 2 cards · 288 trades ·
  9 restored sequence rows · no column · no function).
- `lib/a-trade-can-be-merged.test.ts` — `# tests 12`, and **11 measured mutations**, each with its
  occurrence count printed before → after, each going red. One mutation initially did NOT LAND
  (count 1 → 1) and its green was correctly discarded and redone.
- `tests/db/a-trade-can-be-merged.db.test.ts` — `# tests 7` against a replayed schema; two
  migration mutations landed and went red.
