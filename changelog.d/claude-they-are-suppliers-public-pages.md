## 2026-09-27 · copy: public pages say "supplier", never "vendor" (phase 1 of 4)

Owner, 2026-09-27: *"we will also stop calling them vendors · we will start
calling them suppliers across the whole website"*.

Phase 1 covers the public pages: the ones Google and answer engines read, and
the SEO/GEO win. That is 362 words across 50 files: the front door, the (shell)
doorways (marketplace, explore, pricing, setnayan-ai, schedule, …), /features,
/vendors, the shop page, help, blog, /llms.txt, metadata and JSON-LD.

- **Copy only.** Code names are frozen, the same split as "Event Hub, never
  website" (2026-09-24): `vendor_profiles`, `/vendor-dashboard`, `VendorCard`,
  the `/vendors` URL, help-article slugs, and the `?as=vendor` sign-up parameter.
  The automated sweep had changed that parameter; review caught it and restored
  it.
- **New guard:** `lib/public-pages-say-supplier.test.ts` fails if a public page
  shows a reader the word "vendor". It reads phrases, not keys or paths, and uses
  the one canonical comment stripper. Sabotage-checked: re-adding a phrase goes
  RED.
- **Left for the owner, and visible in the guard's `LEGAL_PENDING`:** /privacy,
  /terms and /acceptable-use. There "vendor" can be a defined legal term (the
  Vendor Agreement), so renaming it is a legal change, not a copy change.

Next phases: the couple dashboard, the supplier dashboard, then admin.

SPEC IMPACT: DECISION_LOG row 2026-09-27 ("SUPPLIERS", NEVER "VENDORS") already
records the rule. No spec file changes.
