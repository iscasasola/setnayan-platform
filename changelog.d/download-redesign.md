## 2026-06-25 · design(download): modern-minimalist /download redesign + login-first copy

Reworked the `/download` page ("Setnayan, on your Mac") to a cleaner, airier
editorial layout and updated the copy to reflect the login-first desktop shell
(#2191) — the app now opens straight to the user's account, not the marketing
homepage.

Design (all within the locked Clean Editorial tokens — Warm Alabaster bg, Deep
Obsidian text/CTAs, Champagne Gold as the single accent; no new colors):

- Hero: more vertical air, hairline gold eyebrow, tighter display type, a
  second lead line stating it opens straight to your account.
- Install steps: dropped the four bordered cards for a borderless editorial
  grid — oversized champagne numerals (01–04) over hairline top rules. Step 4
  now mentions the persisted session ("Sign in once — it remembers you").
- Good-to-know: replaced the amber alert card + boxed requirements with two
  quiet hairline-divided columns; the requirements line now reads "opens your
  account in a native window."

Preserved: the SiteHeader, the ISR (`revalidate=3600`), the nav-registry label
overlay, and the page's single signature motion moment (the self-assembling
ProvisionCard) — untouched. Removed an unused icon import.

SPEC IMPACT: None — marketing-surface restyle + copy; no schema/SKU/pricing/flow
change.
