## 2026-10-01 · feat(vendor): the supplier phone app — Today · Customers · Shop · More

Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SUPPLIER PHONE APP — APPROVED, WITH THE THREE
RECOMMENDED ANSWERS"; prototype `supplier_app_simple_2026-10-01_fable.html`). Same method as the
host's phone Home: one thing per screen, the first thing to do in the top third. Nothing removed —
what is not needed now moved one tap away.

- **Today** opens on the shop line → ONE Next card (the most urgent: Run the day on an event day ·
  Reply · Answer a booking ask · Confirm a deposit · Send quote · Event tomorrow · Booking fee ·
  Payday) → three numbers (new inquiries · events this week · ₱ owed to you, "—" never ₱0 when
  unread) → the next three events. Everything that was on the page stays below, under "Everything
  else", plus an Earned-this-year / Confirmed-of-booked line that replaces the old tiles.
  The Next card is the host's own component, lifted to `app/_components/next-card.tsx`
  (one mechanism, two pickers: `lib/home-first-screen.ts`, `lib/supplier-today.ts`).
- **Bar and rail**: Today · Customers · Shop · More (was Today · Customers · Shop · Insights ·
  Event Hub). Insights, Event Hub and Messages live in More (`lib/vendor-more-rows.ts`, the one
  list the phone's More sheet — the host's shipped sheet — and the `/vendor-dashboard/more` page
  both draw). Labels "My Customers"/"My Shop" → "Customers"/"Shop". Staff still see Today +
  Customers only (they never had Insights or Event Hub).
- **Customers**: title · round + · ⋯ · search · Filter ▾ · counts line · Show ▾ · rows with a
  status pill and one next-step button. The + opens the SHIPPED "Import an outside client · free"
  form (owner answer 3 — no new schema). Filter ▾ / Show ▾ are the shipped `PickMenu` (replacing
  the five-pill lane row). ⋯ holds Book of business · Messages · Calendar · Availability ·
  Proposals · Contracts, all still on the page below.
- First-visit MiniTours `vendor_today_v1` and `vendor_customers_v1`.
- Guards: the Next card is the first thing you can tap (render + page source order); the bar is
  four keys; More's rows come from one module; the + lands on the shipped form; every row has its
  next-step button; the three numbers link to real routes; the picker's order. Port-control
  baseline regenerated (Today's KPI tiles and its direct Messages/Insights links moved on purpose).

SPEC IMPACT: None.
