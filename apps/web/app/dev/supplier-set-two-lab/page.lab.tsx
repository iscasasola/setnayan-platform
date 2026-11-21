/**
 * /dev/supplier-set-two-lab — the eight supplier pages of "set two" on the November look (owner-approved 21 Nov 2026,
 * drawing `prototypes/supplier_pages_set2_2026-11-21/supplier_pages_set2_v2_fable.html`), each state the drawing draws,
 * inside the REAL supplier shell (`SupplierLabShell`) with the blue look on. No sign-in, no database: the page BODIES are
 * the shipped components, handed fixtures in place of the reads. DEV-ONLY: production builds 404 this route first thing.
 *
 *   (no params)   the list of states
 *   ?s=<state>    one state — e.g. `contract-draft`, `contract-failed`, `upload`, `upload-failed`
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { VendorContractRow } from '@/lib/contracts';
import '@/app/vendor-dashboard/_components/supplier-look.css';
import { SupplierLabShell } from '../_components/supplier-lab-shell';
import { ContractBody, ContractReadFailed } from '@/app/vendor-dashboard/contracts/[contractId]/contract-body';
import { UploadContractBody } from '@/app/vendor-dashboard/contracts/new/upload-body';

const CONTRACT: VendorContractRow = {
  contract_id: '00000000-0000-4000-8000-00000000c001',
  public_id: 'S89K-LAB0000001',
  vendor_profile_id: '00000000-0000-4000-8000-00000000v001',
  event_id: '00000000-0000-4000-8000-00000000e001',
  event_vendor_id: null,
  order_id: null,
  uploaded_by_user_id: '00000000-0000-4000-8000-00000000u001',
  title: 'Catering package — Dec 12',
  description: 'Plated dinner for 150, two buffet stations. Final count by Dec 1.',
  file_url: '#lab-file',
  file_name: 'catering-claire-indalecio.pdf',
  file_size_bytes: 1_258_291,
  mime_type: 'application/pdf',
  status: 'draft',
  sent_for_signature_at: null,
  fully_signed_at: null,
  cancelled_at: null,
  cancelled_by_user_id: null,
  cancelled_reason: null,
  created_at: '2026-11-20T07:40:00Z',
  updated_at: '2026-11-20T07:40:00Z',
};
const EVENT = { display_name: 'Claire & Indalecio', event_date: '2026-12-12' };
const EVENTS = [
  { id: '00000000-0000-4000-8000-00000000e001', title: 'Claire & Indalecio' },
  { id: '00000000-0000-4000-8000-00000000e002', title: 'Reyes & Santos' },
];

const STATES: Record<string, { label: string; draw: () => ReactNode }> = {
  upload: { label: 'Contracts › upload a contract', draw: () => <UploadContractBody eventOptions={EVENTS} defaultEventId="" /> },
  'upload-none': { label: 'Upload · no couple to pick yet', draw: () => <UploadContractBody eventOptions={[]} defaultEventId="" /> },
  'upload-failed': {
    label: 'Upload · your conversations could not be read (honest state · new)',
    draw: () => <UploadContractBody eventOptions={null} defaultEventId="" />,
  },
  'contract-draft': { label: 'Contract · draft', draw: () => <ContractBody contract={CONTRACT} event={EVENT} eventFailed={false} /> },
  'contract-visible': {
    label: 'Contract · visible to the couple',
    draw: () => <ContractBody contract={{ ...CONTRACT, status: 'sent_for_signature' }} event={EVENT} eventFailed={false} />,
  },
  'contract-cancelled': {
    label: 'Contract · cancelled',
    draw: () => (
      <ContractBody
        contract={{ ...CONTRACT, status: 'cancelled', cancelled_at: '2026-11-20T07:40:00Z', cancelled_reason: 'Couple changed terms' }}
        event={EVENT}
        eventFailed={false}
      />
    ),
  },
  'contract-failed': {
    label: 'Contract · the contract could not be read (honest state · new)',
    draw: () => <ContractReadFailed contractId={CONTRACT.contract_id} />,
  },
};

export default async function SupplierSetTwoLabPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { s } = await searchParams;
  const state = s ? STATES[s] : undefined;
  if (!state) {
    return (
      <main className="min-h-dvh px-4 py-8" data-supplier-set-two-lab="list">
        <h1 className="text-xl font-semibold text-ink">Supplier pages, set two</h1>
        <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
          {Object.entries(STATES).map(([key, st]) => (
            <li key={key}>
              <Link href={`/dev/supplier-set-two-lab?s=${key}`} className="flex min-h-11 items-center py-3 text-[15px] text-ink">
                {st.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return (
    <div data-supplier-look="" data-supplier-set-two-lab={s}>
      <SupplierLabShell measure="own" page="/vendor-dashboard/contracts">
        {state.draw()}
      </SupplierLabShell>
    </div>
  );
}
