## 2026-11-27 · feat(gown-maker): the gown maker's tables (port step B1)

Owner, 27 Nov: the gown maker joins the platform, built the way the cake maker is, and is the Toolkit's paid "Attire Maker" (DECISION_LOG 2026-11-27, three rows). This is the database half only: nothing a person sees changes yet.

- **Six tables** (migration `20271365509280`), RLS on at create, `REVOKE ALL` then `GRANT SELECT`, only the server writes:
  - `gown_fabric_types`: the fabric-type registry, seeded with the prototype's 15 at the v186 values (all marked unverified). Everyone signed in reads it; only Setnayan admin edits it. A type a fabric uses can be hidden, never deleted.
  - `vendor_gown_makers` · `vendor_gown_fabrics` · `vendor_gown_looks`: a shop's price list, fabrics and lace (per-metre price empty = unpriced) and looks. The shop reads its own; a bride gets the public columns from the server, never the prices.
  - `gown_designs`: a sent design keyed to the chat. Her body numbers are stored only on Send and read only by the event's hosts and that shop. There is no cost column: the server prices the design for the shop when it reads it. The row has room for the QR share folded in from #8387 (share code, Shortlist or Booked, the Booked QR link).
  - `gown_fittings`: the designer's tape. The shop only.
- **The Toolkit SKU** `vendor_tool_attire_tool` ("Attire Maker"). Its price is copied from the Cake Maker's row (one price for every top-band tool), so no amount is typed anywhere.
- **Ugat:** joints J74 (chat → gown design and tape) and J75 (shop → its Attire Maker setup), with schema claims for all six tables.
- **Guard:** `tests/db/gown-maker-keeps-her-numbers-private.db.test.ts` (9 tests). Sabotage-checked: making the tape readable by the couple turns test 3 red, opening the design read to everyone signed in turns tests 1, 2 and 6 red, and dropping the shop-is-the-chat's trigger turns test 6 red.

SPEC IMPACT: None. The plan (`WHATS_NEXT_Gown_Maker_Port_2026-11-27.md` § 3) and the owner's answers are already in the corpus. One delta from the plan's table: `gown_designs` also carries `vendor_profile_id` (and `thread_id` may be empty), so a QR-shared design can exist before its chat does, per the owner's 27 Nov answer.
