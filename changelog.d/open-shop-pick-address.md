## 2026-08-10 · feat(open-shop): map-pin city, logo above the name, a position field — and the address becomes a permanent CHOICE

### The address is CHOSEN, and it is permanent

Owner: *"slug cannot be renamed so they need to pick their preferred slug."* This **reverses** the same day's earlier *"renaming can be for free. no need to add to pro"* — and the reversal changes what the control has to be. A preview is something you glance at; this is the only moment a vendor will ever get to decide their address.

So it is now an editable box: prefilled from the shop name, held to the address alphabet as they type, with a live availability answer and the words **"you can't change this later"** on it.

- **It follows the shop name until they touch it.** After that it stops following — from that point the vendor has an opinion, and silently overwriting it would be the control fighting them. No "reset to match name" button: a third state to explain for a case solved by clearing the field.
- **It can never submit blank.** Cleared → falls back to the shop name's slug. An empty address is not a choice a vendor can meaningfully make; the database would mint one anyway.
- **"Taken" is now actionable.** Under the old auto-minted model the database numbered a collision and telling the vendor to pick another would have been noise. Now it is the only useful thing to say.
- **A re-run on a shop that already has an address renders it read-only**, because it cannot be changed and the database returns early for the same reason.

🔑 **The chosen value is written alongside `business_name`, which is what stops the trigger minting its own** — `tg_vendor_profiles_generate_business_slug` returns early when `NEW.business_slug` is already set.

🔑 **Reserved words are refused BEFORE the write, and this is not cosmetic.** `app/[slug]/page.tsx` answers `notFound()` for a reserved word *before* it looks for a vendor — so a shop holding one would be permanently unreachable, with no rename to escape through.

🪤 **A lost race is a collision, not a crash.** Availability is checked while they type, but two vendors can be typing the same word; the unique index is the authority. `becomeVendor` now recognises `23505` and returns "That web address is taken — pick another" instead of the raw Postgres text.

🪤 **The read-only branch sat above the hooks first** — which reads perfectly fine and is a rules-of-hooks violation: `existingSlug` is a prop, so a render that returned early and a later render that ran four hooks would change the hook order. `tsc` cannot see it. Moved below every hook.

⏭ **OWNER DECISION NOW OPEN AGAIN.** `business_slug` still sits in `PRO_WEBSITE_FIELDS` on My Shop, gated on `tierCaps.customWebsiteName`, and the public tier matrix still advertises **"Custom URL / slug"** as a Pro benefit. If the address can never be renamed, that control should be retired and that marketing row changed — but removing an advertised paid differentiator is a monetization call, not a side effect of this PR.
