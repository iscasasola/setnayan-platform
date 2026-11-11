/**
 * 👥 WHO CAN DO WHAT — the strip at the top of each page of the host's picked supplier (owner-approved prototype,
 * 11 Nov 2026: `prototypes/client_supplier_page_2026-11-11/`, `WHO[page].client`). Two pills — "You · <what you do>"
 * and "<supplier> · <what they do>" — and the ⓘ that says how the two meet. Edit = green, Ask = blue, View = plain.
 *
 * The words are the prototype's, measured from the shipped code; a line the prototype marked as not built yet (Agreed
 * now on the host's Details, the Schedule answer drawn here, swipe-to-remove a file) is left out — this strip only
 * describes what the page really does. Chat has no strip (both sides write).
 *
 * 🔒 the-picked-supplier-has-nine-pages.test.ts
 */
import { Users } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import type { PickedSupplierPage } from './picked-supplier-menu';

type Tone = 'edit' | 'ask' | 'view';
export type WhoLine = { you: string; them: string; tones: readonly [Tone, Tone]; note: (supplier: string) => string };

export const PICKED_SUPPLIER_WHO: Readonly<Record<Exclude<PickedSupplierPage, 'chat'>, WhoLine>> = {
  details: {
    you: 'Edit',
    them: 'View · Ask',
    tones: ['edit', 'ask'],
    note: (s) => `Your event, your details. ${s} reads what you grant and asks for more from their (+); you answer on Access requests.`,
  },
  quote: {
    you: 'Accept · Turn down · Ask for a change',
    them: 'Edit',
    tones: ['ask', 'edit'],
    note: (s) =>
      `You never edit a price. Ask for a change lands in the chat as a card ${s} revises or declines. A final quote offers Accept · Turn down only.`,
  },
  payments: {
    you: 'Pay · Log paid · Ask for a change',
    them: 'Ask · Confirm',
    tones: ['edit', 'ask'],
    note: (s) =>
      `Pay ${s} their own way, then record it; ${s} confirms it reached them. The plan is theirs to edit — you ask for a change. A refused payment keeps your record.`,
  },
  forms: {
    you: 'Answer · Ask for a change',
    them: 'Build · Read',
    tones: ['edit', 'edit'],
    note: (s) => `You answer one question at a time and can stop and continue. A form ${s} made final is read-only — ask for a change.`,
  },
  schedule: {
    you: 'Accept · Propose a meeting',
    them: 'Propose',
    tones: ['edit', 'ask'],
    note: (s) => `You OK or change what ${s} proposes for the day on your Schedule page. Meetings: either side proposes, the other confirms.`,
  },
  files: {
    you: 'Add · Confirm receipt',
    them: 'Add',
    tones: ['edit', 'edit'],
    note: (s) => `Anything either of you attaches in the chat, ${s}’s contracts, and their handover (you confirm receipt).`,
  },
  inspiration: {
    you: 'Edit',
    them: 'View if granted',
    tones: ['edit', 'view'],
    note: (s) => `The looks you saved for this category. ${s} sees them only with the mood-board access you granted.`,
  },
  report: {
    you: 'Report them',
    them: 'Report you',
    tones: ['edit', 'edit'],
    note: () => 'It goes to the Setnayan team. You can follow it on Disputes.',
  },
};

const PILL: Record<Tone, string> = {
  edit: 'border-success-600/40 [&>b]:text-success-700',
  ask: 'border-info-600/40 [&>b]:text-info-700',
  view: 'border-ink/10 [&>b]:text-ink/60',
};

export function PickedSupplierWho({ page, supplierName }: { page: Exclude<PickedSupplierPage, 'chat'>; supplierName: string }) {
  const w = PICKED_SUPPLIER_WHO[page];
  return (
    <div className="grid gap-1.5 rounded-xl bg-ink/[0.04] px-3 py-2.5" data-picked-supplier-who={page}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink/55">
        <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        <InfoTip label="Who can do what" align="start">
          {w.note(supplierName)}
        </InfoTip>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border bg-cream px-2.5 text-[12.5px] leading-tight ${PILL[w.tones[0]]}`}>
          You · <b className="font-bold">{w.you}</b>
        </span>
        <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border bg-cream px-2.5 text-[12.5px] leading-tight ${PILL[w.tones[1]]}`}>
          {supplierName} · <b className="font-bold">{w.them}</b>
        </span>
      </div>
    </div>
  );
}
