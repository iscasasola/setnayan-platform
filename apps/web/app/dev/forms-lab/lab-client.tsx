'use client';

import { useEffect, useState } from 'react';
import { FormsPageBody } from '@/app/vendor-dashboard/forms/_components/forms-page-body';
import { FormMaker } from '@/app/vendor-dashboard/forms/_components/form-maker';
import { ReportForm } from '@/app/vendor-dashboard/clients/[eventId]/_pages/report-form';
import { SupplierFormAnswers } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/supplier-form-answers';
import { draftItemOf, formSizeLine, type FormItemRow } from '@/lib/vendor-forms';
import type { ShopForm } from '@/lib/vendor-forms.server';

const EV = '00000000-0000-4000-8000-0000000000e1';
const SHOP = '00000000-0000-4000-8000-0000000000cc';

function q(id: string, form: string, prompt: string, answer_type = 'short_answer', extra: Partial<FormItemRow> = {}): FormItemRow {
  return {
    question_id: id,
    form_id: form,
    item_kind: 'question',
    prompt,
    hint: null,
    answer_type,
    is_required: false,
    options: null,
    media_keys: null,
    video_url: null,
    display_order: Number(id.replace(/\D/g, '')) || 0,
    is_asked: true,
    ...extra,
  };
}

const SHOT: FormItemRow[] = [
  q('s1', 'f-shot', 'Which moments matter most?', 'checkboxes', { options: ['First kiss', 'Entrance', 'First dance', 'The toast'], is_required: true }),
  q('s2', 'f-shot', 'Who are the key people we must photograph?', 'long_answer'),
  q('s3', 'f-shot', 'Is there a first look?', 'yes_no'),
  { ...q('s4', 'f-shot', 'How we shoot the entrance'), item_kind: 'video_link', video_url: 'https://youtu.be/dQw4w9WgXcQ' },
];
const BOOTH: FormItemRow[] = [q('b1', 'f-booth', 'Booth backdrop colour', 'dropdown', { options: ['Ivory', 'Sage', 'Black'] }), q('b2', 'f-booth', 'How many guests?', 'number')];

const LIB: ShopForm[] = [
  { formId: 'f-shot', title: 'Shot list', items: SHOT, serviceIds: ['c-photo'], usedWith: 3, sizeLine: formSizeLine(SHOT), updatedAt: '2026-11-07T02:00:00Z' },
  { formId: 'f-booth', title: 'Booth details', items: BOOTH, serviceIds: ['c-booth'], usedWith: 1, sizeLine: formSizeLine(BOOTH), updatedAt: '2026-11-06T02:00:00Z' },
  { formId: 'f-sign', title: 'Delivery sign-off', items: [q('d1', 'f-sign', 'Who signs off the album?')], serviceIds: [], usedWith: 0, sizeLine: '1 question', updatedAt: '2026-11-05T02:00:00Z' },
];
const CARDS = [
  { id: 'c-photo', title: 'Wedding photo & video' },
  { id: 'c-sde', title: 'Same-day edit' },
  { id: 'c-booth', title: 'Photo booth' },
];

export function FormsLabClient({ mode }: { mode: string }) {
  const [open, setOpen] = useState(true);
  // ?m=load opens the Forms Maker sheet the way a tap on "Load a form" does.
  useEffect(() => {
    if (mode !== 'load') return;
    const t = setTimeout(() => (document.querySelector('[data-testid="forms-load"]') as HTMLElement | null)?.click(), 600);
    return () => clearTimeout(t);
  }, [mode]);

  if (mode === 'maker' || mode === 'new') {
    const f = LIB[0]!;
    return (
      <FormMaker
        open={open}
        onClose={() => setOpen(false)}
        initial={mode === 'maker' ? { formId: f.formId, title: f.title, items: f.items.map(draftItemOf), serviceIds: f.serviceIds } : null}
        cards={CARDS}
        locks={{ media: 'Pro', video: null }}
        eventId={EV}
        returnPath="/dev/forms-lab"
      />
    );
  }
  if (mode === 'report') {
    return <ReportForm eventId={EV} shopName="SetnaProd" eventName="Reyes & Santos wedding" eventDate="2026-11-08" />;
  }
  if (mode === 'couple') {
    return (
      <SupplierFormAnswers
        eventId={EV}
        vendorProfileId={SHOP}
        returnPath="/dev/forms-lab"
        shopName="SetnaProd"
        rows={SHOT.filter((i) => i.item_kind === 'question').map((i) => ({
          questionId: i.question_id,
          prompt: i.prompt,
          hint: i.hint,
          type: i.answer_type,
          required: i.is_required,
          options: i.options ?? [],
          answer: i.question_id === 's1' ? 'First kiss · Entrance' : null,
        }))}
      />
    );
  }
  return (
    <FormsPageBody
      eventId={EV}
      coupleName="Reyes & Santos"
      canSend
      returnPath="/dev/forms-lab"
      library={LIB}
      cards={CARDS}
      event={{
        status: 'ok',
        sent: [
          {
            formId: 'f-shot',
            title: 'Shot list',
            sentBy: 'on_booking',
            sentAt: '2026-10-12T02:00:00Z',
            items: SHOT,
            answers: { s1: 'First kiss · Entrance', s3: 'Yes' },
            answered: 2,
            total: 3,
          },
        ],
        linkedToBooked: [
          { formId: 'f-shot', title: 'Shot list', cardTitles: ['Wedding photo & video'], sent: true },
          { formId: 'f-booth', title: 'Booth details', cardTitles: ['Photo booth'], sent: false },
        ],
      }}
      bookedUnread={false}
      suggestions={{ status: 'ok', serviceLabel: 'Photo & Video', groupLabel: 'Photo & Video', own: [], alsoUseful: [] }}
      locks={{ media: 'Pro', video: null }}
      answersOpen
    />
  );
}
