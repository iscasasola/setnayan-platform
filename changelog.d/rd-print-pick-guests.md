## 2026-10-25 · feat(prints): Pick guests — print some guests' passes or QR codes in one file

Owner 2026-10-25, on the guest pass / QR print: *"instead of just making me select all, allow me to pick multiple guests to compile together as well."*

- Studio › Prints, Event pass and Guest QR codes rows: **Pick guests** beside **All guests** (All stays the default). It opens the shared `Sheet` in place — Search guests, Side ▾, Group ▾ and Role ▾ (the Form row’s `ChosenRow`, combined; roles in the shipped `ROLE_LABELS` words), each guest a ticked option, Select all shown / Clear, "12 picked", and one button "Print 12 passes" / "Print 12 QR codes" (`GuestManySheet`, `print-guest-sheet.tsx`, the View as ▾ lazy chunk).
- `/api/hub-print/passes` and `/api/hub-print/qr-codes` take `guests=<id>,<id>,…` (read after the same host gate). The loader (`loadGuestPasses` → `pickGuestRows`, `lib/print-picked-guests.ts`) draws ONLY those guests, still ganged on A4 with the #6876 cut lines, each keeping its place-in-list serial. An id that is not one of this event's guests for that file is refused (403) — never dropped, never included; an empty / malformed / over-250 list is 400, never "everyone". No list prints every guest, unchanged. The Free/Pro gates are untouched.
- `loadPassGuestNames` now carries each guest's side, group and role (the guest list's own labels) for the filters.
- Tests: `lib/print-pick-guests.test.ts` (the rule executed; the QR route called with the real loader — picked only, foreign refused, no list = all; the passes route hands the pick to the loader and refuses). Guard regex in `printed-tickets-drop-who-cannot-come.test.ts` follows the new `onlyGuests: picked` argument.

SPEC IMPACT: None — an addition under the 2026-10-22 "free is ready" print rules; no gate or price changes.
