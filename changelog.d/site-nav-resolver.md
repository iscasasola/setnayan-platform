# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-04 · feat(guest-site): the event-site navigation resolver — every owner ruling, in one testable place

Sixth and final build item of the event-website work. The bar the owner steered through five rounds on 2026-08-03: **one bar, five slots, resolving for whoever is holding the phone.**

**Ships as a PURE function, deliberately not yet mounted** — same shape as the six-state primitives (#4064). Every rule here is an owner *ruling*, and rulings are what regress: someone tidies a branch and quietly reverses a product decision nobody remembers. Keeping them in one tested place means the next person has to change a **decision**, not a layout, and the failure message names which one.

**The rulings it encodes, each with a test whose message quotes it:**

| Ruling | Behaviour |
|---|---|
| *"the couple always have their papic. since they can take photos anytime"* | The couple's camera is **unconditional** — no phase, no switch removes it. |
| *"the papic service will always run but the host of the event has the power to allow use and not allow use"* | For everyone else the gate is the **host's switch**, not the calendar — and a closed camera is **drawn and LOCKED**, never absent, never a dead button. |
| *"gallery will be optional if the couple allows which chapters are viewable in public"* → *"not see at all"* | With no chapter public the Gallery slot is **not drawn** for anyone but the couple. |
| *"papic button as well"* | A live broadcast earns **its own slot** and may not cost the gallery. |
| *"these functions … only shows when they have that service for the event"* | A supplier's last slot carries only the kit their booked category unlocks — and it is a **set**: *"there is a stylist and an emcee both in 1 service"*. |
| *"papic is not used by photographers"* | Suppliers get **no camera slot** — Papic is a guest product. |

🔑 **The asymmetry between the locked camera and the hidden gallery is the subtlest thing here, and it is deliberate.** A locked camera reveals a *feature that is coming* — fine to promise. A greyed-out gallery would reveal that *photographs exist and are being withheld* — the very thing the couple asked to keep private. **Announce features, hide content.**

⚠ **Naming lock honoured:** the photo slot is **"Gallery", never "Photos"** (`site-menu.ts` carries the owner rename). The interactive prototype used "Photos" and would have shipped the wrong word.

Labels are one word and ≤9 characters, asserted across every viewer × phase combination: at ~70px a two-word label wraps, grows its slot, and tilts the whole bar.

**Mutation-verified, four ways.** Making the couple's camera conditional, hiding a closed camera instead of locking it, greying a private gallery instead of hiding it, and letting Watch take the gallery slot — each fails its own test.

Verified: 6,333/6,333 unit tests, `tsc --noEmit` clean. Additive only — no component mounts it yet, so nothing renders differently.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-03. Adoption (replacing the five-tab browse menu and reconciling it with the seven-panel day-of hub) is a follow-up, and the two-menu question remains an owner call.
