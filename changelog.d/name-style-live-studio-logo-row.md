## 2026-09-30 · feat(names): the couple picks a Name style · Prefix is one dropdown everywhere · Panood reads "Live Studio"

Owner-approved (DECISION_LOG "THE COUPLE PICKS A NAME STYLE", "NO CASUAL
GREETINGS", "EVERY NAME IS THE SAME FIVE FIELDS", "THREE OF THE CONTROLLER'S
OPEN QUESTIONS ANSWERED").

**Name style ▾** — one event-wide PickMenu under Maker › Details › Names:
Full "Mr. Manuel Cortez Casasola" (default, byte-identical to before) · Middle
initial "Mr. Manuel C. Casasola" · Surname first "Mr. Casasola, Manuel C.".
Suffix kept ("… Casasola II"; Surname first puts it after its own comma,
"Mr. Casasola, Manuel C., II"); a missing part is skipped cleanly. A Display
name the couple typed is printed as given in every style.

- Stored in the event's existing settings: `events.print_details.name_style`
  (no table, no column, no migration). Saved at once through the prints' own
  route, `POST /api/hub-print/name-style` — no new server action.
- One rule, `lib/name-style.ts` (`styledName`, `ticketName`), reached through
  the existing builders: `guestFullName` / `printedCardName` (lib/guests.ts),
  `buildEntourage` / `entourageLines` / `plainGuestNames` (lib/entourage.ts),
  `passCardGuestName` (lib/pass-card.server.ts).
- Applied to: the entourage (sponsors included) on the Event Hub, /everyone and
  the printed Entourage + Invitation cards; the name list on /everyone; the
  printed per-guest cards; the Digital ticket and the Printed ticket batch; the
  couple's invite message `{name}` (every couple-side caller).
- A ticket's Full keeps the ticket's own line (no middle name) — "default =
  today"; the other two styles print their style.
- Pair lines: Middle initial shares the surname ("Mr. Manuel C. & Mrs. Rosa L.
  Casasola"); Surname first never shares one and prints both names whole.
- Not applied (not formal surfaces): the Guest list's own working rows, the
  reception-desk registry (already surname-first by design), a story byline.

**Fix found on the way:** the Details words save (`/api/hub-print/words`)
listed the keys it carried and had missed `poster_photo`, so saving the opening
line put the A3 Our Story poster back to the theme's picture. It now spreads
what is stored and overwrites only its own three keys — which is also what
keeps `name_style`.

**Prefix is one dropdown** — the Guest list card, the Add-guest form, the
profile and the sign-up profile step now draw the guest side's dropdown
(`PrefixSelect`, `NAME_PREFIX_CHOICES`); a stored prefix outside the list stays
as its own option.

**Live Studio** — the host-facing name for Panood: the /panood product page,
the broadcast errors and the (inactive) SKU display names. "Watch Live" stays
on the guest's watch page. `RETIRED_NAMES` now records Panood → Live Studio.

**Logo Maker row** — no change needed: on `main` the Logo Maker is already a
door inside the Event Hub Maker (Details › Logo; `STUDIO_ABSORBED.palogo`,
held by `the-maker-is-one-row.test.ts`), and Stage D (#6153 / #6187) also sends
`/monogram` to Details › Logo.

Guard: `apps/web/lib/the-name-style-reaches-every-formal-surface.test.ts` —
the three styles and clean skips; the entourage, pair lines and name list in
the style; every `print_details` writer starts from what is stored; every
formal surface's name call carries a style (AST arity, with named exceptions);
no free-text Prefix box on the four screens. Each sabotaged once and seen red.

SPEC IMPACT: None — implements the four DECISION_LOG rows above as written.
The storage home (`print_details.name_style`) is the "event's existing
settings" the row names.
