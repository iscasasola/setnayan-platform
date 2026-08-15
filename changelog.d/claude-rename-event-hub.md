## 2026-08-15 · refactor(naming): the couple's event page is now the **Event Hub**

Owner rename, decided this session after weighing four candidates against what the words
already mean inside the product.

### What changed

One product had **seven** names a customer could meet — "Pawebsite" on the public doorway,
"Event Website" in service lists, "wedding website" in ~20 screens, "Your Website" on the
Suite card, "Website" in the sidebar, and "Website PRO" for the paid upgrade. A couple could
not tell the free thing from the paid thing, because both were called *website*.

All customer-visible names collapse to two: **Event Hub** and **Event Hub PRO**.

### What deliberately did NOT change, and why

- **Every route and URL.** `/pawebsite` is sitemapped and indexed; `/dashboard/[eventId]/website`
  and `/studio/website-pro` are live. Moving them forfeits real search history to rename a
  string no visitor reads. **Precedent: Live Studio already ships this exact shape** — named
  "Live Studio", served from `/panood`. The divergence is now written into both files'
  docblocks so a future reader does not "fix" it.
- **`COUPLE_WEBSITE_PRO`** — the load-bearing service key. Display name only.
- **The `Website` browse tag** in the add-ons catalog. The Suite search box promises that
  typing *"website"* finds this product, and the filter matches label + blurb + **tags** —
  so the tag is what keeps that promise true after the label moved. Verified by reading the
  filter, not assumed.
- **SEO strings.** The public page title still reads *"Event Hub — Your Editorial Wedding
  Website"* and the keyword list still carries "wedding website Philippines". The brand
  leads; the phrase people actually type follows it.
- **Vendor and marketing-site copy.** `website` in this repo means at least four different
  things — the couple's page, setnayan.com itself, a vendor's own shop page, and the generic
  web concept in legal/help text. Only the first was renamed.

### One pre-existing defect fixed in passing

The vendor plan card listed *"Your own event website"* and the custom configurator said
*"Serve your event website on your own domain."* Both mean the **vendor's own shop page**,
not the couple's event page — wrong before this change and actively misleading after it,
since a vendor could read it as an Event Hub included in their plan. Both now say *shop page*.

### An adversarial pass over this PR's own diff found 16 defects, ALL MINE

29 agents · 5 lenses · every candidate attacked by a skeptic told to refute it · 23 raised,
16 survived. The first pass had reported itself complete. It was not.

🚨 **THE RENAME MISSED THE PRODUCT'S OWN PAGE.** The Event Hub hub screen still titled its
browser tab *"Event website"* and its eyebrow *"Your wedding website"* — while this same diff
renamed the links pointing AT it to *"Open your Event Hub settings"*. **The destination
contradicted the door.**

🚨 **THE PAID TIER WAS STILL SOLD UNDER THE OLD NAME IN THREE EDITOR SURFACES** — *"Unlock
Website Pro · ₱3,500"* — all linking to a buy page now headed *"Event Hub PRO"*. The review
found two; a follow-up sweep found a third it had missed. 🔑 **A review is evidence, not a
guarantee — sweep again after acting on one.**

🚨 **THE JSX LINE-WRAP TRAP BIT A THIRD TIME, and this one shipped two names in one card.**
`Included in your Website` / `PRO` split across lines, so the replacement could not match it —
directly above a sentence reading *"part of your Event Hub PRO"*. Worse: the block's own
comment and docblock had been renamed, so **the file documented a string its JSX did not
produce.** 🔑 **A prose rename must be judged on the RENDERED sentence. Three separate
instances in one change is a pattern, not bad luck.**

🚨 **GUEST-FACING AND PUBLIC SURFACES WERE SKIPPED WHOLESALE:** the credits strip on every
published event page mapped the SKU to *"Website PRO"*; five Real Stories fixtures hardcoded
*"Event Website"*; `/alaala` renamed its hero and JSON-LD but left *"Pawebsite"* on the pillar
card a visitor clicks; `/panood` was untouched and said *"your wedding website"* **nine**
times, six of them inside emitted JSON-LD; and the couple's **first-run onboarding** — the
very first time anyone meets the product — was never touched.

🔑 **THE ONE MODULE BUILT TO STOP DESCRIPTIONS DRIFTING HELD BOTH NAMES.** `studio-apps.ts`
documents itself as the single place the products are described "so the rail and the search
result can never disagree" — and its Live Studio entry still said the broadcast appears "on
your own wedding website" while `/help` said Event Hub for the identical claim. **A
single-source-of-truth is only true for the fields you actually sweep.**

### Verification

- **Typecheck: zero errors introduced.** `tsc --noEmit` on this branch and on clean
  `origin/main` produce **byte-identical** 262-error sets (all from a dependency absent in the
  borrowed `node_modules`, none in any of the 50 changed files). Counts alone were not
  trusted — the two error lists were diffed.
- **Targeted suites green:** studio-apps (13) · doorway-invariants (9) · doorway-shell (16) ·
  doorway-palette (5) · llms-txt (12) · add-ons-catalog (7) · suite-doorway-guardrails (19) ·
  nav-registry-defaults (8) · admin-nav-groups (4) · env-flag (12).
- **A line-wrap artefact was caught and fixed**, not shipped: the pricing page had rendered
  *"a full planning workspace, your wedding Event Hub, and the tools"* because the original
  sentence broke across two JSX lines and only one half carried the old word. A second sweep
  found the same shape on the Our Story screen. 🔑 **A prose rename must be judged on the
  RENDERED sentence, not the matched line.**

SPEC IMPACT: Yes — `DECISION_LOG.md` row 2026-08-15 (product rename + the name/route
divergence rule). No schema change, no migration, no pricing change.
