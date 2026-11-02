## 2026-08-10 · fix(vendors): a shop with no pin was being filed at Null Island

Found by resetting the owner's test account, not by a test. The row that `testnayan4@test.com` created by walking the /open-shop wizard held:

```
location_city  = '76 sampaguita ave'     -- a STREET, in the CITY column
hq_address     = NULL
hq_latitude    = 0.0000000               -- Null Island
hq_longitude   = 0.0000000
```

**0,0 is open ocean in the Gulf of Guinea, about 500 km off Ghana.** Every distance filter in the app measures from the stored pin, so that shop was ~10,000 km from every Philippine wedding: silently absent from "near me" lists, near-me sorts, the couple's vendor tab, the fit page, free-transport radius and auto-accept — while its own dashboard looked completely fine.

### One line of JavaScript, and it looks careful

```ts
const lat = Number(formData.get('hq_latitude'));
if (Number.isFinite(lat) && Math.abs(lat) <= 90) { …write it… }
```

`formData.get()` returns **`null`** for a field that was never submitted, and **`Number(null)` is `0`**. Zero is finite. Zero is inside ±90. So the guard whose entire job is rejecting bad coordinates waved the *absent* one through and wrote it to the database. `Number('')` is 0 too, so an empty box does the same.

🔑 **THE FOURTH COSTUME OF THE HOUSE DISEASE.** Nothing threw, nothing logged, CI was green, and the only symptom was an **absence** — a shop missing from lists it belonged in. Same shape as the phantom column, the phantom enum value, the phantom RPC argument and the CSP-blocked iframe. What makes this one nastier is that the wrong value is not garbage: it is a *plausible number*, so nothing downstream had any reason to doubt it.

### Three copies of the rule, and the wrong one was the one that shipped

The app already contained **three** hand-written coordinate parsers. Two were correct — they string-check before coercing. The third was the wizard's. A rule kept in three places is how a fix reaches some screens and not others, so all four sites now call one tested `parseCoordPair`.

| site | before |
|---|---|
| `app/open-shop/actions.ts` | 🔴 the defect — wrote 0,0 to prod |
| `app/admin/venues/actions.ts` | 🔴 **same defect, second surface** — an admin saving the venue form with the coordinate boxes empty filed the venue at Null Island instead of being told to fill them in |
| `app/vendor-dashboard/actions.ts` | ✅ already correct, folded in |
| `app/vendor-dashboard/branches/actions.ts` | ✅ already correct, folded in |

**Two extra rules the helper enforces that none of the three copies did:**

- **Half a pin is not a pin.** A latitude parsed without its longitude put a business on the Greenwich meridian — a different continent, from one missing field. Coordinates are now read as a PAIR or not at all.
- **The exact pair 0,0 is refused** as the no-data artifact it is. Rejected only as a pair, never per value: latitude 0 is the equator and longitude 0 is the Greenwich meridian, and people live on both. The string check already stops the way we produced it; this stays because it is not the only way to produce it.

Mutation-tested — restoring the old `Number(raw)` shape fails 4 of the 8 tests.

### Also found, not fixed here

- **The two remaining prod vendors both have `location_city = NULL`**, so the marketplace's city filter has nothing to work with for either. Separate question from this bug.
- 🚨 **A vendor profile cannot be deleted at all.** `vendor_team_guard()` raises `VENDOR_LAST_ADMIN` on removing the last admin — with **no exemption for "the parent row is going away"** — so the cascade from `DELETE FROM vendor_profiles` trips its own guard. Measured against prod: the delete was refused, and only succeeded after suspending the trigger for one transaction. Correct rule, missing inverse — the shape recorded in [[feedback_a_forward_primitive_with_no_inverse]]. Under audit separately; not touched here because whether erasure anonymises instead of deleting decides whether this ever reaches a real user.

Verified: **7325/7325** unit · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None.
