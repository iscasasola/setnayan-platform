## 2026-11-18 · perf(speed): the account, the users row, the delegate grant and the dashboard's event row are each read once per render

Stacked on `claude/speed-await-chains-1118` (#7987). Owner target: every page under 0.7 s at 390 px. Nothing changes on screen, and every refused read still says so where it did. No `use server` export, no migration.

- **The account (134 pages).** A codemod replaced each page's own `supabase.auth.getUser()` with the cached `getCurrentUser()` (`lib/auth.ts`, one Auth-server round trip per render). It also removed the cookie clients and imports left unused. Two hand edits: onboarding `[type]` and the guest's invite door. This is equivalent, not just close: on the cached hub and shop routes (the one place `getCurrentUser` answers without the request), the middleware only sends requests that carry no session.
- **The users row.** The dashboard, supplier and admin layouts and the account switcher each read it, which made two round trips per page. They now ask `getUserRow` (`lib/user-row.ts`, `cache()`d), which reads the union of their columns and keeps the dashboard layout's column-drift `SELECT *` fallback for everyone.
- **The delegate grant.** `fetchEventViewer` (22 callers), the People page, the Schedule's advance check and the budget's visibility sent the identical `event_moderators` request. They now ask `eventDelegateGrantOnce` (`lib/event-delegate-once.ts`, `askedOnce`), shaped like `eventMemberTypeOnce`. Reads of a different shape (excluding viewers, listing every seat) keep their own.
- **The dashboard's event row.** 31 `[eventId]` pages whose own `events` read names only columns the layout's one read already carries now ask through `eventRowOnce`. It answers from that read, or sends the page's own read unchanged. 15 reads name columns the row does not carry and are left alone: widening `DASHBOARD_ROW_CARRIES` needs the events grant and view review, so it was not done here.
- **The shop page (`/v/<slug>`).** The demo-mode and bookings-open gate reads are asked together. The logo URL and the guests' reviews and card numbers start before the unlisted-events reads.

Checked, not changed:
- `app/[slug]/layout.tsx`: `loadGuestLook` already starts from the same cached `loadEventShell` promise, so there is nothing to overlap.
- The `[eventId]`, supplier and admin layouts already batch their chrome behind the gate that decides a 404.
- `vendors/page.tsx` and `website/editor/page.tsx`: #7795 owns them.

Guards:
- New: `lib/pages-ask-the-account-once.test.ts` (no page or layout calls `auth.getUser()`; proven red on a sabotage page) and `lib/reads-once-per-render.test.ts` (users row · delegate grant · carried event reads, with a detector test both ways).
- Updated: `the-guest-page-starts-its-reads-together` (the invite door now starts `getCurrentUser`).

SPEC IMPACT: None.
