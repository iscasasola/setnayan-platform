# #7903 · proof (BUILD_RULES §4) · 22 Nov 2026

Head checked: `3d82af2d4`, which already holds `origin/main` `e72c4f313`.

## 1 · Screenshots (375 px light + dark, desktop)

These are taken from the dev labs, which draw the REAL components on fixture rows. This builder has no
database and never reads prod, so "real data" here means the real `threadSupplierName` output for each row shape
that `couple_thread_supplier_names` returns.

| file | what it shows |
|---|---|
| `chat-list-*.png` | `/dev/chat-lab`, the couple's Chats. "Mirasol Events" is a not-yet-verified shop and now shows its **real name**. "Cebu Florist #2003" has no business name on file, so it shows its screen name. "Couldn't load name" is a failed read, which says so. |
| `chat-thread-*.png` | `/dev/chat-lab/t/…a1`: the thread head with the shop's name. |
| `shop-partners-*.png` | `/dev/shop-end-lab`: a shop page's "Trusted by" partners, with their names and faces. |

**Dark:** the dark shots paint light. That is correct, not a miss. Messages, the shortlist and the shop page are not on
`DARK_READY` (`lib/appearance.ts`), so they stay light even for a person who chose Dark. Nobody may meet a
half-dark screen.

**Not shot:** the shortlist card logo (`/dashboard/[eventId]/vendors`) and the supplier sheet photos. Neither
has a lab, and both read the database.

## 2 · Drawing parity
There is no drawing. This PR carries a ruling (owner 2026-11-16, ruling 15: "real shop name everywhere"). It
changes no layout, only which name and logo fill the existing slots.

## 3 · Ways in walked (couple role)
- The chat list row and the thread head: same function (`threadSupplierName`), shot above.
- Shortlist card logo, supplier sheet photos and Share link, shop partners: read in code, gate removed (PR body table).
- Notifications carry no shop logo. The bench search card logo still waits on #7898 (see the PR body).

## 4 · Guards (from `apps/web`)
See the PR's STATUS comment for the full preflight table (run 22 Nov on `3d82af2d4`).

## 5 · Files overlapping other open PRs
- `lib/admin-map/admin-routes.generated.ts`: #7585, #7614, #7860 (a generated header).
- `app/dashboard/[eventId]/vendors/page.tsx`: #7920, #8094.
- `vendors/_actions/bench-marketplace-search.ts` and `lib/vendor-trusted-by.ts`: #8087.

## 6 · §2 rules not followed
None that this PR touches. The screenshots are from fixtures, not prod, and the reason is given above.
