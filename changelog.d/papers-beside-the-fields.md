## 2026-09-10 · feat(vendor-verification): the paper beside the fields it proves

My Shop → Get verified now shows each of the four required papers **beside the
details it proves**, with every line reporting on its own — ported from the
binding drawing `prototypes/shop_verification_2026-09-09.html`. Not a new page:
the same section, the same place, the same slot keys and the same submit gate.

**The hard stop this removes.** Measured against production 2026-09-10: BOTH
shops are `public_visibility = 'verified'` and carry every one of the six
identity columns NULL, and one of them was holding a `draft` verification
application it could no longer reach — the section returned its badge card and
nothing else the moment a shop was verified. A verified shop now keeps its badge
**and** is asked for its papers. No deadline is set and the badge is never
threatened.

- Six existing, never-filled `vendor_profiles` columns get their first writer on
  this screen: `registered_business_name` · `business_owner_name` ·
  `registration_number_raw` · `tin_number` · `registered_address` ·
  `location_city`. **No migration and no grant** — all six already carry a
  column-level UPDATE grant to `authenticated`, and `anon` reaches none of them.
- **DTI or SEC, never both**: one registration paper that takes either. The
  supplier is never asked to declare their legal form — the document says which
  registry it belongs to.
- The comparison anchors on the **registered** name and the owner, never the
  shop name; `business_name` and `registered_business_name` stay uncoupled.
- The standalone "Government registration number" box is folded into the
  certificate it comes off. Its anti-farm uniqueness claim keeps its ONE writer.
- `business_owner_name` and `location_city` lock on a verified shop, so they
  render as a locked line pointing at the shipped correction door rather than a
  box whose save the server refuses. Derived from `LOCKED_IDENTITY_FIELD_KEYS`.
- The seam for the document reader / registry caller is defined and EMPTY:
  `doc_uploads[slot].read`. Nothing writes it yet, so every filled line honestly
  reads "with a person at Setnayan".

26 guards, 18 mutations, all red.

SPEC IMPACT: None. Implements the owner rulings already recorded in
`DECISION_LOG.md` 2026-09-09; no locked decision moved.
