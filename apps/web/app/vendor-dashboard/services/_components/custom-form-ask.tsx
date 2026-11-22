/**
 * ✍ "NEED YOUR OWN FORM?" — a quiet row at the end of every card's customization part (controller ruling 2026-11-21).
 * It opens Message Setnayan (/help#contact) prefilled "Custom form request · [card] · [category]:", which lands in
 * Admin › Work › Messages like every help message. No new table, no new action — the shipped `submitHelpMessage`.
 */
import Link from 'next/link';
import { MessageSquarePlus } from 'lucide-react';

export function customFormRequestHref(cardName: string, categoryLabel: string): string {
  const subject = ['Custom form request', cardName.trim() || 'New card', categoryLabel.trim()].filter(Boolean).join(' · ');
  const q = new URLSearchParams({ role: 'vendor', topic: 'vendor', subject, body: `${subject}:\n` });
  return `/help?${q.toString()}#contact`;
}

export function CustomFormAsk({ cardName, categoryLabel }: { cardName: string; categoryLabel: string }) {
  return (
    <Link
      href={customFormRequestHref(cardName, categoryLabel)}
      className="mt-2 flex min-h-11 items-center gap-2 rounded-xl px-1 text-[13px] text-ink/65 hover:text-ink"
      data-maker-row="custom-form-ask"
    >
      <MessageSquarePlus aria-hidden className="h-4 w-4 flex-none" />
      <span>
        Need your own form? <span className="font-medium text-ink underline-offset-2 hover:underline">Tell us what you need</span>
      </span>
    </Link>
  );
}
