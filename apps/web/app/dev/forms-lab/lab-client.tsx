'use client';

import { useEffect, useState } from 'react';
import { FormsPageBody } from '@/app/vendor-dashboard/forms/_components/forms-page-body';
import { FormMaker } from '@/app/vendor-dashboard/forms/_components/form-maker';
import { ReportForm } from '@/app/vendor-dashboard/clients/[eventId]/_pages/report-form';
import { SupplierFormAnswers } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/supplier-form-answers';
import { FormsFromShopList } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/forms-from-shop-list';
import { draftItemOf, formSizeLine, sentFormState, titleForCouple, type FormItemDraft, type FormItemRow } from '@/lib/vendor-forms';
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
  { formId: 'f-shot', title: 'Shot list', items: SHOT, serviceIds: ['c-photo'], usedWith: 3, sizeLine: formSizeLine(SHOT), updatedAt: '2026-11-07T02:00:00Z', inLibrary: true, forEventId: null },
  { formId: 'f-booth', title: 'Booth details', items: BOOTH, serviceIds: ['c-booth'], usedWith: 1, sizeLine: formSizeLine(BOOTH), updatedAt: '2026-11-06T02:00:00Z', inLibrary: true, forEventId: null },
  { formId: 'f-sign', title: 'Delivery sign-off', items: [q('d1', 'f-sign', 'Who signs off the album?')], serviceIds: [], usedWith: 0, sizeLine: '1 question', updatedAt: '2026-11-05T02:00:00Z', inLibrary: true, forEventId: null },
];
/** 📋 Piece 3a: this event's own forms — one edited for the couple and kept with them, one also kept in the library. */
const EVENT_FORMS: ShopForm[] = [
  {
    formId: 'f-booth-rs',
    title: 'Booth details · for Reyes & Santos',
    items: BOOTH,
    serviceIds: [],
    usedWith: 0,
    sizeLine: formSizeLine(BOOTH),
    updatedAt: '2026-11-12T02:00:00Z',
    inLibrary: false,
    forEventId: EV,
  },
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
    // ?m=view opens a library form READ-ONLY first, the way a tap on its row does (Piece 3a).
    const sel = mode === 'load' ? '[data-testid="forms-load"]' : mode === 'view' ? '[data-forms-library] button' : null;
    if (!sel) return;
    const t = setTimeout(() => (document.querySelector(sel) as HTMLElement | null)?.click(), 600);
    return () => clearTimeout(t);
  }, [mode]);

  // 📋 Piece 3a: ?m=edit — the Maker as an Edit from a client's page ("Save for Reyes & Santos" · "Also keep in my library").
  if (mode === 'edit') {
    const f = LIB[1]!;
    return (
      <FormMaker
        open={open}
        onClose={() => setOpen(false)}
        initial={{
          title: titleForCouple(f.title, 'Reyes & Santos'),
          items: f.items.map((r) => {
            const { id: _id, ...rest } = draftItemOf(r);
            return rest as FormItemDraft;
          }),
          serviceIds: [],
          forEventId: EV,
          editedFromFormId: f.formId,
          inLibrary: false,
        }}
        cards={CARDS}
        locks={{ media: 'Pro', video: null }}
        eventId={EV}
        returnPath="/dev/forms-lab"
        shopId={SHOP}
        coupleName="Reyes & Santos"
      />
    );
  }
  // 📋 Piece 3a: ?m=couple-list — the couple's "Forms from <shop>" list (open ones first, each with its state).
  if (mode === 'couple-list') {
    return (
      <FormsFromShopList
        shopName="SetnaProd"
        rows={[
          { formId: 'a', title: 'Where do we set up? · for Reyes & Santos', state: sentFormState({ answered: 0, total: 2 }) },
          { formId: 'b', title: 'Shot list', state: sentFormState({ answered: 2, total: 3 }) },
          { formId: 'c', title: 'Booth details', state: sentFormState({ answered: 2, total: 2 }) },
          { formId: 'd', title: 'Delivery sign-off', state: sentFormState({ locked: true, answered: 1, total: 1 }) },
        ]}
      />
    );
  }
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
        shopId={SHOP}
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
      eventForms={mode === 'body-empty' ? [] : EVENT_FORMS}
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
            locked: false,
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
      shopId={SHOP}
    />
  );
}
