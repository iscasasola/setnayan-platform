## 2026-07-04 · feat(admin): Custom plan requests inbox on /admin/custom-plans

- `apps/web/app/admin/custom-plans/page.tsx` — added a "Custom plan requests" inbox above the composer: a server-side query of `vendor_custom_plans` for open statuses (`pending_payment` = a vendor composed & requested on their subscription page, `quoted` = a Setnayan quote still out), joined to the vendor's name + current tier. Each row shows the vendor, a one-line composition summary (only the dials above base), the quoted 28-day price, a status badge, and a "now {tier}" hint, and links to `/admin/custom-plans?vendor={id}` to open the composer scoped to that vendor. Empty state explains where requests come from. Count badge in the heading.
- Pure read + UI: no migration, no new deps. Uses the existing admin client (bypasses RLS) + the `vendor_custom_plans` table shipped in PR-A. Answers "show the vendors who requested" rather than only "look one up".

SPEC IMPACT: None — surfaces the already-shipped vendor_custom_plans data (VENDOR_TIERS_AND_BENEFITS.md §11).
