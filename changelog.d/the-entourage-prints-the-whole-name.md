## 2026-09-14 · fix(invitation): the entourage prints the whole name, prefix and all

Owner, looking at the live entourage on his own wedding: *"show full name"*.

**Measured on that wedding the same day: of its 72 entourage rows, 66 carry a
`name_prefix`** — Atty., Comm., Associate Dean — and 25 carry a middle name. The
invitation printed none of them.

| In the guest list | On the invitation before this |
|---|---|
| Atty. Arnaldo M. Espinas | Arnaldo Espinas |
| Associate Dean Cecilio Duka | Cecilio Duka |
| Atty. Cherry Liez O. Rafal-Roble | Cherry Rafal-Roble |

On a Filipino invitation a ninong's title is not decoration.

🔴 **Cause:** `name_prefix` / `middle_name` / `name_suffix` shipped on 2026-09-10
(PR #5488) and **no display helper was taught about them** — `guestDisplayName`
still reads `display_name` / first + last, so every surface kept printing the
short name. The entourage inherited that.

- `lib/guests.ts` — **`guestFullName`** added BESIDE `guestDisplayName`, not
  instead of it. They answer different questions: the compact name for a chip or
  a seat card, the formal name for an invitation. Widening the compact one would
  have moved every name in seating, the emcee script and the guest list at once.
  The couple's own `display_name` still wins when they set one.
- `lib/entourage.ts` — `personName` **delegates**; it does not re-compose. One
  place knows the printed order of a name's five parts.
- `app/[slug]/_lib/loaders.ts` — the read asks for all five columns.

🔑 **The new guard is on the READ, not only the composer.** `personName` can
compose a perfect name and its unit test pass forever while the invitation still
prints the short one, because the SELECT asked for two of five columns — the
pure half right, the read short, and nothing red. Both halves are now pinned,
and each sabotage (drop the columns from the query · drop the prefix from the
composer) turns the suite red.

⚠ **Still open, and wider than this PR:** every OTHER surface still prints the
short name — seating, the emcee script, the guest list itself. `guestFullName`
now exists for them; nothing has been pointed at it.

SPEC IMPACT: None — no schema change, no ruling. The columns and the values were
already there.
