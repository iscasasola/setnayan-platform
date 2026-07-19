## 2026-07-02 · fix(vendor/notifications): repair broken push-opt-in banner styling + durable dismissal

The vendor-dashboard push-notification opt-in banner (`PushNotificationRegistrar`,
mounted in `vendor-dashboard/layout.tsx`) was styled with `obsidian` / `champagne`
Tailwind color tokens that **do not exist** in this app's `tailwind.config.ts`
(defined tokens are `cream`/`paper`/`ink`/`terracotta`/`mulberry`). Result: the
card background (`bg-obsidian/95`), the accent bell (`text-champagne`) and the
Enable pill (`bg-champagne`) all collapsed to unstyled defaults, while the two
description lines used `text-cream` — which resolves to near-white (#FBFBFA) in
light mode and rendered **invisible against the transparent (light) card**. On
screen it looked like a bare pale strip with just a dark bell and a plain
"Enable", no body copy and an invisible ✕.

Fixed:

- Re-tokenised the banner to the real palette (matching its sibling
  `profile/_components/push-toggle.tsx` + `vendor-dashboard/notifications/push-toggle.tsx`):
  `bg-cream border-ink/10` card, `text-ink` / `text-ink/60` copy, `text-terracotta`
  bell, `bg-mulberry text-cream` Enable button, `text-ink/40` dismiss ✕,
  `text-red-600` error. All resolve correctly in both light and dark mode.
- Dismissal is now **durable** instead of per-session. Previously the ✕ wrote a
  `sessionStorage` flag, so the banner re-nagged on every new tab/session even
  after the vendor closed it. Now it writes a 30-day cooldown timestamp to
  `localStorage` (`setnayan_push_banner_dismissed_until`); the banner stays hidden
  until the window elapses, private-mode storage failures fall back gracefully,
  and browser-level Allow/Block still ends the prompt forever.
- Corrected two stale/inaccurate lines in the component docstring.

SPEC IMPACT: None. Behavioural bug fix + UX polish to an existing V1 surface; no
pricing, schema, SKU, or flow change.
