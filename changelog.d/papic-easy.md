## 2026-10-14 · feat(papic): easy to buy, track credits and see the gallery — the approved look, the automatic window, one word "credits"

Owner rulings: DECISION_LOG 2026-10-13 📸 (two rows) · 🧩 · 📍, and 2026-10-14 🎨 ("approve all" —
prototype `Setnayan/prototypes/papic_easy_home_and_band_2026-10-14_fable.html`).

- **One service glance, two sizes** (`app/_components/service-glance.tsx`, `lib/service-glance.ts`,
  `lib/papic-glance.ts`): Home › Your services' Papic row and the Papic page's top band — credits left +
  meter · **Buy more** · **See N photos** · one status line whose mood is in words AND colour (gold before
  the window, amber under 10% = `POOL_METER_LOW_PCT`, red at zero). Shape `{count, unit, mood, onFrom,
  result}` is the template for the other paid services; only Papic wears it.
- **Buy more = a sheet** (`papic-buy-sheet.tsx` → `papic-buy-form.tsx`): the shipped − / + `CreditStepper`
  (re-skinned), "After this: N credits", Continue to payment → "Opening payment…" (the #6527 one-order lock),
  → `purchasePapicPoolTopUp` → /pay. The ladder is read on the TAP (`papicBuySizes`), not on the view.
  `PapicPoolCard` and `HostPoolMeterCard` moved into the band (deleted as separate cards).
- **Home Next card moments**: "Your cameras are ready" (before the first photo), "Your cameras have stopped"
  (zero), and (owner call 1) running low ON the event day. They rank above the guest steps (as the
  prototype draws). NEVER TWICE now keeps the row and drops only the button the card offers; at zero the
  row shows the red meter only (call 3). "See N photos" opens the gallery directly (call 2).
- **Window is automatic**: the "Do this first · When can your cameras shoot? / Nothing can be captured
  until you pick the days" card is gone; "Cameras — set the dates", "Waiting for dates" and "1 day of
  capture" are gone (the picker seeds the 6-month default). The dates are a quiet "Change dates", last.
  Migration `20271268379848` moves cameras made under the old one-day default (no saved window) to the
  6-month start.
- **Guest camera at zero**: told at camera-open — "This celebration's credits have run out — the hosts
  can add more" — and the shutter rests (`GuestQuota.poolEmpty`, a boolean; PRIV-1 holds).
- **"credits" everywhere** on Papic surfaces (couple, guest, crew, meter, picker, order page, seat camera).
- **Dates in words**: "switches on Saturday, 12 December" (`formatPapicDayInWords`, Manila clock).
- **Fewer requests**: pool status asked once per render (`askedOnce`), the Papic home tile once per render,
  Home's nudge reads folded into the tile, the Papic page's four `events` reads + the gallery's venue read
  folded into one, the retired free "One" camera call dropped from every view and every new event
  (its points are 0 since `20271130515135`). Measured with the PGlite request harness (PR body).

SPEC IMPACT: None — implements the 2026-10-13/14 rulings already in the corpus DECISION_LOG.
