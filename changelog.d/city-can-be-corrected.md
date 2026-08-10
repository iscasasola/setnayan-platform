## 2026-08-10 · fix(vendors): the city was the one public claim on a shop that nobody could change

Measured in prod: a vendor typed their street into the City box at signup and their shop read `location_city = '76 sampaguita ave'`. Every couple filtering by city missed that shop from that moment on — and there was **no way back**. No city field anywhere on My Shop, and the only admin writer refuses claimed shops.

### RULE 0 first — almost none of this was new

A correction system already ships: `vendor_correction_requests`, a vendor-side request form, an admin approve/decline queue at `/admin/corrections`, an audit trail, and a generic apply step. The city simply **was not one of the fields it knew about**. So this is a delta, not a screen:

| already existed | added |
|---|---|
| request → approve → apply, with audit | `location_city` in the locked-identity field list |
| the "verified shops must request" lock | a `case` so the approval can actually apply it |
| the My Shop address row with its map | a City input **inside** that row |

🔑 **Inside the address row, not as its own checklist item.** Two reasons: a street and the city it sits in are one fact, and splitting them invites the two to disagree. And a new checklist row would have flipped **every existing vendor's Business Profile from complete to incomplete overnight**, for a field they were never asked for.

🔑 **Locked rather than freely editable, matching the address.** The city is a claim about where the business physically is — checked against their DTI registration, BIR 2303 and Mayor's Permit. A verified shop must not be able to quietly relocate. An unverified vendor edits it inline; a verified one files a request an admin approves.

### The silent half

`saveUnclaimedVendorProfile` ends with `.is('user_id', null)` — deliberate, so an admin cannot overwrite a profile a vendor claimed mid-edit. But on a claimed shop that filter **matches zero rows and PostgREST returns no error**. The admin pressed Save, saw no complaint, and nothing changed. Silence indistinguishable from success.

It now asks for the rows back and refuses out loud, naming where the change *can* be made — a refusal that does not say what to do instead is a dead end wearing the shape of an error message.

🪤 **Same family as the rest of this week:** a phantom column, a phantom enum value, a phantom RPC argument, a blocked iframe, a fall-through upload prefix. **The database or the browser declines, and the only symptom is that nothing happened.**

### The guard

Adding a key to the locked list makes the REQUEST possible; without a matching case in `parseRequestedValue` the admin's Approve button falls through and applies something the field never meant, so a vendor waits for an approval that cannot work. The test walks **every** locked key and asserts each has a label, an apply case, an input, and a save path.

Mutation-tested: removing the city from the locked list (1 fail), and the subtler one — keeping the key but dropping the admin apply case (1 fail).

Verified: **7367/7367** unit · 20/20 `lint-*.mjs` · `tsc` clean.

⏭ **Known and left alone:** editing the address on My Shop does not re-derive the city, so the two can drift apart. Auto-overwriting a city a vendor deliberately typed is a worse failure than drift, and choosing between them is a product call.

SPEC IMPACT: None — the correction contract gains a field; no rule changes.
