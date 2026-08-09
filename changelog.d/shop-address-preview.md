## 2026-08-10 · feat(open-shop): your shop name IS your web address — now shown while you type, with the spaces taken out

Owner 2026-08-09: *"Shop name will be their slug as well. This means you will show what their website address would look like… then a text under saying: your website: www.setnayan.com/banaweflorals and a sign if available."* Then, on being shown the address was minting `banawe-florals`: **"remove spaces for the slug."**

### The rule changed

`slugify_business_name` collapsed every run of non-alphanumerics into a HYPHEN; it now **drops** them (migration `20271123576947`). Lowercase → transliterate accents → expand `&` to the word "and" → strip everything else.

| name | was | now |
|---|---|---|
| Banawe Florals | `banawe-florals` | **`banaweflorals`** |
| Bloom & Vine Studio | `bloom-and-vine-studio` | `bloomandvinestudio` |
| Mañana Photo Co. | `manana-photo-co` | `mananaphotoco` |

⚠ **EXISTING ADDRESSES DO NOT MOVE, and that is the point.** The generator returns early when `business_slug IS NOT NULL` — an address is never reissued, because a save-the-date posted months ago points at it. The fixture shop keeps `saysay-live-band-and-hosting-fix` forever. **No backfill, deliberately**: a "tidy up the old hyphens" pass looks harmless and would break every link already handed out. There is now a test that fails if anyone writes one.

⚠ Hyphens stay legal in a *manually chosen* address — `VENDOR_SLUG_RE` is unchanged. This governs only what is MINTED from the name.

### Availability and the counter already existed

Owner: *"must be available. if not available we will add a numerical value integer?"* — **the database already did exactly that.** `generate_business_slug_for_vendor` probes reserved words, every other vendor's slug **and every event's slug** (they share the one top-level namespace, and `app/[slug]/page.tsx` resolves an event BEFORE a vendor, so an event-shadowed address would be dead on arrival), then appends a counter, 50 attempts, then the row's public id. Only the separator changed: `banaweflorals2`, not `banaweflorals-2`.

🔑 A second shop literally named "Banawe Florals 2" now slugifies onto an address the first collision may hold — the loop's own taken-check catches it and moves on. No new hazard: the probe was always the authority, never the arithmetic.

### The preview, and the trap in building one

`lib/business-slug.ts` mirrors the SQL in TypeScript so the wizard can show the address before any row exists. **A mirror that drifts is worse than no mirror** — the vendor reads one address and is issued another, with nothing anywhere reporting a problem.

🛡 So `tests/db/business-slug-mirror.db.test.ts` runs BOTH implementations over a corpus chosen for where the rule is easy to get subtly wrong — ampersands, accents, apostrophes, emoji, pure punctuation, non-Latin script, the 32-char clip, names of exactly 32 characters — and fails on the first disagreement. **Order of operations is the fragile part, not the character set**: strip separators before expanding `&` and "Bloom & Vine" silently becomes `bloomvine`. Pinned explicitly, plus a neutralisation case proving a naive mirror is caught.

The UI renders in **two layers on purpose**: the address itself is instant (pure function, no round trip, no flicker while typing); the availability sign arrives debounced from the server. Making the whole line wait on the network would leave a vendor staring at nothing while typing their own shop's name.

⚠ **The sign is never a gate.** A taken address does not block the name — the database numbers it inside the write transaction, and two vendors may be typing the same name right now. Refusing a legitimate business name over a race the database already handles would be the product being wrong on purpose. The copy says what WILL happen ("yours will be …2"), never "pick another".

🪤 **Three states that look like one and are not.** A failed availability read renders **nothing** — `count === null` means NOT MEASURED, and showing "Available" for an unmeasured address is exactly how a vendor ends up with a different one than the screen promised. Reserved words are decided in code (no round trip, and the one answer that cannot go stale). And a 1–2 character name is legal but genuinely un-previewable — the database builds that address from an id the row does not have yet — so it says so plainly instead of inventing one or scolding the name. The check reads through the service-role client because an anonymous vendor cannot read other vendors' rows under RLS, and "free" from an RLS denial is the same `count: 0` trap.

Stale-response guard on the debounce: a slower answer for an earlier name must not overwrite a newer one, or typing "Banawe Flor" then "Banawe Florals" settles on the first result — a sign about an address the vendor is no longer proposing.

### Logo formats — answered, not changed

Owner asked whether to accept EPS/SVG/PNG for transparent backgrounds. **PNG and WebP already keep transparency and are already accepted** — nobody was told, so vendors upload JPEGs with white boxes. The help text now says it.

⛔ **SVG is refused, and should stay refused:** an SVG can carry executable script, so accepting vendor uploads and serving them from `setnayan.com` is a stored-XSS vector against whoever views the page. `next/image` also refuses SVG unless a flag literally named `dangerouslyAllowSVG` is set. ⛔ **EPS cannot be displayed by any browser** — it is a print format needing server-side conversion, and a PNG exported from the same artwork is identical in practice.

⏭ **OWNER DECISION, flagged not taken:** *"They can rename their slug after creation"* is true only for **Pro and above** — `business_slug` sits in `PRO_WEBSITE_FIELDS`, gated on `tierCaps.customWebsiteName`. Free and Verified shops cannot change their address at all. Opening a paid differentiator to every tier is a monetization call, not a side effect of this change.

Verified: **7261/7261** unit tests · 17/17 across both slug db suites (including the pre-existing mint suite) · all 20 `lint-*.mjs` · migration timestamp guard · `tsc --noEmit` clean.

SPEC IMPACT: `Vendor_Monetization_Model_LOCKED_2026-07-25.md` — custom address remains Pro-gated pending the owner decision above. `DECISION_LOG.md` row added.
