'use client';

import { useState, useTransition } from 'react';
import {
  Users,
  Send,
  Briefcase,
  Receipt,
  MessageSquare,
  Bell,
  Sparkles,
  X,
  ArrowLeft,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

type TourSlide = {
  Icon: LucideIcon;
  title: string;
  body: string;
};

const COUPLE_SLIDES: ReadonlyArray<TourSlide> = [
  {
    Icon: Sparkles,
    title: 'Welcome to Setnayan',
    body: 'Your wedding, planned end-to-end in one place — guest list, invitations, vendors, budget, and more. Let&rsquo;s walk through the basics.',
  },
  {
    Icon: Users,
    title: 'Build your guest list',
    body: 'Add guests one at a time or import a CSV. Setnayan ships 18 Filipino wedding roles — maid of honor, principal sponsors, candle/veil/cord/coin, bearers, flower girl — plus plus-ones as first-class rows.',
  },
  {
    Icon: Send,
    title: 'Send branded invitations',
    body: 'Each guest gets a personal QR with your monogram in the center. Print the A4 sheet or share individual links — guests land on a personalized invitation site with RSVP, dress code, countdown.',
  },
  {
    Icon: Briefcase,
    title: 'Track vendors + budget',
    body: 'Move every vendor through a 6-stage flow (considering → complete) and itemize their costs into line items. Export upcoming payment due dates as a .ics file.',
  },
  {
    Icon: MessageSquare,
    title: 'Chat with vendors',
    body: 'Start a thread with any Setnayan vendor by their contact email. Identity stays masked — vendors see your event name, not your personal info, until you choose to share.',
  },
  {
    Icon: Receipt,
    title: 'Apply for premium services',
    body: 'Open the Orders tile to request anything custom from the Setnayan team — Save the Date videos, LED backgrounds, photo delivery. Pay via BDO or GCash, log the receipt, we reconcile within one business day.',
  },
];

const VENDOR_SLIDES: ReadonlyArray<TourSlide> = [
  {
    Icon: Sparkles,
    title: 'Welcome to Setnayan',
    body: 'You&rsquo;re signed in as a vendor. Couples discover you through your business profile and start conversations from their dashboard.',
  },
  {
    Icon: Briefcase,
    title: 'Fill in your profile',
    body: 'Your business name, services, location, and especially the contact email — couples search by that exact email to start a thread with you. Add a logo URL too; couples see it in their thread list.',
  },
  {
    Icon: MessageSquare,
    title: 'Reply to couples',
    body: 'When a couple opens a thread with you, they appear masked as just their event name + date. Reply through Setnayan; their personal info stays private until they choose to share.',
  },
  {
    Icon: Bell,
    title: 'Stay in the loop',
    body: 'New messages and any other vendor updates show up under Notifications with an unread badge in the nav. Email delivery is coming soon — for now, check in regularly or keep the tab open.',
  },
];

type Props = {
  role: 'couple' | 'vendor';
  completeAction: () => Promise<void>;
};

export function GuidedTour({ role, completeAction }: Props) {
  const slides = role === 'vendor' ? VENDOR_SLIDES : COUPLE_SLIDES;
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const current = slides[step];
  if (!current) return null;
  const isLast = step === slides.length - 1;

  const dismiss = (): void => {
    setOpen(false);
    startTransition(async () => {
      await completeAction();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-tour-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-ink/10 bg-cream shadow-[0_30px_80px_-40px_rgba(26,26,26,0.5)]">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Skip tour"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/55 hover:bg-ink/10 hover:text-ink"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="space-y-4 p-6 sm:p-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
            <current.Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-terracotta">
              Step {step + 1} of {slides.length}
            </p>
            <h2 id="guided-tour-title" className="text-2xl font-semibold tracking-tight">
              {current.title}
            </h2>
            <p className="text-sm text-ink/70" dangerouslySetInnerHTML={{ __html: current.body }} />
          </div>

          <div className="flex h-1 w-full overflow-hidden rounded-full bg-ink/10">
            <span
              className="block h-full rounded-full bg-terracotta transition-all"
              style={{ width: `${((step + 1) / slides.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-ink/65 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Back
            </button>
            <div className="flex items-center gap-2">
              {!isLast ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-xs text-ink/55 hover:text-ink"
                >
                  Skip
                </button>
              ) : null}
              {isLast ? (
                <button
                  type="button"
                  onClick={dismiss}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md bg-terracotta px-4 py-1.5 text-sm font-medium text-cream hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Got it
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(slides.length - 1, s + 1))}
                  className="inline-flex items-center gap-1 rounded-md bg-terracotta px-4 py-1.5 text-sm font-medium text-cream hover:bg-terracotta-600"
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
