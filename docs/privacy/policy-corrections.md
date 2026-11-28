# Privacy policy and terms: mismatches with the code, and draft corrections

> **DRAFT — NOT PUBLISHED. For the owner's review.** Nothing in the live pages has been changed.
> Pages checked: `/privacy` (source `apps/web/app/(shell)/privacy/page.tsx`, "last updated 2026-11-03") and `/terms` (`apps/web/app/(shell)/terms/page.tsx`), with a quick look at `/cookies`. Measured against `origin/main` `5f6a351d3`, 24 Nov 2026.
> Each item: what the page says → what the code does → draft wording. Draft wording is plain English and uses the house words (supplier, Event Hub, event).

## Mismatches

| # | Page says | Code does | Kind |
|---|---|---|---|
| C-1 | Cross-border paragraph: Anthropic is used for "reading an uploaded payment receipt" | Receipts are read on the buyer's own phone (Tesseract) since 17 Nov 2026; no AI sees them. The same page's receipt section and subprocessor list already say this — the page contradicts itself. | Claim we can't back |
| C-2 | Anthropic does "AI web research for the supplier Deep Search tool" (subprocessor list) | Anthropic also receives **supplier verification papers (DTI certificate, BIR 2303 with TIN, Mayor's Permit)**, supplier mood-board photos (screened for logos, QR codes, contact details), a host's free-text theme description, a supplier's category proposal text, and admin search phrases | Data shared, not disclosed |
| C-3 | Cross-border paragraph: Google "the Gemini image model when a mood board is rendered" | Mood-board renders are retired; no code calls Gemini | Claim we can't back |
| C-4 | Subprocessor list names Supabase, Vercel, Cloudflare, Resend, Sentry, OpenAI, OSM, Vimeo, Anthropic, Google, TikTok, Apple | Not named in that list: **Apple push (APNs)** and **browser push services**; **Cloudflare Turnstile** bot check; **Google sign-in** (described elsewhere on the page, missing from the list); **Meta** (Setnayan's own Page/Instagram posts); **Instagram** supplier sync; **Jitsi** video meetings; embedded players (Vimeo, YouTube, Instagram, TikTok); code/model hosts (jsDelivr, unpkg, Google Cloud Storage); Have I Been Pwned (password check). **Maya** once switched on. | Third parties not named |
| C-5 | "What we collect" lists account info, event data, messages, payment metadata, error reports, automatic data, Google/Apple sign-in | Not listed: **supplier business papers and TIN, payout account, owner's name and address**; guest fields a host enters (dietary, gender from the title, address, phone, relation); sponsors; day-of contacts; a supplier's own off-platform clients; Pabuya receiving handles | Data collected, not disclosed |
| C-6 | Connection tree: "Nothing is recorded about someone without an account" | A `people` table holds relatives who may never have an account (name, email, phone, photo, birth date), and `dependents` holds children's details. The sentence may be true for the *connection* only — **check with the code owner before rewording.** | Possible contradiction |
| C-7 | Face data: "a weekly check deletes anything left 3 months after the event"; photos: originals "replaced" after 3 months — read as automatic | Every clean-up runs only when the admin console (or, for selfies, the home page) is opened. There is no scheduler. | Claim we can only partly back |
| C-8 | "Payments, receipts and official receipts — 10 years"; "Contracts — 10 years" | Nothing deletes them at 10 years; they are kept with no end. Payment screenshots are never deleted. | Overstates (implies deletion) |
| C-9 | Automated decisions are described for fraud suspension and the supplier AI auto-reply only | Also automatic: NSFW screening withholds photos; the guest message filter refuses or holds messages; the supplier card filter refuses contact details; the mood-board screen refuses photos; face auto-tagging decides who gets which photos; the marketplace ranking profiles a host's budget, date, venue and style | Processing not disclosed (§ 34) |
| C-10 | Removing a guest is not described | A removed guest is soft-deleted and kept (with photo tags and QR scans) until the event is deleted | Not disclosed |
| C-11 | No line on changes to the privacy notice, the right to complain to the NPC, or the right to damages | `/terms` has a 14-day notice rule; `/privacy` has none | Missing required content |
| C-12 | Meta: social posts are "optional and governed by consent … recap re-posts are opt-out" | Recap and badge auto-posting are **on by default** in the database settings | Disclosed, but the default should be said plainly |
| C-13 | `/terms`: a verified supplier has "had that credential checked separately" | No identity-check company is used; a Setnayan staff member reviews the supplier's business papers (with an AI reading them first) | Vague |

## Draft wording (for review — do not publish yet)

**C-1 + C-3 · replace the cross-border paragraph**

> **Where your data goes.** Setnayan runs no servers of its own, and no Setnayan data is stored in the Philippines. Our database, including any face vector, is in Singapore (Supabase). Photos, videos, selfies and documents are stored in the Asia-Pacific region (Cloudflare R2). The app runs in Singapore (Vercel). Some features send data to the United States: Anthropic (supplier Deep Search and reading supplier business papers), OpenAI (checking written stories for abuse), and Google, Apple, Meta and TikTok when you choose to connect or sign in with them. Each transfer is covered by RA 10173 § 21: we stay responsible for your data wherever it goes.

**C-2 · replace the Anthropic line in the subprocessor list**

> **Anthropic** (AI · United States · never trained on your data). Used for: supplier Deep Search web research; reading a supplier's DTI certificate, BIR 2303 and Mayor's Permit so our team can check them faster (the AI only writes down what it reads; a person approves); screening a supplier's mood-board photos for contact details, QR codes or logos; and turning a host's written theme idea into suggestions. It never receives a guest list, a payment receipt, or any face data.

And on the supplier's paper-upload screen:

> We use an AI service (Anthropic, United States) to read your papers so our team can check them faster. It decides nothing — a person approves your shop.

**C-4 · add to the subprocessor list**

> - **Apple** and **browser push services** (Google, Mozilla, Apple) — carry the notifications you allow on your phone or browser: a device address and the notice text.
> - **Cloudflare Turnstile** — a bot check on some forms; it sees your browser and IP address.
> - **Meta** (Facebook and Instagram) — only for posts on Setnayan's own pages (see "Featuring your event"). A supplier who connects Instagram lets us read their own posts into their shop.
> - **Jitsi** — if you start a video meeting from a supplier chat, it runs on Jitsi; Setnayan only makes the link.
> - **Video players** (Vimeo, YouTube, Instagram, TikTok) — when a page shows a supplier's video, that service sees your IP address and may set its own cookies.
> - **Code hosts** (jsDelivr, unpkg, Google Cloud Storage) — serve the files that let your phone check a selfie or read a receipt itself; they see your IP address only. Your selfie and receipt are not sent to them.
> - **Have I Been Pwned** — when you choose a password we send the first 5 characters of a one-way code of it, never the password, to check it hasn't leaked.
> - *(When card payment is switched on)* **Maya** (Philippines) — takes card and e-wallet payments; we send the amount and our reference, never your name or email.

**C-5 · add to "What we collect"**

> - **If you run a shop:** the owner's name and role, business name, addresses and map pin, contact email and phone, TIN, your DTI certificate, BIR 2303 and Mayor's Permit, and your payout account. Older shops may also have a government ID or bank proof on file from before we stopped asking for them.
> - **Details a host enters about guests:** name, title, phone, address, relation, table, meal and dietary notes, and notes about the guest. Also sponsors (name, email, phone), and contacts for the day (for example the driver's name and phone).
> - **Gifts (Pabuya):** the host's own receiving handle and QR; a guest's name, amount, note and transfer screenshot.

**C-7 · retention wording**

> Clean-ups run on our side about once a week. Face data is erased 12 hours after the event's photo window closes, and a backstop removes anything left 3 months after the event ends.

*(Use this only after G-4 in `gaps.md` adds a real schedule. Until then, the honest version is: "Clean-ups run when our team's console is in use, usually several times a week.")*

**C-8 · payments**

> **Payments, receipts and contracts — at least 10 years.** BIR and Civil Code rules set this as a minimum; we cannot delete them earlier, even if you ask. We do not yet delete them after 10 years.

**C-9 · new section "Decisions made by machines"**

> A few things on Setnayan are decided automatically:
> - **Photo screening.** Every photo and clip is checked for nudity. A blocked one is not shown; the host can restore it.
> - **Message filters.** A guest message with abuse is refused; one with swearing, a phone number or an email waits for the host. A supplier's service card cannot carry contact details.
> - **Face matching** (only if you opted in) decides which photos are sent to you. A near match is a suggestion a person confirms.
> - **Fraud checks** can hide a supplier's listing while our team reviews it (see "Keeping the marketplace honest").
> - **Supplier order.** The marketplace orders suppliers using your event's date, place, budget, size and style. It never hides a supplier, and you can change the sort.
>
> You can object to any of these and ask a person to look again: write to dpo@setnayan.com.

**C-10 · guests**

> When a host removes a guest, the guest's details are hidden from the event and kept until the event is deleted, so photo tags and check-ins still add up. Ask the host, or write to dpo@setnayan.com, to have them erased sooner.

*(If G-5 adds a purge of removed guests, replace "until the event is deleted" with that period.)*

**C-11 · add at the end of `/privacy`**

> **Your other rights.** You can get a copy of your data in a file you can reuse (Profile → Download my data). If we wrongly handle your data you may claim damages, and you can complain to the National Privacy Commission (privacy.gov.ph) — we ask that you write to our DPO first so we can fix it.
>
> **Changes to this notice.** If we change how we use your data, we will update this page, change the date at the top, and tell signed-in users in the app at least 14 days before the change takes effect, unless the law or a security problem needs it sooner.

**C-12 · Meta default**

> Recap posts are switched on by default. Turn them off from your recap manager, or keep your Event Hub private and nothing is ever posted.

*(If the owner flips the default to off per G-12, say "off by default" instead.)*

**C-13 · `/terms`, verified suppliers**

> The one exception is a **verified** supplier: our team has checked their business papers (DTI or SEC registration, BIR 2303 and Mayor's Permit). Verification is not a guarantee of their work.

## Also check before publishing

- C-6 needs a code owner to confirm whether `people` rows can exist for someone with no account, before any rewording.
- `every-outbound-host-is-disclosed.test.ts` passed with the C-4 omissions, because each host is named *somewhere* on the page. The subprocessor *list* is what readers rely on; keep the list complete.
- `/cookies` was only spot-checked: the cookie names in code broadly match the table. A full cookie-by-cookie check was not done.
