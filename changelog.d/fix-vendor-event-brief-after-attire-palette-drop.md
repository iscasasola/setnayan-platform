## 2026-09-03 · fix(vendor-brief): repair get_vendor_event_brief after the attire-palette column drop

A **shipping bug introduced earlier on this same branch**, caught before merge.

`20271193010764_retire_dead_moodboard_schema_…` drops `events.attire_guide_palette`.
Dropping it was right — the column's only writer was dead code. But the live
definition of `public.get_vendor_event_brief(UUID)`
(`20271144258091_lock_handshake_slice_b`) still SELECTed that column into `v_event`
and read it back in **both** payload builders.

⚠ **Postgres does not dependency-check a plpgsql body.** It is an opaque string to
the dependency tracker, so `ALTER TABLE … DROP COLUMN` succeeded with no error and no
warning, and the function was broken from that moment — failing only at
**invocation**, with `42703 column e.attire_guide_palette does not exist`. In
production the first invocation is a supplier opening an event brief. The blast radius
is not one screen: this RPC backs the vendor client page, the `.ics` calendar feed,
challenge-photos, the on-the-day console and its live view, proposals, the supplier
desk and the song-desk gate.

🔑 **The gap was exactly "nothing called it."** Replaying DDL proves a schema can be
BUILT; it proves nothing about whether a function body still resolves. The only tests
that went red were the four in `lock-handshake-slice-b.db.test.ts` that happen to
invoke the function; every other db test passed.

Migration `20271198063551` re-emits the function **by extraction, never retyped**. The
diff against the shipped definition is exactly three edits, all forced by the dropped
column: `e.attire_guide_palette` leaves the SELECT list, and both
`'attire_guide', COALESCE(v_event.attire_guide_palette, …)` sites become the constant
`'{}'::jsonb`. The stage gate, the disclosure ladder, the budget-band arithmetic and
both payload builders are byte-for-byte the shipped ones.

**The `attire_guide` key survives as an empty object — not deleted, not re-sourced.**

- ❌ **Not deleted.** This repo treats an RPC's return shape as a contract (the sibling
  `20271193469029` on this branch is additive-only for that reason), and the key has a
  declared consumer: the `Brief` type in
  `apps/web/app/vendor-dashboard/clients/[eventId]/page.tsx` declares
  `attire_guide: Record<string, unknown>` as a **required** field.
- ❌ **Not re-sourced from `role_palette`** — the tempting wrong answer. The pitch is
  that it would "preserve the vendor's information rather than blanking it". **That
  premise is false**, measured two ways instead of assumed: against production
  (`select count(*) filter (where attire_guide_palette <> '{}') from public.events` →
  **0 of 5**), and against the tree (no migration ever writes the column; its only
  writer hung off `wedding-attire-guide.tsx`, which `origin/main` imports from
  nowhere). `COALESCE(attire_guide_palette, '{}')` has **always** returned `{}`, so
  `'{}'::jsonb` is byte-identical to everything the key has ever returned.
- 🔑 **And the vendor is already informed by the key next door.** `role_palette` is on
  the same wire as `'palette'`, and the vendor client page already renders every attire
  role from it via `PALETTE_LABELS` — Bride, Groom, Guest dress code, Wedding party,
  VIP family, Principal/Secondary sponsors, Bearers & flower girl, Officiants. Feeding
  `role_palette` into `attire_guide` too would ship a **second, competing copy of one
  fact** (RULE 0 §8), would silently change the key's *value* shape from
  `{role: "#hex"}` to `{role: ["#hex", …]}` while claiming to protect the contract, and
  would mislabel `role_palette`'s non-attire members (`ceremony`, `reception` are
  venue/decor palettes) as attire. Blanking a key that was always blank is honest;
  inventing data under a stale name is not.

**Swept for the same defect class.** Every `attire_guide_palette` and
`event_moodboard_saves` reference across `supabase/migrations/` was checked: all other
hits are in **superseded historical migrations** (four earlier definitions of this same
function, the original `ADD COLUMN`, the `event_moodboard_saves` `CREATE TABLE` and its
constraint edit) which are frozen and never re-run, or are prose inside comment
strings. `public.events_host` is safe by construction — it computes its projection from
`information_schema.columns` at apply time and is rebuilt in `20271193183599`. No other
live function, view, trigger or policy references either artifact.

New: `apps/web/tests/db/the-vendor-brief-survives-its-own-schema-drops.db.test.ts` —
**a function that only fails when invoked needs a test that invokes it.** It calls the
brief at all three stages (booked / requested / inquiry, since the two payloads are
built by separate `jsonb_build_object` calls on opposite sides of the stage gate),
against a fully populated wedding, and asserts the **exact** top-level and nested key
sets as a contract, so a key silently vanishing goes red too. It pairs the
`attire_guide === {}` assertion with "and `palette` still carries the colours",
because that pairing is the whole justification for blanking the key. A 42703/42P01 is
re-thrown with the diagnosis attached rather than a bare column name.

Verified: `lock-handshake-slice-b.db.test.ts` **4 failures → 0** (9/9), the new suite
4/4, both ugat db tests 6/6, `tsc --noEmit` clean, `lib/**/*.test.ts` 10,236/10,236,
`lint-events-column-grants.mjs` and `check-migration-timestamps.mjs` green.
**Non-vacuity proved:** with the new migration moved aside, the original 4 failures
return *and* all 4 new tests fail; restored byte-identical (sha256 verified).

SPEC IMPACT: None.
