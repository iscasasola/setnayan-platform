/**
 * 🔒 YOUR LOCKS — the supplier's three switches in one place (FINAL RULINGS 2026-11-09: "Three separate supplier locks,
 * each switchable any time"), drawn under Agreed now on the picked client's Details page.
 *
 * One batched read as the supplier (RLS: their own shop): the live quote (its two locks) and every form sent into this
 * event (each its own lock). Each switch is `LockSwitch`, loaded only when this section draws (it rides no other page).
 * Empty is honest — "Nothing to lock yet" with what will appear — and a refused read says "Couldn't load", never none.
 */
import 'server-only';
import dynamic from 'next/dynamic';
import type { ComponentProps, ComponentType } from 'react';

import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';

import type { LockSwitch as LockSwitchPart } from './lock-switch';

const LockSwitch = dynamic(() => import('./lock-switch').then((m) => m.LockSwitch));
type SwitchPart = ComponentType<ComponentProps<typeof LockSwitchPart>>;

type QuoteRow = { proposal_id: string; title: string | null; changes_locked: boolean; plan_locked: boolean };
type FormRow = { form_id: string; locked: boolean; vendor_forms: { title: string | null } | { title: string | null }[] | null };
type QuestionsRow = { locked: boolean };

export async function SupplierLocksSection({ eventId, vendorProfileId }: { eventId: string; vendorProfileId: string }) {
  const supabase = await createClient();
  const [quote, forms, questions] = await Promise.all([
    supabase
      .from('vendor_proposals')
      .select('proposal_id, title, changes_locked, plan_locked')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .in('status', ['sent', 'viewed', 'accepted', 'expired'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('event_form_sends')
      .select('form_id, locked, vendor_forms(title)')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .order('first_sent_at', { ascending: true }),
    supabase
      .from('event_question_requests')
      .select('locked')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
  ]);
  if (quote.error) logQueryError('SupplierLocks.quote', quote.error, { event_id: eventId }, 'graceful_degrade');
  if (forms.error) logQueryError('SupplierLocks.forms', forms.error, { event_id: eventId }, 'graceful_degrade');
  if (questions.error) logQueryError('SupplierLocks.questions', questions.error, { event_id: eventId }, 'graceful_degrade');
  const failed = Boolean(quote.error || forms.error || questions.error);

  return (
    <SupplierLocksView
      eventId={eventId}
      vendorProfileId={vendorProfileId}
      failed={failed}
      quote={(quote.data as QuoteRow | null) ?? null}
      forms={((forms.data ?? []) as unknown as FormRow[]).map((f) => ({
        formId: f.form_id,
        locked: f.locked,
        title: (Array.isArray(f.vendor_forms) ? f.vendor_forms[0]?.title : f.vendor_forms?.title) ?? null,
      }))}
      questionsLocked={questions.data ? (questions.data as QuestionsRow).locked : null}
      Switch={LockSwitch}
    />
  );
}

/** The section drawn from its reads — labs draw it from fixtures. */
export function SupplierLocksView({
  eventId,
  vendorProfileId,
  failed,
  quote,
  forms,
  questionsLocked,
  Switch,
}: {
  eventId: string;
  vendorProfileId: string;
  failed: boolean;
  quote: QuoteRow | null;
  forms: readonly { formId: string; locked: boolean; title: string | null }[];
  /** Null = no question set was sent. */
  questionsLocked: boolean | null;
  Switch: SwitchPart;
}) {
  const empty = !quote && forms.length === 0 && questionsLocked == null;
  return (
    <section data-supplier-locks="" data-read={failed ? 'failed' : empty ? 'empty' : 'ok'} className="mb-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/55">Your locks</h2>
      {failed ? (
        <p className="mt-1 text-[15px] text-ink/75">Couldn&rsquo;t load your locks. Pull to refresh, or open it again in a moment.</p>
      ) : empty ? (
        <p className="mt-1 text-[15px] text-ink/70">
          Nothing to lock yet. Once you send a quotation or a form, its lock shows here — locked, they can&rsquo;t ask for a change.
        </p>
      ) : (
        <ul className="mt-1">
          {quote ? (
            <>
              <Switch kind="quote" refId={quote.proposal_id} eventId={eventId} locked={quote.changes_locked} title={quote.title} />
              <Switch kind="plan" refId={quote.proposal_id} eventId={eventId} locked={quote.plan_locked} />
            </>
          ) : null}
          {forms.map((f) => (
            <Switch key={f.formId} kind="form" refId={f.formId} eventId={eventId} locked={f.locked} title={f.title} />
          ))}
          {questionsLocked != null ? (
            <Switch kind="questions" refId={vendorProfileId} eventId={eventId} locked={questionsLocked} />
          ) : null}
        </ul>
      )}
    </section>
  );
}
