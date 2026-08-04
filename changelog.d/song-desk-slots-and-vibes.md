## 2026-07-30 · feat(couple): eleven moments, and a vibe per moment

Song Desk **PRs 6 + 4**, landed together as the register requires — they share `lib/playlist.ts`, and a vibe is meaningless without the slot list it hangs off. Both were owner-answered on 2026-07-30.

### PR 6 · the three missing moments

`prelude` (guest arrival) · `grand_entrance` (the couple into the reception) · `recessional` (the walk out). **Eleven slots**, ordered chronologically in the TS array *and* in the Postgres enum, so raw SQL reads the night in sequence too:

> prelude · processional · ceremony · recessional · grand_entrance · cocktail_hour · first_dance · parents_dance · dinner · open_floor · **banned_songs** (anti-picks stay last)

**The trap this PR was flagged for, defused rather than dodged.** `groupPicksBySlot` built a **hand-written** Record of every slot and did `out[row.slot_type].push(row)` — a slot missing from that object dereferences `undefined` and **throws at render**, so extending the enum without touching it would have crashed the couple's playlist studio on the first grand-entrance pick. The Record is now **derived from `PLAYLIST_SLOT_TYPES`**, which makes the class impossible for every slot added after this one, and the `?.push` keeps a ragged row (stale client, hand-written SQL) from killing a day-of surface.

⚠ **Postgres detail the migration has to respect:** `ALTER TYPE … ADD VALUE` may run in a transaction on PG12+ but the new label **cannot be used in that same transaction**. So the post-conditions check `pg_enum` **by string** rather than casting `'prelude'::playlist_slot_type`, which would fail for a value that exists. `BEFORE`/`AFTER` placement (not appending) is what keeps `ORDER BY slot_type` chronological.

### PR 4 · the vibe

Six names **frozen exactly as the artwork already reads them** — Acoustic · Classical · Jazz · OPM · Pop · Showband (`public/onboarding/prefs/music_*.webp`, which per RULE 0 was the *only* thing that existed: no enum, no column, no reader).

- **A separate sparse table** (`event_playlist_slot_vibes`), one row per (event × moment), absent row = nothing said. Not a column on a pick row: there may be no picks at all, and a vibe is one value per moment rather than per song.
- **Alongside the picks, never instead of them.** The owner's own example is a slot carrying both — *"jazz for dinner, but you must play Through the Years."*
- **A moment with a vibe and NO songs now renders** on the band's desk, with *"No songs named — they asked for the feel and left the choices to you."* That deliberately reverses the drop-empty-moments rule for exactly this case: "jazz for dinner" is a complete instruction, and dropping it would discard the only thing the couple said about dinner. `isEmpty` follows — a vibe-only night is not an empty playlist.
- **No seventh "Band's call" value** — the owner declined it, and rightly: the *absence* of a vibe already means that, so a value would give us two ways to say one thing. Clearing is a DELETE, and tapping the active chip is the clear affordance.
- **TEXT + CHECK rather than an enum**, deviating from the slot list next door: the residual risk after freezing six names is a *rename*, and renaming an enum label means rewriting every dependent object while a CHECK is one DROP/ADD CONSTRAINT.
- **Vendor read audience is identical to `event_playlist_picks`** (shared booked helper + day-of grantees). Two audiences for two halves of one screen is precisely the class of bug this stream spent the day fixing.

### RA 10173 — two guardrails, two honest answers

The new table carries `set_by_user_id`, so both privacy guardrails demanded a decision and **caught it in CI**:

- **Erasure → `DELIBERATE_EXCLUSIONS`.** The only subject column is `set_by_user_id`, declared **`ON DELETE SET NULL`**, so account deletion de-identifies the row automatically; what survives is *"dinner → jazz"*, the couple's shared event data on an event that outlives one partner's account. A purge rule here would delete the *other* partner's choice. (Notably this also avoids adding a 42nd `NO ACTION` FK — the sibling `event_playlist_picks.created_by_user_id` is `NOT NULL` with no delete rule, which is part of why admin user-deletion is broken.)
- **Export → `KNOWN_GAPS`**, ceiling 89 → 90, deliberately. A genre the subject personally chose is taste data in the same class as `event_playlist_picks` directly above it; claiming they are "not the data subject" would be the stretch, so it gets the same honest *not yet decided* rather than an invented exclusion.

Same row, different answers, because the questions differ: erasure asks *must this be destroyed* (no — it self-clears), export asks *must we hand over a copy* (undecided).

### Tests

`lib/song-desk.test.ts` **§6** — 12 new (45 in file). Full `test:db:ci` **640**, `test:unit` **5455**, lint + `dup-rule` + `migration:check` clean.

⚠ **The exposure baseline diff contains a narrowing that is NOT from this PR.** Regenerating absorbed PR #3894's un-regenerated `REVOKE ALL ON TABLE public.data_privacy_controls FROM anon, authenticated` (migration `20271021022827`) — grant removals never fail the freeze, so its stale lines had sat in the baseline. Net facts 6215 → 6211. Mine are the seven `event_playlist_slot_vibes` columns at `anon=-`, one `tpriv` line, and two policies.

SPEC IMPACT: PRs 6 + 4 are now built — recorded in `Song_Desk_BUILD_ORDER_2026-07-27.md` + `DECISION_LOG.md`.
