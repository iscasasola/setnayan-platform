## 2026-07-25 · fix(admin): rename the "Money" nav group to "Money & Settings" so the settings tail is findable

Owner, hours after the Secrets & Rotation board shipped: *"i cannot find the button for secrets."*

The page had two doorways (a tile on `/admin` and a sidebar row registered beside Integrations), so nothing was orphaned — but the sidebar row lives in the collapsed `settings-group`, whose label has read **"Money"** since 2026-07-04. That group's tail is now six items long and none of them are money: Compliance · Notifications · Demo mode · Integrations · Secrets & Rotation · Account security. Nobody hunts for a credential under "Money", so in practice the row was invisible.

Renamed the group label to **"Money & Settings"** (the `settings-group` key is unchanged, so the collapsed/expanded localStorage state carries over). Renaming beats moving: these genuinely are the visit-least settings, and promoting the tail to a seventh top-level group would trade one wayfinding problem for a longer sidebar.

SPEC IMPACT: None — label-only change; no routes, entitlements, or data touched.
