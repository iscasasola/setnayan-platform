## 2026-08-27 · fix(vendor): "+ Create service card" opened a page, scrolled nowhere, opened nothing, and said nothing

A supplier with **no service cards yet** — exactly who the button is for, and that includes SetnaProd, the owner's own live published shop — pressed **+ Create service card** at the top of their Shop and appeared to land on a normal My Shop page with nothing highlighted. No error, no scroll, no picker.

**Three failures stacked, and each one alone is enough to break it.**

1. **The fragment was dropped in transit.** The href was `/vendor-dashboard/services#add-service-picker`. That address has been **retired as a destination since 2026-07-02** and `redirect()`s to My Shop — and the redirect rebuilds the URL from **query params only**. A `#fragment` never reaches the server in the first place, so there was nothing to forward.
2. **It landed on the wrong tab.** My Shop's services block is one card with three tabs — Coverage · Service cards · Tools — and the shipped rule sends you to Service cards when `services.length > 0`. So the tab was right for every established shop and wrong for **the vendor with zero cards**. The picker lives in Service cards; they landed on Coverage. Panels stay mounted but `hidden`, and no browser scrolls to an anchor inside a hidden panel.
3. **The picker itself was shut.** It is a `<details>` that was `open` only when a category had been requested. Even on the right tab, it is a closed drawer.

**🔑 The existing guard asserted this button and passed throughout.** `create-follows-the-surface.test.ts` checked the href, then checked that an element with that id **existed**. Both were true the entire time the button was dead. **Existing is not the same as reachable** — three conditions have to hold at once, and a test that checks one of them goes green while a supplier presses a button that does nothing.

**⚖ Four call sites, found by grepping the target rather than working from the reported one.** The report named the Shop bar button. Every link in the product that aims a supplier at *making a card* had the identical dead end:

| where | what it says | who sees it |
|---|---|---|
| the Shop bar | "+ Create service card" | every supplier |
| **the first-run checklist** | **"Put up your first service"** | **only while they have zero cards** |
| the music repertoire page | "Add a music service" | an act with no music service |
| empty earnings | "Add services on the Services tab" | a shop with no bookings |

The second is worse than the reported one: it is **step two of a new supplier's own onboarding checklist**, and it renders *only* when `serviceCount === 0` — precisely the state that lands on Coverage.

**What changed**

- **`lib/service-picker-anchor.ts`** — one leaf owning the anchor id, the query param and the whole href, imported by both halves. This repo already had `lib/admin-map/sku-anchor.ts` for exactly this, and its docblock names this bug word for word: *"a href written in one file and an `id` typed in another … the link works, the page opens, and it simply does not scroll to anything."*
- The href now points at **My Shop directly**, skipping the retired stub, and carries `?newcard=1` — an **intent the server can read**, which is what it needs before it can choose a tab or open a drawer.
- A picker request selects the **Service cards** tab and renders the `<details>` **open**. ⚖ The coverage-first default is **not** reversed: a supplier who simply opens My Shop still starts on Coverage. Only an explicit "make me a card" press moves them — the one case where coverage-first is the wrong answer.
- All four links use the shared href. A guard pins each one and fails if a fifth is ever hand-typed.

**The port baseline is regenerated, and here is the count.**

`lint-port-no-lost-controls` fails when a ported route can no longer reach something it used to offer, and its own message says to regenerate in the same PR. That is what happened. **Counted, not assumed** — a structural diff of the baseline before and after, per route:

| route | change |
|---|---|
| `/vendor-dashboard` | − `/vendor-dashboard/services` |
| `/vendor-dashboard/earnings` | − `/vendor-dashboard/services` |
| `/vendor-dashboard/repertoire` | − `/vendor-dashboard/services` |

**Nothing is lost by any of the three.** `/vendor-dashboard/services` is not a page — it is a **retired redirect stub** (owner 2026-07-02, *"My Services" folded into My Shop*), and its own docblock says so. Each of these three links now goes straight to the editor's real address with the picker open, one redirect hop shorter. The stub redirect is also exactly what *dropped the fragment* in transit, which is the bug being fixed. Zero routes were added or removed, and **zero actions changed**.

⚠ **Two further destination lines moved, and they are NOT this PR's** — recorded here rather than left for a reader to trip over:

| route | change |
|---|---|
| `/[slug]` | + `/[seg]/recap` |
| `/admin` | + `/admin/search-memory` |

Both are **additions**, both belong to `main`, whose committed baseline was stale about them — this branch changes no file under `app/[slug]` or `app/admin`. They were absorbed because the baseline is generated from the whole tree and cannot be regenerated for three routes only. They are safe by direction: this guard fails on **removals**, so an added line can never hide a lost control — it can only make the guard *stricter*, by requiring those two links to keep existing.

⚖ **The guided wizard is untouched**, checked rather than assumed: `/vendor-dashboard/services/new/[category]` is a separate segment, still its own route in the baseline, still reachable from the stub, and its live callers still link to it.

SPEC IMPACT: None — no SKU, price, schema or product rule changes. The owner-locked `CREATE` wording (2026-08-15) and the `.fd-btn-gold` treatment are untouched; only the destination changed.
