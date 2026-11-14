/**
 * HELP SLOT H1 — supplier areas S1–S9 and S22.
 *
 * Owned by ONE answer-writing session (H1); no other session edits this file.
 * Covers: sign-up and opening a shop · Today · the setup checklist · verification · the shop page · service cards · packages · pricing basis · the booking fee · plans (Supplier Plus · Supplier Pro · Supplier Ultra).
 * Where those live in the app: app/open-shop · app/vendor-dashboard (page, verify, shop, services, packages, booking-fees, subscription, settings) · app/v/[slug].
 * Also repoints the "How booking works" row in app/vendor-dashboard/settings/settings-rows.ts at the new answer.
 *
 * Rules every answer here obeys (each is held by a guard that reads this file):
 * - say what ships on main today, in the app's own words — no future, no typed
 *   price, credit count or tier boundary (read prices from the catalogue; point
 *   at setnayan.com/pricing or the supplier billing hub);
 * - "supplier", never "vendor"; plans are Event Plus · Event Pro · Event Ultra
 *   and Supplier Plus · Supplier Pro · Supplier Ultra;
 * - every slug is globally unique across lib/help/ and lib/help-admin/
 *   (lib/help-slugs-are-unique.test.ts);
 * - give an `appBody` where the web answer points at buying, Android or desktop
 *   (lib/help-in-the-app-sells-nothing.test.ts).
 *
 * lib/help.ts appends this file's topics after topics-existing.ts, in slot order.
 */
import type { HelpTopic } from '@/lib/help';
import { HELP_NOT_IN_THE_APP } from './not-in-the-app';
import { FIRST_BOOKING_ON_US } from '@/lib/booking-fee-lock';
import { SHOP_NAME_MAX } from '@/lib/business-slug';

/*
 * H1 · 2026-11-14 — every answer below was checked against origin/main. The code that proves each one is named in the
 * comment above it (a greppable string, never a line number). Left out on purpose, and why:
 *   S7 Packages — the package builder is behind NEXT_PUBLIC_PACKAGE_AUTHORING (lib/package-authoring-flag.ts
 *     `packageAuthoringEnabled`; packages/page.tsx `notFound()`), so Help does not describe it yet.
 *   What each plan adds, item by item — while VENDOR_TIER_FEATURE_GATE is off (lib/vendor-feature-gate.ts) the per-plan
 *     limits do not all apply, and a server flag cannot be read from here; the answer points at the plan table, which
 *     prints what the actions actually allow.
 *   What paying the booking fee opens — lib/event-access-stage.ts `isFeeUnlocksEventEnabled` is a flag + a DB switch.
 *   No rate, price, credit amount or plan limit is typed (lib/help-no-hardcoded-prices.test.ts).
 */
