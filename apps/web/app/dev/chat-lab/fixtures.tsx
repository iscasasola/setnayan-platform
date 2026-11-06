/**
 * Fixture data for /dev/chat-lab — sample names, nobody real. Shared by the inbox and the thread pages of the lab.
 */
import type { ChatMessageRow } from '@/lib/chat';
import { threadSupplierName, type CoupleThreadSupplierRow } from '@/lib/chat-supplier-names';

export const LAB_EVENT = '00000000-0000-4000-8000-000000000000';
export const LAB_USER = '00000000-0000-4000-8000-0000000000aa';
export const LAB_SHOP = '00000000-0000-4000-8000-0000000000cc';
export const LAB_STAFF = '00000000-0000-4000-8000-0000000000dd';
export const EVENT_LINE = 'December 18, 2026 · Ana & Miguel';

/**
 * HIDDEN-SHOP FIXTURES (owner bug 2026-10-28 — a shop the couple's RLS cannot read drew as "Supplier"). Each name is
 * computed by the REAL `threadSupplierName` from the row shape `couple_thread_supplier_names` returns, so the lab draws
 * exactly what production now draws for: a not-yet-verified shop whose name is revealed (it replied/accepted), one
 * still pre-reveal (its screen name, never its business name), and a read that failed (it says so).
 */
const hiddenShop = (over: Partial<CoupleThreadSupplierRow>): string =>
  threadSupplierName({
    thread_id: '', vendor_profile_id: '', name_revealed: false, business_name: null, logo_url: null,
    screen_name: null, primary_service: null, location_city: null, ...over,
  }).name;
const HIDDEN_REVEALED = hiddenShop({ name_revealed: true, business_name: 'Mirasol Events', screen_name: 'Manila Host #2002' });
const HIDDEN_PRE_REVEAL = hiddenShop({ screen_name: 'Cebu Florist #2003', primary_service: 'florist', location_city: 'Cebu' });
const HIDDEN_UNREADABLE = threadSupplierName(null).name;

export const LAB_THREADS = [
  { id: '00000000-0000-4000-8000-0000000000a1', name: 'Lumière Photo', preview: 'Here it is — happy to adjust', time: '2m', unread: true, tag: 'Quote' },
  { id: '00000000-0000-4000-8000-0000000000a2', name: 'Casa Catering', preview: 'You: Can we do a tasting on the 9th?', time: '1h', unread: false, tag: null },
  { id: '00000000-0000-4000-8000-0000000000a3', name: 'Bloom & Vine', preview: 'Saturday works for the ocular', time: 'Tue', unread: true, tag: 'Booked' },
  { id: '00000000-0000-4000-8000-0000000000a4', name: 'DJ Rico', preview: 'You: Thank you!', time: 'Mon', unread: false, tag: null },
  { id: '00000000-0000-4000-8000-0000000000a5', name: HIDDEN_REVEALED, preview: 'You: Hi miss Mira', time: 'Sun', unread: false, tag: null },
  { id: '00000000-0000-4000-8000-0000000000a6', name: HIDDEN_PRE_REVEAL, preview: 'You: Are you free on Dec 18?', time: 'Sat', unread: false, tag: null },
  { id: '00000000-0000-4000-8000-0000000000a7', name: HIDDEN_UNREADABLE, preview: 'Thanks, noted!', time: 'Fri', unread: false, tag: null },
] as const;

const at = (h: number, m: number) => new Date(Date.UTC(2026, 9, 26, h, m)).toISOString();

function row(i: number, role: 'couple' | 'vendor', body: string, created: string): ChatMessageRow {
  return {
    message_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    thread_id: LAB_THREADS[0].id,
    event_id: LAB_EVENT,
    vendor_profile_id: LAB_SHOP,
    sender_user_id: role === 'couple' ? LAB_USER : LAB_STAFF,
    sender_role: role,
    body,
    created_at: created,
  } as ChatMessageRow;
}

export const LAB_MESSAGES: ChatMessageRow[] = [
  row(1, 'vendor', 'Hi Ana! Congrats on the wedding 🎉', at(8, 12)),
  row(2, 'vendor', 'Do you want both the prep and the reception covered?', at(8, 13)),
  row(3, 'couple', 'Yes, both please. And a same-day edit?', at(8, 20)),
  row(4, 'couple', 'Budget around 80–90k', at(8, 21)),
  row(5, 'vendor', 'Here it is — happy to adjust 🙂', at(10, 5)),
  row(6, 'vendor', 'We can also do an ocular at the venue on Saturday.', at(10, 6)),
  { ...row(7, 'vendor', '', at(10, 20)), attachment_name: 'Moodboard-draft.pdf' } as ChatMessageRow, // a file the 90-day rule took
  row(8, 'couple', 'Saturday works for us!', at(10, 30)),
];
