## 2026-10-14 · feat(supplier): Your details · Your page · Your collections — the simpler supplier dashboard, step 5

The approved prototype's moments 6 · 7 · 8 (`prototypes/supplier_easy_dashboard_2026-10-14_fable.html`), built over the
shipped editors. Shop gains **Services · Page · How it is going**; door 1 of My Shop becomes rows into the three screens.

- **Your details** — `/vendor-dashboard/profile` (a redirect since 2026-07-05, a screen again). One list with
  "N of 6 done · left: …" and the bar: Name and logo · What you do · Where you work · Contact · About · Your documents ·
  How clients pay you · Something wrong? Every fold is a shipped editor, mounted (`ProfileChecklistEditor` per fold with
  its own rows, `VerifySection`, `VenueTypeCard`, `VenueMatchCard`, `PublicLineCard`, `VisibilityCard`,
  `SuggestedCoverageCard`, `RequestCorrectionCard`, `BranchPanel`, the payment surface embedded). Thumb: "Add what is
  left". `/verify` → `#docs`, `/payment-options` → `#pay`, `/branches` → `#where`, Shop `?open=payments` → `#pay`.
- **Your page** — `/vendor-dashboard/website` (was a viewer). The page as couples see it on top (View my page · Share
  my page · "Couples can see it / Not shown yet"), then the parts in couples' scroll order. **Edits are a draft; ONE
  Apply publishes** — new action `applyVendorPageDraft` runs every part through the same `websiteFieldPatch` as the
  one-field save (allowlist + plan asks) and writes ONE update, all or nothing. The draft lives in the supplier's
  browser per shop (no new storage). The website editor's controls became the parts; its media editors moved to
  Collections; DomainManager and the auto-reply card are parts.
- **Your collections** — `/vendor-dashboard/collections` (new route, no new table): the page gallery, service card
  photos, albums by event (the private album), your own shots, delivered to couples, Instagram, the mood board library —
  count · who sees it · the "show on my page" switch where a shipped column holds it (the page gallery's section) ·
  one filter dropdown · Add photos (the shipped gallery editors). Instagram's OAuth callback now lands here.
- **Account panel** — owners and admins get Your details · Your page · Your collections · Helpers · Plan · Settings.
- **Requests** — sixteen reads left My Shop with the panels (each now runs only on the screen that draws it);
  `fetchVendorMicrosite` is one select instead of two (every public shop page); Apply is one read + one write.
- Shared files touched (assembler): `app/_components/fold.tsx` (`anchor`), `account-switcher.tsx` (`shopRows`),
  `profile-checklist-editor.tsx` (`showProgress`), `payment-options/surface.tsx` (`embedded`, `preloaded`),
  `lib/vendor-microsite.ts` (`MICROSITE_COLUMNS`, `micrositeFromRow`), `vendor-dashboard/actions.ts`.
- Guards: new `your-page-applies-once`, `your-details-are-one-list`, `a-link-into-a-supplier-fold-opens-it` (replaces
  the shop-panel one) + the three pure models' tests; re-pointed to the new homes (never weakened): my-shop doors,
  reads-at-once, probes, correction intake, venue match/type, public line, city, branches, contact view, store shell,
  verify redirect, slug, round trip. 14 sabotages red.

SPEC IMPACT: None — implements the approved prototype (DECISION_LOG 2026-10-14 "✅ APPROVE: THE SIMPLER …"). Product
calls made in the build (the six counted, the browser draft, no switch on the private album or own shots) are listed
for the owner in the PR body and the handover.
