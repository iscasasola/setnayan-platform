## 2026-07-10 · fix(admin): preserve ?tab= when submitting an in-tab filter in the Insights Studio

Follow-up to the Insights Studio (App Performance → tabbed `/admin/app-performance`). Four tabs render a `<form method="get">` range/vendor/quiet filter (growth · intelligence · funnels ×2 · cockpit). A GET form submits to the CURRENT path — now the studio shell — so the submitted query REPLACED the URL query and dropped `?tab=`, bouncing the user back to the Overview tab every time they changed a filter.

Fix: a hidden `<input type="hidden" name="tab" value="<tab>" />` in each of the 5 GET forms so the submit preserves the active tab. No other behavior change. (The cockpit form's tab is `overview`, which is the default anyway, but it's added for consistency.)

Verified: production build passes; the range/vendor filters now keep you on their tab.

SPEC IMPACT: None.
