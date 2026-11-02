## 2026-08-07 · fix(launcher): the vendor's uploaded logo never appeared on their shop card

Owner, looking at his own account: *"logo did not show."* He was right, and the logo **is** uploaded.

🪤 **`logo_url` DOES NOT HOLD A URL.** It holds an `r2://bucket/key` reference by design. A browser cannot load that scheme, so passing it straight to an image renders nothing and the card falls back to the generic shop glyph. **Nothing errored — a broken image is not an exception.**

The launcher already resolved event hero images correctly **~50 lines above** the shop cards, in the same file. The shop cards were simply missed: a partial application of the right pattern.

🛡 `lint-stored-asset-refs.mjs` — and **writing it was the story.**

**Two cuts of this guard passed while the bug was present:**
1. The first exempted any file containing `displayUrlForStoredAsset`. The launcher resolves hero images, so the file was "trusted" and the raw logo sailed through — **blind to the exact bug it was written for.**
2. The second matched only JSX (`src={row.logo_url}`). The launcher builds card *objects* (`spaces.push({ logoUrl: vp.logo_url })`), so it was blind again.

Only the third cut fails when the fix is reverted. **Narrow is right; narrower than the code is useless.** Both failure modes are recorded in the file so nobody re-narrows it.

⚠ **It found 16 more surfaces doing the same thing** — including the public shop page, the marketplace vendor card, the home spotlight strip and the vendor-invite page. Baselined rather than fixed here: failing the build on 16 pre-existing sites would have got the guard switched off within a day. The list is the debt register, and the guard also **fails if a listed file is fixed but left on the list**, so the count cannot quietly lie.

Severity varies — the marketplace card checks the value and falls back to a placeholder, so it degrades quietly; others render a broken image. Both mean the vendor's logo is missing.

🪤 Wiring verified in all three CI places (step id · env var · check call) — these guards are `continue-on-error` and aggregated separately, so one missing from the env block passes silently forever.

SPEC IMPACT: None — a rendering fix.
