## 2026-11-12 · feat(card-maker): the service Card Maker is ONE form (ruling 6058)

Owner, 11 Nov 2026: *"The service card maker part has line and menus take up too many rows. It feels too separated and
not feel like a singluar form. We have a design template, use it and make this better."* Approved prototype
`prototypes/card_maker_one_form_2026-11-11` (Setnayan-specs).

The maker's first page (`canvas-maker.tsx`) is now one list of rows from the shipped Form-row template
(`app/_components/form-row.tsx`): Name · Specialties · Price · How the price works · Price · more,
then the sections What's included · Extras · Gift · Photos. Each section is a mono label over one divider, and every
hint moved into an ⓘ. Pills are 150 px on the main list and 120 px on the extras list. **No field was added or removed.
Every posted name is unchanged** (`canvas-field-parity` and `the-maker-maps-every-field` stay green).

- **Included lines and extras are one row each.** A line's words stand where the row's name stands; tap them to type.
  An extra's "from ₱" sits in its 120 px pill. "Add a line" / "Add an extra" is the last row of the list. New template
  pieces `LineRow` and `AddLineRow` live in `app/_components/form-row-line.tsx`. An included line still has no peso
  (owner 11 Nov).
- **Same-day capacity** (`vendor_services.daily_capacity`, per service card) STAYS under More settings › Booking terms
  (owner 13 Nov, DECISION_LOG "CARD MAKER SAME-DAY ROW → MORE SETTINGS": *"more settings."*). It is no longer a raw
  number box there: it reads "How many events can you serve on the same day?" with a −/＋ stepper (`FormCounter`):
  - A new card starts at 1.
  - A saved card shows its own number.
  - A saved card stored blank ("your plan's number") shows the plan's number and posts blank until someone taps.
    Opening and saving never writes a figure nobody chose. The new `FormCounter` option is `blankUntilTouched`.
  - A card with time slots says "Set by time slots".
- **Price** becomes one typed ₱ row (`PricingBasisEditor part="row"`, same field per basis). A couple-seeded card still
  shows the recorded price and says what the row waits for.
- **Gift** becomes one chosen row (`GiftPickRow row`). The gift tips and the line about the pick move into its ⓘ.
- **Guards:**
  - `canvas-field-parity.test.ts` sets aside a Form-row component's `name=` label. Those rows post only through
    `fieldName`, which the scan now counts.
  - `the-cover-is-a-thumb-and-a-pill.test.ts` now asserts the new rule: Add is the list's last row.
  - The field-template baseline was regenerated (two raw boxes fewer).

SPEC IMPACT: None. This builds the approved prototype plus the 13 Nov same-day ruling (already in DECISION_LOG).
