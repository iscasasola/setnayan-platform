## 2026-11-11 · feat(suppliers): the host's picked supplier follows the supplier's order, gains Report, and no page is blank

The couple's picked supplier now mirrors the supplier's picked client (#7483): **Chat · Details · Quotation · Payment · Forms · Schedule · Files · Inspiration · Report**, opening on Chat (Details when there is no conversation). The order is derived from `PICKED_CLIENT_PAGES` (Inspiration where the supplier has Hub), so the two menus cannot drift.

- **Report** (new last page) is the host's shipped "Report a problem": the Disputes form (`NewFlagForm`, action `fileForceMajeureFlag`) moved from `disputes/page.tsx` into `disputes/_components/dispute-parts.tsx` and drawn open, pinned to this supplier. No new table, no new server action.
- **Quotation and Forms** no longer render blank: `VendorProposalsCard`, `SupplierQuestionsCard` and `SupplierFormsCard` hand back the page's one honest line ("No quotation from {name} yet." / "No forms from {name} yet.") plus its one action (ask in the chat; none without a chat), the workspace's house empty pattern.
- **Every `?tab=` door lands**: doors that meant Payment or Schedule (notifications, Suppliers rows, Home, bench price links, appointment returns) now name `?tab=payments` / `?tab=schedule`, since a bare address opens Chat; `#payments` hashes became `?tab=payments`; supplier questions open on Forms; `problem`/`dispute(s)` alias to Report.
- **The host's chat (+)** matches the supplier's grouping: the duplicate "Photo" row merged into **File** ("From your phone · a photo, a video or a document"), rows in the menu's page order, Report a problem last.

Guard: `app/dashboard/[eventId]/vendors/[vendorId]/workspace/the-picked-supplier-has-nine-pages.test.ts` (sabotaged red twice: blank Quotation, default page Details). Baselines moved by their generators: field-template (the textarea moved with the form), root map.

SPEC IMPACT: None — implements the owner's 11 Nov ruling already logged with #7483 ("THE PICKED-CLIENT MENU AND THE CHAT (+) FOLLOW ONE ORDER"), mirrored to the host's side. A Fable redesign of this page is in progress; this change is order, Report and empty states only.