export const SUPPLIER_1_TOPICS: HelpTopic[] = [
  {
    key: 'supplier-open-a-shop',
    label: 'Suppliers: opening your shop',
    roles: ['vendor'],
    articles: [
      {
        // app/open-shop/_components/open-shop-wizard.tsx `const heads`, "Open my shop — free"; lib/business-slug.ts SHOP_NAME_MAX
        slug: 'supplier-open-shop-steps',
        title: 'Suppliers: what does opening a shop ask?',
        body: `Opening a shop takes five short steps. Name your shop — your shop name, up to ${SHOP_NAME_MAX} characters, and your shop’s web address. What you do — your main service, any other services, and the events you serve. Where you are — type your address and check the pin on the map, then tap Yes, that’s right. About you — your name, your contact number and, if you like, your role at the shop. Your account — sign up with Google, Apple or your email. Then tap Open my shop — free.`,
      },
      {
        // app/open-shop/_components/address-preview.tsx "permanent web address"; lib/vendor-corrections.ts `requestOnly: … ['business_slug']`
        slug: 'supplier-shop-web-address',
        title: 'Suppliers: can I change my shop’s web address later?',
        body: 'You choose it on the first step, and it is meant to be permanent — it is the address on your QR and every link you share. After the shop opens it changes only by request: ask from your shop details, and Setnayan reviews it and lets you know.',
      },
      {
        // app/open-shop/_components/name-hold.tsx "It's my business" — queues the claim; the shop opens without that name
        slug: 'supplier-shop-name-taken',
        title: 'Suppliers: my shop name is already taken — what now?',
        body: 'If the name is already held, step one tells you, and you cannot go on with that name as it is. If it really is your business, tap It’s my business: your claim is sent with your shop, the shop opens under another name for now, and Setnayan reviews the claim.',
      },
      {
        // app/open-shop/logo/page.tsx "Add your logo", label="Skip for now"; lib/supplier-setup.ts 'Add your logo'
        slug: 'supplier-logo-at-sign-up',
        title: 'Suppliers: do I need a logo to open a shop?',
        body: 'No. Right after you open your shop you are asked to add your logo — tap Skip for now if it is not ready. Add your logo then stays on your setup steps on Today, because your logo shows on your page and your QR.',
      },
      {
        // app/vendor/claim/[token]/page.tsx "No duplicate profile created.", "This invite link has expired."; claim-parts.tsx "I'm not this supplier"
        slug: 'supplier-claim-link',
        title: 'Suppliers: I was sent a link to claim a shop. What is it?',
        body: 'A couple who added you to their event, or the Setnayan team, can make a shop for you and send you a link to claim it. Open the link to claim it and sign up, or sign in if you already have an account. If you already run a shop, connecting the link adds that couple to your Clients at the Inquiry stage — no second shop is made. If the shop is not yours, tap I’m not this supplier. A link that was already claimed, has expired or was declined says so when you open it.',
      },
    ],
  },
  {
    key: 'supplier-today',
    label: 'Suppliers: Today',
    roles: ['vendor'],
    articles: [
      {
        // app/vendor-dashboard/_components/supplier-today-first-screen.tsx "Needs you today", "Nothing waiting on you", "Coming up", "How is business"; today-stats.tsx
        slug: 'supplier-what-today-shows',
        title: 'Suppliers: what is on Today?',
        body: 'Today opens on your numbers — views and inquiries over the last 28 days, what is booked this month, your portfolio and the money still to come in. Below them, Needs you today holds the one thing waiting on you (or says Nothing waiting on you), then what else is on today, the events you run, your next bookings, your shop and How is business. A number Setnayan could not read says couldn’t load rather than showing a zero.',
      },
      {
        // app/vendor-dashboard/_components/supplier-today-screen.tsx "Nothing is ANSWERED here any more"
        slug: 'supplier-today-opens-the-page',
        title: 'Suppliers: can I answer an inquiry right on Today?',
        body: 'No — Today is the list of what is waiting, and each row opens the page where you answer it: a couple’s ask opens their chat in Clients, a missing document opens your documents, and so on.',
      },
      {
        // app/vendor-dashboard/page.tsx "a shop not yet approved"; lib/vendor-first-steps.server.ts `if (verified) return null;`
        slug: 'supplier-today-before-verified',
        title: 'Suppliers: why does my Today show setup steps?',
        body: 'Until Setnayan verifies your shop, Today shows your setup steps first, so the next thing to do is always on top. Once you are verified, the steps leave Today and it shows your day’s work.',
      },
    ],
  },
  {
    key: 'supplier-setup',
    label: 'Suppliers: setting up your shop',
    roles: ['vendor'],
    articles: [
      {
        // lib/supplier-setup.ts `title: 'Name your shop'` … `title: 'Download your QR'`, `setupHeadline`
        slug: 'supplier-setup-steps',
        title: 'Suppliers: what are the setup steps?',
        body: 'Six: Name your shop · Your details (address, contact and the year you started) · Add your logo · What you offer (your cards for each service) · Send your documents (Setnayan checks them before you go live) · Download your QR. The top of the list counts how many are done; when all six are, it reads All done — Setnayan checks you next.',
      },
      {
        // lib/supplier-setup.ts "a fold is never ticked by a press, only by the saved fact"
        slug: 'supplier-setup-ticks',
        title: 'Suppliers: how does a setup step get ticked?',
        body: 'Each step opens right on Today and saves as you go; the next step opens when you finish. A step is ticked only when what it asks for is really saved — tapping it is not enough — so the list always tells the truth about your shop.',
      },
      {
        // app/vendor-dashboard/_components/supplier-setup-screen.tsx "NO STEP 7 … the daily limit is PER SERVICE"; canvas-maker.tsx
        slug: 'supplier-how-many-a-day-where',
        title: 'Suppliers: where do I set how many events I can take a day?',
        body: 'On each service card, not in the setup steps — a photographer and a caterer can take a different number of events on the same day, so each card carries its own number. Open the card in Shop › Bundles and services and set How many events a day can this service take?',
      },
      {
        // lib/findable-shop.ts "AN UNVERIFIED SHOP IS FINDABLE UNTIL ITS FIRST INQUIRY"; for-suppliers plan-table-data.ts 'found until your first inquiry'
        slug: 'supplier-when-couples-find-you',
        title: 'Suppliers: when can couples find my shop?',
        body: 'A new shop can be found in search until its first inquiry. After that it stays out of search until Setnayan verifies you, and deleting the inquiry does not change that. A verified shop always shows, with its verified mark.',
      },
    ],
  },
  {
    key: 'supplier-verification',
    label: 'Suppliers: verification',
    roles: ['vendor'],
    articles: [
      {
        // lib/vendor-verification.ts `DOC_SLOTS`, `REQUIRED_DOC_SLOT_KEYS`
        slug: 'supplier-which-documents',
        title: 'Suppliers: which documents are required, and which are optional?',
        body: 'Four are required: your DTI or SEC registration, your BIR Form 2303, your Mayor’s Permit for the current year, and proof of your bank account. Three help but are optional: portfolio samples, a few past client references, and your social media links. Send them as a PDF, JPG or PNG.',
      },
      {
        // app/vendor-dashboard/verify/page.tsx redirect(`/vendor-dashboard/profile…#docs`); lib/supplier-setup.ts 'Send your documents'
        slug: 'supplier-where-to-send-documents',
        title: 'Suppliers: where do I send my documents?',
        body: 'In Your details › Your documents, or from the Send your documents step on Today — both open the same place.',
      },
      {
        // app/vendor-dashboard/shop/_components/verify-section.tsx "First step: finish your business profile", "Submit for review"
        slug: 'supplier-submit-for-review',
        title: 'Suppliers: why can’t I submit for review yet?',
        body: 'Submit for review needs two things: your business profile finished, and all four required documents in. You can upload documents before your profile is done — the banner counts the fields still left.',
      },
      {
        // verify-section.tsx 'Submitted — our team reviews within 5 business days.', "15-min Google Meet"
        slug: 'supplier-review-and-call',
        title: 'Suppliers: how long does verification take?',
        body: 'Once you submit, the Setnayan team reviews your documents within 5 business days. Then we contact you to schedule a short Google Meet with an admin — the final confirmation. Verification is free.',
      },
      {
        // lib/vendor-verification.ts `VERIFICATION_STATE_LABEL`, "Needs attention"
        slug: 'supplier-verification-status',
        title: 'Suppliers: what does my verification status mean?',
        body: 'Unverified — nothing sent yet. Pending review — your documents are with the team. Verified — you are checked and can be booked. If something needs fixing, your documents show Needs attention with the reason, so you can send a better copy.',
      },
      {
        // lib/vendor-verification.ts `isBookableVerificationState`, `VENDOR_NOT_VERIFIED_COUPLE_MESSAGE`; lib/findable-shop.ts; lib/vendor-corrections.ts `identityLockOf`
        slug: 'supplier-what-verified-changes',
        title: 'Suppliers: what changes once I am verified?',
        body: 'Couples can book you — until then they can ask, but a booking is refused. Your shop always shows in search, with its verified mark, and the not-yet-verified notice leaves your page. Your shop name, address and web address are then changed only by request, so couples can trust what they booked.',
      },
    ],
  },
  {
    key: 'supplier-your-page',
    label: 'Suppliers: your page',
    roles: ['vendor'],
    articles: [
      {
        // app/vendor-dashboard/website/_components/page-parts.tsx `title=` strings; shop-sections.ts page: 'Page'
        slug: 'supplier-edit-your-page',
        title: 'Suppliers: where do I change what couples see?',
        body: 'Shop › Page. It holds your details, cover photo, About, the services shown first, photos and videos, reviews and stories, where you work, awards and badges, your colour, and your web address.',
      },
      {
        // page-parts.tsx "not on your page until you Apply", 'Your page is updated — couples see it now.', "View my page", "Share my page"
        slug: 'supplier-apply-your-page',
        title: 'Suppliers: why don’t couples see my changes yet?',
        body: 'Changes to your page wait as a draft until you tap Apply — a changed part says it is not on your page until you Apply. Once you apply, couples see it at once (or, if Setnayan has not listed your shop yet, as soon as it does). Use View my page to check it and Share my page to send the link.',
      },
      {
        // page-parts.tsx "Use as cover", "Add photos to your collections first"
        slug: 'supplier-cover-photo',
        title: 'Suppliers: how do I choose my cover photo?',
        body: 'In Shop › Page › Cover photo. It is your first photo automatically, or tap Use as cover on any of your photos. With no photos yet, add some to your collections first.',
      },
      {
        // app/v/[slug]/_components/shop-section-bar.tsx; app/v/[slug]/page.tsx 'Price on request'
        slug: 'supplier-what-couples-see',
        title: 'Suppliers: what does a couple see on my page?',
        body: 'Your shop’s sections — About, Services, Portfolio and Reviews — and one Inquire button that opens a chat with you. Each card shows its price as “from” its starting price, or Price on request. A shop not yet verified also shows a short notice saying so.',
        appBody: "Your shop’s sections — About, Services, Portfolio and Reviews — and one Inquire button that opens a chat with you. A shop not yet verified also shows a short notice saying so.",
      },
      {
        // lib/supplier-qr-codes.ts `OWN_LINK_SRC = 'own'`, `ownPageUrl`; lib/booking-fee-disclosure.ts own clients
        slug: 'supplier-your-own-link',
        title: 'Suppliers: does a couple who comes from my own QR count as Setnayan’s?',
        body: 'No. Your QR from setup and the links you share from your page are marked as yours, so a couple who reaches you through them is your own client — and your own clients never carry a booking fee.',
      },
    ],
  },
  {
    key: 'supplier-service-cards',
    label: 'Suppliers: service cards and prices',
    roles: ['vendor'],
    articles: [
      {
        // app/vendor-dashboard/services/_components/canvas-maker.tsx field labels; shop-sections.ts 'Bundles and services'
        slug: 'supplier-add-a-service-card',
        title: 'Suppliers: how do I add a service?',
        body: 'Open Shop › Bundles and services and make a card. Give it a service name, how the price works, a cover photo and what it is about. Extras are optional add-ons a couple can pick, each with its own price. More settings holds the rest — schedule, discounts, what’s included, crew and transport, booking terms, the payment schedule, who it is for, and the events and faiths you serve.',
        appBody: "Open Shop › Bundles and services and make a card. Give it a service name, a cover photo and what it is about. More settings holds the rest — schedule, what’s included, crew and transport, booking terms, who it is for, and the events and faiths you serve.",
      },
      {
        // lib/service-publish-gate.ts "a PRICE", "a COVER PHOTO and WHAT'S INCLUDED"; canvas-maker.tsx "Couples can see it", "Hidden cards keep their bookings"
        slug: 'supplier-card-goes-live',
        title: 'Suppliers: why can’t couples see my card?',
        body: 'A card shows once it has a name, a price, a cover photo and what’s included, and its Couples can see it switch is on. Turn the switch off to hide a card at any time — a hidden card keeps its bookings.',
        appBody: "A card shows once it is complete — its name, cover photo and what’s included all filled in — and its Couples can see it switch is on. Turn the switch off to hide a card at any time — a hidden card keeps its bookings.",
      },
      {
        // canvas-maker.tsx label="How many events a day can this service take?", "Slot name"; services/actions.ts `bookingsPerDatePlanRefusal`
        slug: 'supplier-events-a-day',
        title: 'Suppliers: how do I set how many events a card can take a day?',
        body: 'On the card, under How many events a day can this service take? Left blank, it follows your plan’s number. If you work in time slots instead — a morning and an evening shoot, say — add the slots, each with how many it can take at once, and the slots decide.',
      },
      {
        // pricing-basis-editor.tsx `PRICING_BASIS_OPTIONS`; canvas-maker.tsx 'One price'; claim-door.tsx "Minimum guests", "Minimum hours", "Each extra hour"
        slug: 'supplier-how-the-price-works',
        title: 'Suppliers: what are the ways to charge for a card?',
        body: 'Three. One price — a flat price, with how many guests it covers and what each extra guest costs. Per guest — a rate per head with a minimum number of guests, as catering and mobile bars price. Per hour — a rate by time with a minimum number of hours and what each extra hour costs. Couples see the price as “from”, and your final price is still the quote you agree with them.',
        appBody: "Each card says how you charge: one amount for the whole service, by the number of guests with a minimum, or by the hour with a minimum number of hours. What you finally agree is still the quote you send the couple.",
      },
      {
        // services/actions.ts 'Your plan allows … per category', 'Your plan covers … Upgrade to list under more.'; lib/vendor-tier-caps.ts TIER_CAPS
        slug: 'supplier-cards-per-category',
        title: 'Suppliers: is there a limit to how many cards I can add?',
        body: 'Your plan sets how many cards you can put up in each category and how many categories you list under. When you reach the limit, the card maker tells you and offers a higher plan. What each plan allows is in the plan table on the For suppliers page.',
      },
    ],
  },
  {
    key: 'supplier-booking-fee',
    label: 'Suppliers: bookings and the booking fee',
    roles: ['vendor'],
    articles: [
      {
        // app/vendor-dashboard/settings/settings-rows.ts 'They ask · you agree · the fee · they are told'; lib/booking-fee-lock.ts `decideLockFee`
        slug: 'how-booking-works',
        title: 'Suppliers: how does a booking work?',
        body: 'They ask · you agree · the fee · they are told. A couple asks you from your page or their event. You agree on the details and the price in your chat and send your quote. When both of you agree, the booking is made — and if Setnayan brought you that couple, the booking fee is due then. The couple is told the booking is confirmed, and they pay you directly, as you agreed.',
        appBody: "They ask · you agree · the fee · they are told. A couple asks you from your page or their event. You agree on the details in your chat and send your quote. When both of you agree, the booking is made, and the couple is told it is confirmed.",
      },
      {
        // lib/booking-fee-lock.ts FIRST_BOOKING_ON_US, `freeHeldBackSentence` (once per business, not per account)
        slug: 'supplier-first-booking-free',
        title: 'Suppliers: is my first booking free?',
        body: `${FIRST_BOOKING_ON_US} It is once per business, not once per account: if your business already used it under another account, the next booking carries the fee.`,
      },
      {
        // app/vendor-dashboard/booking-fees/page.tsx title="Booking fees", "Due", "Nothing to pay yet.", "Waived — nothing owed"; supplier-today-screen.tsx `<BookingFeeBills`
        slug: 'supplier-see-and-pay-booking-fees',
        title: 'Suppliers: where do I see and pay my booking fees?',
        body: 'Under Plan, the Booking fee row opens Booking fees: what is due, what is paid and what is closed — a waived fee says Waived — nothing owed, and with nothing yet it says Nothing to pay yet. Each fee due also shows on Today with its own Pay, and pays by bank transfer or GCash with the reference on the bill.',
        appBody: 'Under Plan, the Booking fee row opens Booking fees: what is due, what is paid and what is closed — a waived fee says Waived — nothing owed, and with nothing yet it says Nothing to pay yet. Each fee due also shows on Today.',
      },
    ],
  },
  {
    key: 'supplier-plans',
    label: 'Suppliers: plans',
    roles: ['vendor'],
    articles: [
      {
        // lib/vendor-tier-caps.ts `TIER_LABEL`; app/for-suppliers/_components/plan-table-data.ts 'Every 4 weeks'; prices: vendor_billing_catalog
        slug: 'supplier-plans',
        title: 'Suppliers: what plans are there?',
        body: 'Every shop starts Free, and stays free once verified. Three paid plans add more: Supplier Plus, Supplier Pro and Supplier Ultra, paid every 4 weeks or for a year. The plan table on the For suppliers page shows what each one adds and its current price.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // subscription/_components/plan-sheet.tsx `Upgrade to ${p.name}`, "Pay every", `if (!verified)`; plan-screen.tsx "How to pay", "Send your payment"; lib/plan-sheet.ts `payToday`
        slug: 'supplier-upgrade-plan',
        title: 'Suppliers: how do I move to a paid plan?',
        body: 'Get verified first — paid plans open once you are. Then open Plan (Shop ⚙ › Plan and billing), pick the plan and how often to pay, and follow How to pay: send the payment with the reference in your transfer note. The plan starts once our team confirms the payment, within 24 hours. Moving up starts today, less what is left of the plan you are on.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // plan-rows.tsx title="Cancel the plan" 'Nothing renews by itself'; lib/plan-sheet.ts 'starts after'; lib/vendor-tier-lapse.ts `endedPlanReadsFree`; limits-sheet.tsx
        slug: 'supplier-lower-or-end-plan',
        title: 'Suppliers: how do I move to a lower plan or stop paying?',
        body: 'Nothing renews by itself. To stop, simply skip the next payment: when the plan ends you are on Free (or Free · Verified). A lower plan starts when your current one ends, and before you choose it Setnayan shows what the lower plan will not hold.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // lib/plan-sheet.ts `lessCredit` "less the money on your account"; app/vendor-dashboard/page.tsx `todayCreditNotice`
        slug: 'supplier-money-on-account',
        title: 'Suppliers: what is the money on my account?',
        body: 'Money Setnayan holds for your shop — it comes off your next plan payment by itself, and the payment shows “less the money on your account”. If any of it is about to expire, Today tells you.',
        appBody: HELP_NOT_IN_THE_APP,
      },
    ],
  },
];
