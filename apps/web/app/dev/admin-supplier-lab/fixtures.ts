/**
 * Fixtures for /dev/admin-supplier-lab — the prototype's own rows (Tita Nena's Catering, Lumière Photo, Ritmo Live
 * Band, Bloom & Vine, "Alumni homecoming"), shaped as `loadSupplierWork` returns them.
 */
import { orderSupplierWork, type SupplierWorkItem, type SupplierWorkRead, type SupplierWorkKind } from '@/lib/admin/supplier-work';
import type { HelpThread } from '@/app/admin/help/_components/help-messenger';

const ago = (h: number, now: number) => new Date(now - h * 3_600_000).toISOString();
const SWATCH =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#f4f1ea"/><text x="160" y="104" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#8E8880">BIR 2303 · photo</text></svg>',
  );
const PHOTO = (label: string, fill: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${fill}"/><text x="160" y="104" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#fff">${label}</text></svg>`,
  );

export function labWork(now: number, fail: readonly string[], absentTypes: boolean): SupplierWorkRead {
  const items: SupplierWorkItem[] = [
    {
      key: 'docs:app-1',
      kind: 'docs',
      title: 'Documents · Tita Nena’s Catering',
      line: 'BIR certificate (2303) re-uploaded · was “Needs a fix”',
      at: ago(2, now),
      applicationId: 'app-1',
      shopName: 'Tita Nena’s Catering',
      papers: [
        { slot: 'dti_certificate', label: 'DTI or SEC Registration', present: true, r2Key: 'vendors/v1/verification/dti.pdf', previewUrl: null },
        { slot: 'bir_2303', label: 'BIR Certificate of Registration (2303)', present: true, r2Key: 'vendors/v1/verification/bir.jpg', previewUrl: SWATCH },
        { slot: 'mayors_permit', label: 'Mayor’s Permit', present: false, r2Key: null, previewUrl: null },
      ],
      checks: [
        { label: 'Business name matches the shop', outcome: 'pass', detail: 'Tita Nena’s Catering' },
        { label: 'Whole page visible', outcome: 'manual', detail: 'A person looks at the photo.' },
      ],
    },
    {
      key: 'docs:app-2',
      kind: 'docs',
      title: 'Documents · Lumière Photo',
      line: '1 of 3 papers in · new',
      at: ago(5, now),
      applicationId: 'app-2',
      shopName: 'Lumière Photo',
      papers: [{ slot: 'dti_certificate', label: 'DTI or SEC Registration', present: true, r2Key: 'vendors/v2/verification/id.png', previewUrl: SWATCH }],
      checks: [{ label: 'Name matches the account', outcome: 'pass', detail: 'Lumière Photo' }],
    },
    {
      key: 'names:11',
      kind: 'names',
      title: 'Name change · Tita Nena’s Catering',
      line: '→ “Tita Nena Kitchen” · “We rebranded”',
      at: ago(24, now),
      requestId: '11',
      field: 'business_name',
      shopName: 'Tita Nena’s Catering',
      current: 'Tita Nena’s Catering',
      requested: 'Tita Nena Kitchen',
      note: 'We rebranded',
    },
    {
      key: 'names:12',
      kind: 'names',
      title: 'Address change · Ritmo Live Band',
      line: 'setnayan.com/ritmo → /ritmoband',
      at: ago(25, now),
      requestId: '12',
      field: 'business_slug',
      shopName: 'Ritmo Live Band',
      current: 'ritmo',
      requested: 'ritmoband',
      note: null,
    },
    {
      key: 'cards:7',
      kind: 'cards',
      title: 'Flagged card · Bloom & Vine',
      line: 'Photo matches another shop’s portfolio (repost watch · 96%)',
      at: ago(3, now),
      flagId: '7',
      shopName: 'Bloom & Vine',
      matchShopName: 'Petal Co.',
      flaggedUrl: PHOTO('Garden arch · Bloom & Vine', '#7d8f6a'),
      sourceUrl: PHOTO('Garden arch · Petal Co.', '#6a7d8f'),
      matchPct: 96,
      unverifiedShop: true,
    },
    {
      key: 'types:r1',
      kind: 'types',
      title: 'Event type request · “Alumni homecoming”',
      line: 'From Batch 2010 Samahan',
      at: ago(48, now),
      requestId: 'r1',
      label: 'Alumni homecoming',
      status: 'pending',
      eventType: null,
      askedBy: 'Batch 2010 Samahan',
    },
    {
      key: 'types:r2',
      kind: 'types',
      title: 'Event type request · “Pet birthday”',
      line: 'From Ana · added, not in the picker yet',
      at: ago(50, now),
      requestId: 'r2',
      label: 'Pet birthday',
      status: 'linked',
      eventType: 'pet_birthday',
      askedBy: 'Ana',
    },
    {
      key: 'msgs:m1',
      kind: 'msgs',
      title: 'Message from Lumière Photo',
      line: '“How do I add a second photographer to my team?”',
      at: ago(0.33, now),
      messageId: 'm1',
      shopName: 'Lumière Photo',
      subject: 'Team',
      body: 'Hi Setnayan! How do I add a second photographer to my team?',
      reply: null,
    },
  ];
  const failed = fail.filter((f): f is SupplierWorkKind => ['docs', 'names', 'cards', 'types', 'msgs'].includes(f));
  return {
    items: orderSupplierWork(items.filter((i) => !failed.includes(i.kind) && !(absentTypes && i.kind === 'types'))),
    failed,
    absent: absentTypes ? ['types'] : [],
  };
}

export const LAB_GROUPS = [
  { id: 'g-venues', label: 'Venues & churches' },
  { id: 'g-catering', label: 'Catering & cake' },
  { id: 'g-hosts', label: 'Hosts, music & program' },
  { id: 'g-photo', label: 'Photo & video' },
  { id: 'g-booths', label: 'Booths, carts & bars' },
  { id: 'g-prints', label: 'Invites, prints & souvenirs' },
];

export const LAB_TYPES = [
  { key: 'reunion', label: 'Reunion' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'pet_birthday', label: 'Pet birthday' },
  { key: 'corporate', label: 'Corporate event' },
];

export function labThreads(now: number): HelpThread[] {
  const base = { public_id: 'S89H-LAB', sender_email: 'shop@example.com', topic: 'supplier', updated_at: null } as const;
  return [
    { ...base, message_id: 'm1', user_id: 'u1', sender_name: 'Lia', shop_name: 'Lumière Photo', subject: 'Team', body: 'Hi Setnayan! How do I add a second photographer to my team?', status: 'new', admin_notes: null, created_at: ago(0.33, now), tier_label: 'Verified' },
    { ...base, message_id: 'm2', user_id: 'u2', sender_name: 'Nena', shop_name: 'Tita Nena’s Catering', subject: 'Thanks', body: 'Thank you for the quick check!', status: 'in_progress', admin_notes: 'You’re welcome — your BIR paper is approved.', created_at: ago(24, now), tier_label: 'Pro' },
    { ...base, message_id: 'm3', user_id: 'u3', sender_name: 'Rico', shop_name: 'Ritmo Live Band', subject: 'Address', body: 'Can my address be /ritmoband?', status: 'new', admin_notes: null, created_at: ago(25, now), tier_label: 'Free' },
  ];
}
