## 2026-11-19 · fix(supplier, public): the low audit findings — honest small states, 44-px presses, visitor copy and 404 titles

From the supplier dashboard audit (2026-11-17, L rows):

- **D-9** · Dates › "Couldn't read the hours · Try again" presses at 44 (`sn-hit`) — it opted out of the floor with `min-h-0` and was ~18 px tall. Drawing unchanged.
- **C-8** · the picked client's four "Event brief" back links (production sheet, editorial, cocktail, seat plan) wear `sn-hit`; the cocktail resize handle wears `sn-hit-2d`. (The editorial ✕ and the colour-lane input were already 44 on main. The cocktail booth/sign edit + remove pair is left: their halos would overlap on a short label and Remove has no confirm.)
- **V-11** · `card-check-actions.ts` — an unresolved shop (signed out / profile read refused) answers every photo `unchecked` ("Couldn't check … — Create checks again"), never `[]`, which read as "no photo problems".
- **H-6** · "Questions for the couple" — the ask is saved, but when the chat note fails to post the button now says so under "Sent" (`chatLine` on the sent state).
- **F-2** · Forms — "This event's forms · 0" is no longer drawn above "We couldn't load this event's forms"; the count shows only for a read list.
- **F-3** · Form Maker and form view — a thrown save/send/keep says "That didn't go through. Reload and try again." in place instead of going quiet.
- **P-3** · Prints — the back press says "Back to Prints" when the prints were opened from Shop › Prints (was "Back to Promote"), and presses 44 wide (`sn-hit-2d`).
- **G-1** · Settings › Notifications reads `readUnreadNotificationCount` (null on a refusal) and says "Couldn't count what's new just now" instead of a quiet 0.

From the logged-out crawl (2026-11-14):

- **#9** · `/features` register rows A76 and C40 no longer say "every cell read from the code" / "read from the limits".
- **#11** · Event Hub, Logo Maker, Papic and Setnayan AI FAQs no longer say "priced in the live catalogue"; they point at the Pricing page. No peso typed. (The Setnayan AI line was waiting on #8016, which went live in batch A still reading "live catalogue".)
- **#12** · robots.txt no longer `Allow`s `/supplies` (a 404); an address with no shop behind it is titled "Page not found", not "Supplier · Setnayan".
- **#13** · a closed `/sample` is titled "Page not found" (the static title was applied to its 404).
- **#20** · `/u/<slug>` and `/v/<slug>/booth` hand the title template no "· Setnayan" of their own (was "… · Setnayan · Setnayan"); share cards keep the brand.
- **#14** (part) · help article foot links "All help topics" / "Still stuck? Contact support →" wear `sn-hit`.

Guard: `apps/web/app/the-low-audit-findings-stay-fixed.test.ts` — 14 tests, each red with its source change reverted (sabotage-checked).

**Redone 2026-11-20 on the 20 Nov pages (batch A, #8050 · #8051 · #8052).** Dropped, because the page no longer draws what they fixed: crawl **#1 / #2** (the 20 Nov `/for-suppliers` and `/for-coordinators` draw no "See a real shop" / "See the sample shop" card, so `lib/shop-opens-to-strangers.server.ts` and the four-way read in `for-coordinators-says-what-ships.test.ts` went with them) and the **Patiktok** half of #11 (Patiktok is retired; its feature entry is gone). Main's text won every conflict hunk in `for-suppliers/page.tsx`, `for-coordinators/page.tsx`, `supplier-front-page.tsx`, `for-coordinators-says-what-ships.test.ts` and `day-memories.ts`.

SPEC IMPACT: None.
