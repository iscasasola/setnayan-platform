## 2026-06-30 · fix(home): remove decorative cookie pill from homepage reskin

The reskinned homepage (PR #2432) carried over a "voice riff" cookie pill from
the prototype — a fixed bottom-right glass chip reading "Cookies help us
remember / Accept / Manage" where both buttons only dismissed it. It set no
cookie and stored no consent, so it was a purely cosmetic element with no
function. Owner asked to delete it. Removed:

- `HomeReskin.tsx` — dropped the `<CookiePill />` mount and the `CookiePill`
  component function (`useState` import retained — still used elsewhere).
- `home-reskin.css` — removed the orphaned `.hr-cookie` / `.hr-mng` block.

SPEC IMPACT: None — removed a non-functional decorative element; no schema/SKU/pricing/flow change. (Note: a real RA 10173 cookie-consent banner belonged to the RETIRED 0039 display-ads iteration; this pill was never that system.)
