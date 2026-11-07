import { ClipboardList } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { answeredCount, liveItems, type FormItemRow } from '@/lib/vendor-forms';
import { parseVideoLink } from '@/lib/video-embed';
import { formatCount } from '@/lib/format-number';
import { SupplierFormAnswers } from './supplier-form-answers';

/**
 * 📋 THE FORMS A SUPPLIER SENT — answered in that supplier's room, under "{SHOP} asks" (THE ONE BUILD · C3 Forms,
 * couple side; DECISION_LOG 2026-10-28 "the answers flow back to the supplier's view").
 *
 * Each form the shop sent into THIS event (`event_form_sends` — by the supplier from the chat, or on booking) is its
 * own section: its question lines answered by type (text answers only in this build), its video links as links, its
 * media named. A form is shown ONLY once it was sent — the couple's read lane (`vendor_forms_sent_couple_select`)
 * admits nothing else. Nothing sent → renders nothing (no empty panel, no advert). A refused read SAYS so.
 *
 * Saves through the shipped `saveSupplierAnswers`, which accepts an item of a form sent into this event.
 */
export async function SupplierFormsCard({
  supabase,
  eventId,
  eventVendorId,
  vendorProfileId,
  shopName,
}: {
  supabase: SupabaseClient;
  eventId: string;
  eventVendorId: string;
  vendorProfileId: string;
  shopName: string;
}) {
  const sendsRes = await supabase
    .from('event_form_sends')
    .select('form_id, sent_at')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .order('sent_at', { ascending: true });
  if (sendsRes.error) {
    logQueryError('SupplierFormsCard.sends', sendsRes.error, { event_id: eventId }, 'graceful_degrade');
    return <Unread shopName={shopName} />;
  }
  const ids = ((sendsRes.data ?? []) as { form_id: string }[]).map((s) => s.form_id);
  if (ids.length === 0) return null;

  const [formsRes, itemsRes, answersRes] = await Promise.all([
    supabase.from('vendor_forms').select('form_id, title').in('form_id', ids),
    supabase
      .from('vendor_questions')
      .select('question_id, form_id, item_kind, prompt, hint, answer_type, is_required, options, media_keys, video_url, display_order, is_asked')
      .eq('vendor_profile_id', vendorProfileId)
      .in('form_id', ids)
      .order('display_order', { ascending: true }),
    supabase.from('event_question_answers').select('question_id, answer').eq('event_id', eventId),
  ]);
  const err = formsRes.error ?? itemsRes.error ?? answersRes.error;
  if (err) {
    logQueryError('SupplierFormsCard.read', err, { event_id: eventId }, 'graceful_degrade');
    return <Unread shopName={shopName} />;
  }
  const titles = new Map(((formsRes.data ?? []) as { form_id: string; title: string }[]).map((f) => [f.form_id, f.title]));
  const items = (itemsRes.data ?? []) as FormItemRow[];
  const answers = new Map(((answersRes.data ?? []) as { question_id: string; answer: string }[]).map((a) => [a.question_id, a.answer]));
  const returnPath = `/dashboard/${eventId}/vendors/${eventVendorId}/workspace`;

  return (
    <div className="space-y-8" data-supplier-forms>
      {ids.map((formId) => {
        const its = liveItems(items.filter((i) => i.form_id === formId));
        const c = answeredCount(its, new Set(its.filter((i) => answers.has(i.question_id)).map((i) => i.question_id)));
        return (
          <section key={formId} className="space-y-3" aria-labelledby={`form-${formId}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`form-${formId}`} className="inline-flex items-center gap-2 text-[17px] font-semibold text-ink">
                <ClipboardList aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={1.9} />
                {titles.get(formId) ?? `${shopName}’s form`}
              </h2>
              {c.total > 0 ? (
                <span className="text-[13px] text-ink/60">
                  {c.answered === c.total ? 'All answered' : `${formatCount(c.answered)} of ${formatCount(c.total)} answered`}
                </span>
              ) : null}
            </div>
            <p className="text-[14px] text-ink/70">From {shopName}. Only the two of you and {shopName} read your answers.</p>
            {its
              .filter((i) => i.item_kind !== 'question')
              .map((i) =>
                i.item_kind === 'video_link' && i.video_url ? (
                  <p key={i.question_id} className="text-[14px]">
                    <a href={i.video_url} target="_blank" rel="noopener noreferrer" className="text-sn-accent underline underline-offset-4">
                      ▶ {i.prompt} · {parseVideoLink(i.video_url)?.label ?? 'Video'}
                    </a>
                  </p>
                ) : (
                  <p key={i.question_id} className="text-[14px] text-ink/70">
                    {i.prompt} · {i.media_keys?.length ?? 0} file{(i.media_keys?.length ?? 0) === 1 ? '' : 's'}
                  </p>
                ),
              )}
            <SupplierFormAnswers
              eventId={eventId}
              vendorProfileId={vendorProfileId}
              returnPath={returnPath}
              shopName={shopName}
              rows={its
                .filter((i) => i.item_kind === 'question')
                .map((i) => ({
                  questionId: i.question_id,
                  prompt: i.prompt,
                  hint: i.hint,
                  type: i.answer_type,
                  required: i.is_required,
                  options: i.options ?? [],
                  answer: answers.get(i.question_id) ?? null,
                }))}
            />
          </section>
        );
      })}
    </div>
  );
}

function Unread({ shopName }: { shopName: string }) {
  return (
    <p role="alert" className="text-sm text-ink/70">
      <strong className="text-ink">We couldn&rsquo;t load {shopName}&rsquo;s forms.</strong> Anything you already answered is safe. Reload in a moment.
    </p>
  );
}
