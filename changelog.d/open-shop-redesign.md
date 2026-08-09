## 2026-08-10 · feat(open-shop): the Fable redesign of both steps — 101 words of chrome down to 56

Owner: *"design the vendor shop creation flow. only place words that is needed. improve the UX and UI as well."* Design spec by Fable against the real files; every claim below carries a citation in that spec.

**Visible copy: 101 → 56 words (−45%).** Nothing removed that prevents a mistake. The worst offender was the logo helper at **45 words**, whose format-and-size list is a *verbatim duplicate* of what the upload box prints inside itself two lines below.

**🔴 A REQUIRED FIELD THAT DID NOT SAY SO.** The city label read "Location" with **no required mark**, while both the client gate and the server reject a blank one — so a vendor skipped it and was bounced at submit with no idea why. Three separate comments still called it optional, which is how it survived. Now "City" with an asterisk.

**🔴 THE EVEN-COLUMNS FIX SHIPPED THIS MORNING DID NOT WORK AT 375px.** `minmax(9.5rem, 1fr)` needs 310px for two columns; the card's `p-7` left **285px** of content at the design-target width — so the phone the change was written for rendered **one column, sixteen rows**. Fixed by arithmetic, not taste: `p-5 sm:p-7` (301px) + `minmax(8.5rem)` (278px needed). 16 rows → 8. 🔑 *A layout fix verified on a laptop is not verified.*

**🪤 A MID-FORM EXIT THAT SILENTLY DESTROYED EVERYTHING TYPED.** "See what vendors get" sat at the bottom of the longest step, linking away to `/vendors`. The wizard holds every value in client state — nothing is written until submit — so tapping it lost the lot, at the most likely place to tap something by accident. Removed.

**Cut:** step 2's subtitle (**stale** — it advertised website and social fields that moved to the dashboard in July), and the 20-word upsell paragraph standing between the vendor and the submit button (the First Steps rail they land on immediately after does that job properly, in order, with live state).

**Reordered step 1** to name → service → events → logo, so both *required* decisions sit above the optional 180px dropzone and are on the first fold at 375px. A DOM swap inside the always-mounted div — no logic touched.

**Deliberately unchanged**, and worth naming because this codebase punishes redrawing what works: the service picker's mechanics, the flat-select fallback (deleting it turns a taxonomy hiccup into "you cannot open a shop"), the address preview's never-a-gate rule, the always-mounted form + `?step=` resume, `becomeVendor` itself, the shared validation strings, and `FileUpload` internals.

🛡 `lint-port-no-lost-controls` **caught the `<Link>` removal** and refused the build until the baseline was regenerated in the same PR — which is exactly its job: a removed control has to land in the diff as one readable line rather than vanishing. Baseline regenerated (400 routes · 675 destinations · 513 actions).

⏭ **Next, already scoped:** the owner asked that City come from an exact map location. **That flow already exists** — `reverseGeocodeNominatim` is documented as *"drop a pin → detect city automatically"* and is used for vendor branch locations today. Wiring it into this step is a reuse, not a build.

SPEC IMPACT: None — copy, layout and DOM order only. No field, validation or stored value changed.
