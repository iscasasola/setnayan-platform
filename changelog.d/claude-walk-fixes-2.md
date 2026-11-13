## 2026-11-13 · fix(walk): five faults from the 13 Nov new-couple walk (supplier date, host, quote (+), supplier search, ask note)

Found walking a brand-new couple account (a birthday with one candidate date, no set date) asking SetnaProd (Mobile Bar)
for a quote.

1. **The supplier sees the couple's candidate date(s).** `eventDateOptionWords` / `eventCandidateDays`
   (`lib/event-chat-title.ts`) read the date through `fitDateScope` (`lib/bench-bookable-days.ts`) — "May 22, 2027 ·
   option". Said in the chat title (thread head, chat list, Customers row + other chats), the thread head line, the
   pending-inquiry chip, the Target date fact (`buildCustomerEventSummary.targetDateOptions`), the event lines' Date
   (`readSupplierEventLines`), and the couple's opening message ("we're considering May 22, 2027" instead of "no date
   yet"). "Not set yet" stays only when there are no candidates and no window.
2. **"Hosted by" lists a host with no name.** `hostsInOrder` dropped every member whose account had no display or first
   name, so a new couple read as "No host has joined on Setnayan yet." It now lists them as "Host" (`UNNAMED_HOST`),
   with "Asked you" and their role.
3. **The supplier's (+) sends a quote first.** `supplierPlusRows({ hasQuote })`: before a quote, the first row is "Send
   a quote" — a door to the shipped builder (`#build-quote`), not a card — and "See every version" is not drawn. No more
   dead "No quote in this chat yet" card and empty pinned "Running topic · Quote". The page hands it
   `dealEntry.offerDeal` (= `threadHasQuote`).
4. **Suppliers search reaches past the shortlist.** When nothing on the couple's list matches, the bench now offers the
   matching categories not on the event (pressed = the "Add a category" picker's own add) and marketplace shops by name
   (the shipped `searchMarketplaceForBench`, now also returning each shop's services; pressed = its category row opens
   and searches it by that name). Nothing leaves the page. A matching category that was not drawn no longer counts as a
   hit, and the thumb row's ✕ now clears the list at once (`onClear`), so the no-match line goes with the words.
5. **"Ask for a quote" says it asked.** The More-to-compare card said "Saved to Mobile Bar." over a sent inquiry; it now
   says "Asked SetnaProd for a quote." (`inlineMoreAskedNote`) with no Undo, and falls back to the save's words if the
   ask is refused.

Guards: `lib/a-candidate-date-reaches-the-supplier.test.ts` · `lib/a-host-with-no-name-is-still-a-host.test.ts` ·
`lib/chat-plus-sends-a-quote-first.test.ts` · `app/dashboard/[eventId]/vendors/_components/bench-search-fallback.test.ts`
· `lib/an-ask-says-it-was-asked.test.ts`. `search-or-add.test.ts` updated: the bench may call the marketplace name
search again, only under the no-match line, and still links nowhere off the page.

SPEC IMPACT: None
