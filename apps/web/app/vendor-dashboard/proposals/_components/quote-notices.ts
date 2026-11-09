import { DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY, DEMO_SHOP_CANNOT_BE_BOOKED } from '@/lib/demo-scope';

/**
 * The Quotes surface's banner words for `?notice=<code>` — read by `surface.tsx` (the banner) and by the stay door
 * (`app/_actions/stay-registry/svProposals.ts`), so a refusal said on the row is the SAME sentence the banner says.
 */
export const QUOTE_NOTICES: Readonly<Record<string, { tone: 'ok' | 'warn'; text: string }>> = {
  template_saved: { tone: 'ok', text: 'Template saved — use it on any booked client below.' },
  template_needs_name: { tone: 'warn', text: 'The template needs a name.' },
  pick_event_and_template: { tone: 'warn', text: 'Pick a booked client and a template first.' },
  not_booked: { tone: 'warn', text: 'Quotes work for booked clients only.' },
  save_failed: { tone: 'warn', text: 'That didn’t save — try again.' },
  // 🧪 lib/demo-scope.ts — the words are imported, never retyped.
  demo_shop: { tone: 'warn', text: DEMO_SHOP_CANNOT_BE_BOOKED },
  demo_event: { tone: 'warn', text: DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY },
};
