## 2026-11-18 · docs(seo): public surfaces say the 18 Nov plans — no cap on bookings, cards in total

Owner, verbatim: *"update the website and the documents as well. the prices the llms the google and ai seartch
documents"*. Stacked on the supplier plans PR (#7975).

- `lib/seo/ai-answers.ts`: new answer "Do Setnayan supplier plans limit how many bookings a supplier can take?" —
  no, on any plan; a supplier sets bookings a day per service up to `DAILY_CAPACITY_MAX`; plans add reach, size and
  tools. Feeds llms.txt and the FAQ structured data.
- `lib/llms-txt.ts`: supplier section says cards in total, storage, and that no plan limits bookings, inquiries,
  shortlists or the waitlist.
- "+1 service card per category" → "+1 service card" (plan table, add-on label); sample shop says cards "in total".
- Prices stay catalogue-read; no peso literal added.

SPEC IMPACT: corpus `Pricing.md` (+ `.docx`), `FEATURE_REGISTER.md`, `Feature_Catalog_Canon.md` updated to the 18 Nov
plans (specs 7e6ea902).
