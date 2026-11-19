## 2026-11-12 · feat(supplier): lane 5. The secondary pages leave the slab and use the system's two measures

Tablet/desktop plan, lane 5 (owner 2026-11-13: *"carry the phone design up"*, nothing exists only on desktop; v13: *"always maximize the screen use"*).

- **The slab is gone from the supplier tree.** `max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl` → `tab:max-w-3xl` (reading) on Bookings · Proposals · Recommendations · Manpower · How clients pay · Disputes · Track record · Partnerships · Attributes · Mood boards · Repertoire · a contract · a client's Cocktail and Editorial media · the loading skeleton (whose 6-up stat row is now 3-up, which fits the column). The Seat plan, the Production sheet and the service maker (`services/[serviceId]`, was `max-w-6xl`) take the wide stage, `tab:max-w-5xl`. Creators goes from `max-w-4xl` to the reading column.
- **A client's "Your next move" is no longer desktop-only.** It was `hidden lg:block` inside Details. From 701 it is now Details' right column (`SupplierColumns name="client-details"`, like the Hub's event card). Below 701 the same card sits in the list where it stood on a desk (`tab:hidden`). ⚠ This is the one change below 701: phones now see the card.
- **The editor side columns turn on at 701, not 768.** The package editor's "As couples see it" aside, the service maker's even split, pinned card and status line, and Verify's paper ↔ details pairs moved from `md:` to `tab:`.
- **Creators › Your collab ROI is rows, not a table.** It uses the offers list's `sn-row` (name, inquiries driven with its tier chip, status pill). Phones no longer get a sideways-scrolling 34 rem table.

Guards: `vendor-dashboard/the-columns-are-the-system.test.ts` now walks the whole supplier tree and bans the slab. It also pins each secondary page's measure, the client's next-move pane plus its phone copy, the editors' `tab:` line, and Creators-as-rows. I broke it on purpose to prove it catches regressions: re-adding the slab and an `md:` column each turned it red. `services/laptop-gets-two-columns.test.ts` follows the maker from `md:` to `tab:`.

Below 701 nothing else changes. Not touched: the supplier chat (lane 3), `app/dashboard`, and `services/new/[category]` (outside lane 5's file list; it still wraps the same maker in `max-w-6xl`).

SPEC IMPACT: None.
