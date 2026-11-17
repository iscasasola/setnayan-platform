## 2026-11-17 · fix(chat): the supplier's client chat says what is true

Owner screenshot of the supplier's client "Debut 18" (booked, quote v1 ₱26,750) on the #7901 preview:

- **An answered booking ask stops reading "Waiting for your answer."** A later book-request line ("Booked ✓", "Not available", withdrawn, closed or expired) now answers every open ask before it (`answeredBookAsks` in `lib/chat-card-lines.ts`). The stream passes that answer to `BookRequestCard`, which then reads "Answered · booked" and similar.
- **A past due date reads overdue.** The folded plan row now says "₱0 of ₱26,750 · ₱5,350 overdue since Nov 13" instead of "next ₱5,350 Nov 13" (`planFoldLine` takes Manila's today from the thread page; when today is unknown it still says "next"). It now uses `formatPhp`.
- **The client page menu shows that it scrolls.** A side that has more pages past it fades, using the same mask as the pinned row's door strip (`picked-shell.tsx`, `data-picked-menu-more`).
- **The chat follows the clean-look rule** (`dashboards_clean_look_2026-11-16_fable.html`). Card kickers ("Due now", "Setnayan · Nov 14, 12:25 AM"), the quote's "Quote · version 1", message stamps and the "Agreed now" and Files headings are now sentence case, with no mono capitals. Space replaces the divider lines between pins and in the plan row.
- **Not in this PR:** "Not available" on the shop's own booked date is CHAT-29 on #7870. The newest bubble clipped under the waiting strip is still open until the clip has been seen.

Guard: `lib/the-client-chat-says-what-is-true.test.ts` (each guard was seen red when its fix was broken on purpose), plus overdue cases in `the-supplier-chat-gives-the-messages-room.test.ts`.

SPEC IMPACT: None. These are bug fixes plus the already-approved clean-look rule.
