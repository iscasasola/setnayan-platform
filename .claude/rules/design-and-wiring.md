# Design & wiring guardrails: every build, every session

> Auto-loaded (imported by `CLAUDE.md`). These are not suggestions: CI holds most of them, the
> rest the ship controller checks before a merge. Owner, 22 Nov 2026: *"I should NEVER have to manually
> tell you how a page should look or what other parts of the website it connects to."*
> The design values live in corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md`. The pieces are in `CLAUDE.md` §3 and the connection map in §4.

## A · No page is built in isolation

1. **It extends what exists.**
   - Before code, name the shipped page or component you are extending and the approved drawing (corpus `prototypes/`, `Design_*`).
   - If there is no drawing and the change is visible, **stop**: a Fable drawing and the owner's OK come first. Fixes to an already-drawn page are exempt.
2. **It wears the house layout.**
   - The page sits inside the one shell (`app-rail-shell` / the event layout's single `<main>`) with a `PageMasthead`.
   - It uses the same skeleton, empty and error pieces as its neighbours.
   - It copies the nearest sibling page's structure, not a new layout.
3. **It is registered and reachable.**
   - Add it to its area's menu source:
     - couple: `lib/customer-menu.ts`;
     - supplier: `vendor-nav-destinations.ts` + `lib/supplier-console-routes.ts`;
     - admin: `admin-destinations.ts`.
   - Or add a real door from an existing page.
   - Use a `lib/routes.ts` builder, never a typed `"/dashboard/…"` string.
   - The Ugat no-door check fails a page with no way in. Fix the door; don't baseline it.
4. **Every way in moves with it.** A redesign or move updates every row, tile, notification, email link and deep link that points at it (Law 9).

## B · Every control does something real

5. **Every press reaches a real action or a real destination.**
   - No `onClick={() => {}}`, `href="#"`, `console.log` handler, or "coming soon" button a person can press.
   - A no-op is allowed only for a required callback the screen does not use.
6. **Trace each new or changed control to its end:** trigger → handler → `actions.ts` or `lib/` service → Supabase → the page that shows the result. A failure must render as a failure.
7. **🔒 locks are honest.**
   - A gated feature shows the lock, then Problem → Solution → preview → price (from the catalog) → one button.
   - The button opens a real checkout door (`every-plan-has-a-checkout-door.test.ts`).

## C · Shared numbers come from ONE reader

8. **Never re-compute a shared fact.** Import its reader from `CLAUDE.md` §4:
   - money: `resolveEventMoney`; amounts via `event_vendor_money_read`;
   - booked: `BOOKED_EVENT_VENDOR_STATUSES`;
   - headcount: `countsTowardEvent` / `headcountForBasis`;
   - pesos: `lib/php.ts`;
   - plan limits: `TIER_CAPS` / `vendor_tier_limit`;
   - prices: the catalogs.

   A second copy is a defect even when it agrees today: copies drift, then two pages disagree about one fact.
9. **A change to a shared fact updates every page that shows it.**
   - Find them in `apps/web/lib/ugat/screens.generated.json` (the reads of each screen) and with `rg` on the reader's name.
   - Saves use `revalidatePath` for every affected route, so totals and counters stay in step across pages.
10. **A new table, column or RPC gets both ends in the same PR:** a writer and a reader. `ugat-both-ends` fails a table nothing writes.

## D · House wiring standard (owner, 18 Nov; from PR #7984)

11. One source of truth. No `v2`, `-copy`, `-old`, `-new` or backup files or folders. Change the shipped file; git keeps history.
12. One way to make each primitive.
    - A button is `ActionButton` (`actionButtonClass()` for a link).
    - Inputs and floating surfaces reuse the shared ones (`form-row`, `.input-field`, `Sheet`).
    - No new standalone button, input or modal primitive.
13. No hard-coded colour or skin in feature files:
    - no hex, `rgb(`, `[#…]`, `bg-white` or numbered palette class (`bg-red-500`);
    - no `text-[Npx]`, `rounded-[..]` or raw ms or `cubic-bezier`.

    Use the tokens by job. Couple-picked event themes (invite, save-the-date, guest Event Hub) are product data and keep their maps in `lib/`.
14. Folders have one job each:

    | Job | Folder |
    |---|---|
    | UI | `app/**/_components/`, `components/` |
    | Page entry (reads once, passes props) | `page.tsx` / `layout.tsx` |
    | Mutations | `actions.ts` |
    | Reads, services, constants | `lib/` |
    | Prices, plans, taxonomy | the database |
15. No hardcoding inside UI: no data arrays, prices, URLs, keys or business rules.
16. Flat pages:
    - fewer than 3 nesting levels;
    - no pass-through wrappers;
    - **one batched read per screen** (`Promise.all`), so every load stays under 0.7 s.
17. Exempt: tests, `apps/web/app/dev/**`, `*.lab.tsx` (labs may use sample data).

## E · Done means proven (BUILD_RULES §4)

18. Screenshots at 375 px light **and** dark, plus desktop, side by side with the approved drawing. Name the drawing file.
19. Walk every way in and every new control in a browser (a dev lab is fine). Zero dead buttons, zero broken links.
20. The full preflight (`pnpm preflight` from `apps/web`) is green, except generated baselines, which the ship controller regenerates. Say which rows you left and why.
21. The hand-over lists what was built, the overlapping files, and anything not verified, said plainly.
