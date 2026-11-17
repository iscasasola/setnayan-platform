## 2026-11-17 · feat(supplier): the supplier dashboard wears the owner's blue look (light) + the Prints row says what it is

- **The blue look, carried to every supplier page** (owner 16 Nov, DECISION_LOG "SUPPLIER DASHBOARD = THE OWNER'S BLUE LOOK … CARRIED TO EVERY SUPPLIER PAGE"; P1 drawings `prototypes/supplier_*_clean_2026-11-16/`). New `app/vendor-dashboard/_components/supplier-look.css`, switched on by `data-supplier-look` on the supplier template. It re-points the existing colour tokens on `<html>` while a supplier page is on screen. No component is recoloured by hand. The page is #EEF2F8 with the soft glow, cards are white with a soft shadow, titles are #101B30, body text is #566275, links are #175AB9, and the main button is solid #2272E6 with a white label (4.55:1) and the 16 Nov blue shadow. Ghost fills and washes are #E8F0FA, lines are cool, and the top bar is solid white from 1100. Admin › Colours and the couple side are untouched. Leaving the supplier area restores them.
- **Light only.** The ruling's dark mode is held as an owner question. The app is light-locked, the shell rule says dark follows the person's Appearance setting rather than the device, and the hand-typed white surfaces in the supplier area would break under it.
- **Shop › Promote › Prints row:** "Calling card + tarps" now reads "Marketing materials, printed out" (P1 drawing). The sheet, the 15 designs and the 7 pieces are unchanged.

SPEC IMPACT: None. The look and the words are the 16 Nov rulings already in DECISION_LOG. Nothing new is decided.
- The glow and the main button's shadow now read the tokens (`--color-mulberry`, the new `--sn-glow-soft`) instead of typed rgba values. Guard: `_components/the-blue-look-is-tokens-only.test.ts`.
- Audit fixes, 17 Nov:
  - **Prints follows the shop drawing.** The "Prints" heading stays. Under it sits "Marketing materials, printed out" and its counts (derived from `PRINT_DESIGNS` / `PRINT_PIECES`, never typed). Then come seven piece rows (name · size, then their line), each opening the shipped sheet on that piece. The icon is a calling card (`IdCard`).
  - **Shop's Prints tile.** The cover gains a Prints tile wearing the same `PRINTS_LINE`. It opens the shipped Promote sheet.
  - **Drawing colours.** Tiles, washes and pills are #DCE6F2, and warn is #8A5A00.
  - **Tokens only.** The glow and the button lift are tokens (`--sn-ambient`, `--sn-forward-lift`), read in globals.css at zero specificity. The lift never covers the keyboard focus ring.
  - **No Admin › Colours leak.** The supplier scope now holds every token a saved set writes. Guards: `the-blue-look-is-tokens-only.test.ts` and `shop/promote/prints-are-the-drawn-seven-rows.test.ts`.
- **Ready for #7888 (the clean warm look), which ships first.** The supplier scope re-points its new tokens to the drawing, so the supplier side never goes warm.
  - The secondary button (`--sn-btn-secondary-*`) is the blue ghost #E8F0FA with ink words (15.0:1). Hover is the #DCE6F2 wash. There is no outline.
  - The floating bar's `--sn-dock-lift` is the drawing's cool shadow.
  - The blue band keeps white words (`--sn-on-band`, 4.55:1). Ink on the blue would read about 3.2:1.
  - The guard holds each value. It also passes against #7888's `app-colours.ts`.
- **Template ratchet.** The cover's Prints tile is a wash tile (`--surface-soft`) with no bordered card, so Shop stays at its baseline.
- **Re-audit fixes (17 Nov).**
  - **Only the main button lifts.** The lift rule is narrowed to `.button-primary` and the filled `.ab.ab-brand.ab-main`, as the drawing lifts `.btn.pri` alone. Before, every brand-tone ActionButton lifted. A guard fails if the selector widens again.
  - **The Shop cover's quick row is the drawn three.** Prints · Your gifts · Plan are three centred white tiles, each with a 40px icon square on the wash.
    - Prints and Your gifts open the shipped Promote sheet at its own `#prints` / `#gifts` section.
    - Plan is the cover's `#plan` door, worded from `planLabel`.
    - No new read. Guard: `shop/the-quick-row-is-the-drawn-three.test.ts`.
  - `printsCountLine` goes through `formatCount`, and the Promote page's docblock now says seven rows.
- **Every way into a client conversation lands on the client's Chat** (owner 17 Nov on the #7901 preview: a pop-up's Reply opened the old full-screen thread page; owner rule 11 Nov, "a redesign moves every way in").
  - The links now go through `supplierChatHref`: Today's Reply and "Open the conversation", Today's Agree second action, the push notification, the ongoing "Reply to …" task, the dispute row, the upcoming-date row, the day sheet's Chat, the money row's Log payment, the day-check asks, Bookings, the fee lock, the inquiry lines, the on-the-day console, the public-page desk, the quote's "Back to conversation", the client page's Open chat / Log payment / Build quote, and Files' "Share files in chat".
  - The thread page itself forwards a plain arrival (stored bell notices, old pushes) to the client's Chat, and "Update this quote" to its Quotation.
  - It still draws for: a thread with no event, the computer inbox pane (`?pane=1`, owner 13 Nov D3), a return carrying its own notice, a released inquiry, and an older or closed chat on the event. The client's Chat draws the event's newest thread (`readClientChatThreadId`), so those must not forward.
  - Guard: `lib/a-conversation-opens-the-client-chat.test.ts` (sabotaged three ways, each red).
- **An action inside the client's Chat returns to the client's Chat, its notice said there** (owner 17 Nov via controller). Covers agree / decline a booking ask, send a quote, log a payment, and refusals.
  - Every return from inside the conversation is built with `supplierThreadPageHref`, and the thread page decides where it lands.
  - The forward now carries the notice params (`SUPPLIER_THREAD_NOTICE_KEYS`: notice · lock_agree · lock_decline · fee · taken · free · competing · error · msg) onto `?tab=chat`.
  - The client page hands them back to the ONE thread draw (`PickedPageContext.threadSearch` → `SupplierThreadBody search`). The same notice lines are drawn in the same chat box.
  - The page still draws for its own tools (Decisions `view`, counter-offer `compose=deal`), the computer pane, an unknown param, and an older chat on the event.
  - The guard's allow-list is now the helpers file alone.
