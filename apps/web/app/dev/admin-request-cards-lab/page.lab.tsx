/**
 * /dev/admin-request-cards-lab — the Work request cards (owner approved 2026-11-14) drawn on SAMPLE rows, so the card
 * can be walked at 390 and 1280 without a database. It draws the REAL `RequestCardView` and the REAL judgement /
 * done-elsewhere footers (`QueueDrawer`); only the rows are samples. Never built for production (next.config.ts).
 */
import { notFound } from 'next/navigation';
import { QueueDrawer } from '@/app/admin/queues/_components/queue-drawer';
import { JUDGEMENT_QUEUES, SETTLED_ELSEWHERE, type QueuePeek } from '@/lib/admin/queue-peek';
import type { RequestCard } from '@/lib/admin/request-card';
import { correctionDecline } from '@/lib/admin/request-card';

const logo = (txt: string, bg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="${bg}"/><text x="48" y="58" font-size="30" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">${txt}</text></svg>`,
  )}`;

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const CARDS: RequestCard[] = [
  {
    title: 'Liwanag Lights & Sound wants a new logo',
    chip: 'Profile correction',
    initials: 'LS',
    at: ago(50),
    who: 'Marco Reyes · owner',
    quote: 'We rebranded in October — this is our new mark.',
    show: [{ kind: 'images', before: logo('TW', '#8A6A2E'), after: logo('LL', '#C24E25'), beforeAlt: 'Logo now', afterAlt: 'Logo asked for' }],
    shopHref: '/liwanag',
    recordHref: '/admin/corrections',
    act: {
      kind: 'correction',
      id: 'sample-1',
      buttons: [
        { label: 'Approve', tone: 'ok', main: true, post: { decision: 'apply' } },
        { label: 'Decline', tone: 'danger', post: { decision: 'decline' }, reasons: correctionDecline('logo_url', 'Liwanag Lights & Sound') },
      ],
    },
  },
  {
    title: 'Kislap Lights Co. wants to rename the shop',
    chip: 'Profile correction',
    initials: 'KC',
    at: ago(5),
    who: 'Bea Santos · owner',
    quote: 'We now do full events, not just lights.',
    show: [{ kind: 'text', before: 'Kislap Lights Co.', after: 'Kislap Lights & Events' }],
    shopHref: '/kislap',
    recordHref: '/admin/corrections',
    act: {
      kind: 'correction',
      id: 'sample-2',
      buttons: [
        { label: 'Approve', tone: 'ok', main: true, post: { decision: 'apply' } },
        { label: 'Decline', tone: 'danger', post: { decision: 'decline' }, reasons: correctionDecline('business_name', 'Kislap Lights Co.') },
      ],
    },
  },
  {
    title: 'ana@example.com sent a payment of ₱1,990.00',
    chip: 'Payment',
    initials: 'AE',
    at: ago(1),
    who: 'ana@example.com',
    quote: null,
    show: [{ kind: 'facts', rows: [{ label: 'Amount', value: '₱1,990.00' }, { label: 'Sent by', value: 'Bank transfer' }, { label: 'Reference', value: 'SNEY7K2M9Q' }, { label: 'Their receipt', value: 'Reads ₱1,990 · matches the bill', tone: 'ok' }] }],
    shopHref: null,
    recordHref: '/admin/payments',
    act: {
      kind: 'payment',
      id: 'sample-3',
      buttons: [
        { label: 'Confirm payment', tone: 'ok', main: true, post: {} },
        { label: 'Ask for a clearer photo', tone: 'warn', post: { intent: 'resubmit' }, reasons: { title: 'What should they fix?', reader: 'They will read this and send it again.', list: 'proof' } },
      ],
    },
  },
  {
    title: 'Hiraya Events sent papers to be verified',
    chip: 'Verification',
    initials: 'HE',
    at: ago(26),
    who: 'Liza Cruz · owner',
    quote: null,
    show: [{ kind: 'papers', papers: [{ label: 'DTI or SEC', present: true, previewUrl: logo('DTI', '#3B5B4A') }, { label: 'BIR 2303', present: true, previewUrl: null }, { label: 'Business permit', present: false, previewUrl: null }] }],
    shopHref: '/hiraya',
    recordHref: '/admin/verify',
    act: {
      kind: 'verify',
      id: 'sample-4',
      buttons: [
        { label: 'Verify shop', tone: 'ok', main: true, post: { decision: 'approve' } },
        { label: 'Needs a fix', tone: 'warn', post: { decision: 'needs_fix' }, reasons: { title: 'What needs a fix?', reader: 'Hiraya Events will read this on its setup.', list: 'docs' } },
      ],
    },
  },
  {
    title: 'We owe Hiraya Events ₱12,000.00 for an older order',
    chip: 'Payout',
    initials: 'HE',
    at: '2026-11-10',
    who: null,
    quote: null,
    show: [{ kind: 'facts', rows: [{ label: 'Amount', value: '₱12,000.00' }, { label: 'Stage', value: 'Final payment' }] }],
    shopHref: '/hiraya',
    recordHref: '/admin/payouts',
    act: {
      kind: 'payout',
      id: 'sample-5',
      fields: [
        { kind: 'pick', name: 'payment_method', label: 'How it was paid', placeholder: 'How it was paid…', options: [{ key: 'gcash', label: 'GCash' }, { key: 'bdo_transfer', label: 'BDO transfer' }] },
        { kind: 'text', name: 'payout_reference', label: 'Reference', placeholder: 'Reference number', required: true },
      ],
      buttons: [{ label: 'Record as paid', tone: 'ok', main: true, post: {} }],
    },
  },
];

export default async function AdminRequestCardsLab() {
  if (process.env.NODE_ENV === 'production') notFound();
  const peek: QueuePeek = { items: CARDS.map((card, i) => ({ id: `s${i}`, title: card.title, detail: card.chip, href: card.recordHref, card })), total: 7 };
  return (
    <div className="app-surface min-h-dvh">
      <div className="mx-auto w-full max-w-3xl py-6 lg:max-w-5xl">
        <QueueDrawer peek={peek} href="/admin/corrections" label="Profile corrections" backTo="/admin/work?open=corrections" late />
        <QueueDrawer peek={{ items: [], total: 0, judgementNote: JUDGEMENT_QUEUES.disputes }} href="/admin/disputes" label="Disputes" backTo="/admin/work" />
        <QueueDrawer peek={{ items: [], total: 0, judgementNote: SETTLED_ELSEWHERE['booking-fees'] }} href="/admin/booking-fees" label="Fees to sync" backTo="/admin/work" />
      </div>
    </div>
  );
}
