import Link from 'next/link';
import { Plus } from 'lucide-react';

// Section 12.5 — Frequently asked questions. New 2026-05-20. Sits between
// the coverage map and the dual-CTA so visitors who scrolled this far with
// open questions get them answered before the final convert moment.
//
// Native <details>/<summary> — server-rendered, no client JS, no
// hydration cost. Lighthouse-clean. The Plus icon rotates via the open:
// CSS state on the parent <details>; tailwindcss-animate provides no
// open: variant, so we use group-open: on the marker container.
//
// Copy answers the six highest-friction questions a Filipino couple (or
// their planning helper) reaches the bottom of the page with:
//   1. Is the planning really free?
//   2. Do I have to be the bride or groom?  (multi-host / iteration 0048)
//   3. What's the 5% fee on vendor bookings?
//   4. How do I know a vendor is legit?
//   5. What does BIR-compliant mean?
//   6. Do I need to download anything?

type FAQItem = {
  question: string;
  answer: React.ReactNode;
};

const FAQ_ITEMS: ReadonlyArray<FAQItem> = [
  {
    question: 'Is the planning really free?',
    answer: (
      <>
        Yes. Guest list, RSVP, seating chart, budget, mood board, schedule,
        QR invitations — every planning surface is free forever. No
        subscription. No per-guest fee. No paywall on anything you need to
        actually run the wedding.
      </>
    ),
  },
  {
    question: 'Do I have to be the bride or groom to sign up?',
    answer: (
      <>
        No. Anyone planning can start an event — a parent, a maid of honor,
        a wedding coordinator. Once your event exists you can invite
        co-hosts to help: each one signs in with their own account and
        gets the same dashboard, the same vendor chats, and the same
        calendar. Roles are scoped, so you can let someone handle the guest
        list without giving them payment access.
      </>
    ),
  },
  {
    question: "What's the 5% fee on vendor bookings?",
    answer: (
      <>
        Vendors list their price. At checkout we add a 5.0% Setnayan Pay
        convenience fee — shown clearly on the order summary before you
        confirm. That fee powers BIR-compliant receipts, in-app messaging,
        milestone-protected payments, and dispute handling. Your vendor
        receives 100% of their listed price. No commission to the vendor,
        no hidden line items.
      </>
    ),
  },
  {
    question: 'How do I know a vendor is legit?',
    answer: (
      <>
        Every Setnayan vendor goes through verification before they earn
        the verified badge — business details, sample work, and platform
        rules acknowledged. Unverified vendors are marked &ldquo;Coming
        soon&rdquo; in the marketplace so you can tell the difference at a
        glance. Once you book, payments are released on milestones, not
        upfront — so the vendor has skin in the game.
      </>
    ),
  },
  {
    question: 'What does BIR-compliant mean?',
    answer: (
      <>
        Every vendor payment generates a proper BIR Official Receipt. EWT
        and the 2307 withholding form are handled automatically — no
        spreadsheets, no chasing your vendor for paperwork at year-end.
        This matters if your wedding spans VAT-registered suppliers or if
        your company is sponsoring part of the event.
      </>
    ),
  },
  {
    question: 'Do I need to download anything?',
    answer: (
      <>
        Not yet. Setnayan runs on the web on any phone or laptop — you can
        plan the whole wedding from your browser. Native apps for Windows,
        macOS, iOS, iPadOS, and Android are on the way; we&rsquo;ll let
        you know when they land.
      </>
    ),
  },
];

export function FAQ() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="max-w-2xl space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Quick answers
          </p>
          <h2
            id="faq-heading"
            className="text-balance font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            Common questions.
          </h2>
          <p className="text-base text-ink/65 sm:text-lg">
            The six we get most often. Anything else?{' '}
            <Link
              href="/help"
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              The help center
            </Link>{' '}
            has the long version.
          </p>
        </div>

        <ul className="mt-10 space-y-3 sm:mt-12">
          {FAQ_ITEMS.map((item) => (
            <li key={item.question}>
              <details className="group rounded-xl border border-ink/10 bg-cream transition-colors hover:border-ink/20 open:border-ink/20">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                  <span className="text-base font-medium tracking-tight text-ink sm:text-lg">
                    {item.question}
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition-transform duration-200 group-open:rotate-45 group-open:border-terracotta/40 group-open:text-terracotta"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                </summary>
                <div className="px-5 pb-5 pt-1 text-base leading-relaxed text-ink/70 sm:px-6 sm:pb-6 sm:text-[17px]">
                  {item.answer}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
