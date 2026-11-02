## 2026-06-20 · feat(ui): toast bridge now lights up all existing success redirects (flow wave D, feedback sweep #1)

The toast primitive (#1919) shipped a `?saved=/?error=` URL bridge, but the codebase **already had 29 server-action redirects** using a wider set of success flags (`?saved=1` ×32, plus `?created`, `?updated`, `?added`, `?sent`, `?removed`, `?deleted`, `?completed`, `?done=approved|rejected`) that **no page read** — the classic "redirect drops all feedback" defect the user-flow audit flagged across many surfaces. Expanding the bridge to recognise them lights up **all 29 sites at once, with zero per-site change** — the highest-reach first move of the 79-finding feedback lever.

- **`apps/web/app/_components/toast/toast-from-params.tsx`** — recognises `saved/created/updated/added/sent/removed/deleted/completed/done` (verb-appropriate copy; non-`1` values appended, e.g. `?created=ABC123` → "Created — ABC123"; `?done=approved` → "Approved."), keeps `?error[&msg]` and the `?msg=` override, and strips all handled keys after firing. StrictMode-safe (sets the fired-guard before side-effects).

Examples now live with no further code: `saveVendorProfile` → `/vendor-dashboard?saved=1` (the audit's critical "vendor save drops feedback" — now toasts), admin settings/pricing/discount-codes/refinements saves, website-section saves, etc.

Minor known trade-off: a page that *already* renders its own success banner for the same param will now also toast (harmless redundancy; a later cleanup can drop the now-duplicate banners). Per the audit, the large majority read nothing → net large win.

Verified: single self-owned file (no contention); deterministic param→toast logic; no schema. tsc/lint/build via CI. The throwing-action → `?error=` conversions (the rest of the feedback sweep) follow per-surface, now conflict-free (#1733 closed).

SPEC IMPACT: design-system/UX only. Flow wave D. Backlog: `02_Specifications/User_Flow_Audit_Backlog_2026-06-20.md`.
