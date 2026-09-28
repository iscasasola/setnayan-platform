## 2026-09-28 · feat(maker): "View as a free couple" — an internal-only switch to see the Maker as a couple without Event Hub Pro

The owner's own event is Pro automatically (internal host, §10a), so he could never see what a free couple sees. Internal accounts (`users.is_internal = TRUE`) now get one row in the Maker's **More ▾**: **View as a free couple**. While it is on, a strip under the toolbar says **Viewing as a free couple** (ⓘ explains) with **Stop**.

- **What follows it:** the Maker's work area (padlocks, Pro offers), its Love Story, the Apply bar's "needs Pro" count, Prints & Tickets and `/api/hub-print` (`printOwnsPro`), every QR (`resolveEventQrLook` — the Setnayan-mark free code), and the canvas — the public page — through its per-request `websiteProActiveFor`. All pass their Pro read through ONE function, `asViewed` (`lib/view-as-free.server.ts`).
- **View only.** `asViewed` can only turn Pro off, never on. The write gates — `eventCoupleWebsiteProActive`, `lookProAllows` (Apply), every server action and every route write — never read the switch, so the owner's draft, his Apply and his live page are unchanged. Held by `lib/view-as-free-never-changes-a-save.test.ts`.
- **How:** one cookie (`sn_view_as_free`, 24 h, set in the browser), honoured only for an internal viewer — a stray cookie on anyone else is ignored. No migration, no server action, no new route. A guest opening the public page pays one cookie lookup (no auth read).
- Guards: `lib/view-as-free.test.ts` (the rule), `lib/view-as-free-never-changes-a-save.test.ts` (render-only, internal-only).

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — new row "AS BUILT — VIEW AS A FREE COUPLE" (what follows the switch, that it never reaches a save, internal-only, and that the Event Hub Pro buy page deliberately still shows the real state).
