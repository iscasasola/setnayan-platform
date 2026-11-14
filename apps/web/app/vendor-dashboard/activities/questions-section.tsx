import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, CircleOff, MessageCircleQuestion, Plus, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TEMPLATE_SUBLINE, TemplateEmpty, TemplateFail, TemplateSection } from '@/app/_components/template-rows';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  askedQuestions,
  startersNotYetAdded,
  QUESTION_HINT_MAX,
  QUESTION_PROMPT_MAX,
  type StarterQuestion,
  type VendorQuestion,
} from '@/lib/emcee-questions';
import { InfoTip } from '@/app/_components/info-tip';
import { addQuestion, toggleQuestionAsked, updateQuestion } from './question-actions';
import { StayForm } from '@/app/_components/stay-form';

/**
 * QUESTIONS FOR THE COUPLE — the supplier's reusable question set. (DAY-7.)
 *
 * Spec § 8 of `Emcee_Script_System_BUILD_SPEC_2026-07-29.md` built it for the
 * host/MC. ❓ EVERY SUPPLIER since 2026-11-04 (owner, verbatim "Yes, every
 * supplier"; DECISION_LOG "QUESTIONS FOR THE COUPLE — EVERY SUPPLIER, NOT HOSTS
 * ONLY"): it lives on its own page, `/vendor-dashboard/questions`, reached from
 * the shop's tools — one place for every trade, not the host's segments page.
 *
 * `starters` is the shop's trade set (`startersForTiles`, resolved through the
 * live taxonomy by the page). The couple answers in their event — the host's
 * set on their Schedule, every supplier's in that supplier's room
 * (`/dashboard/[eventId]/vendors/[vendorId]/workspace`); the supplier reads the
 * answers on that customer's card.
 */
export async function QuestionsSection({
  supabase,
  vendorProfileId,
  starters: tradeStarters,
}: {
  supabase: SupabaseClient;
  vendorProfileId: string;
  /** The shop's trade set; omitted = the host's emcee set (the original). */
  starters?: ReadonlyArray<StarterQuestion>;
}) {
  const { data, error } = await supabase
    .from('vendor_questions')
    .select('question_id, vendor_profile_id, prompt, hint, is_asked, display_order')
    .eq('vendor_profile_id', vendorProfileId)
    .is('form_id', null)
    .order('display_order', { ascending: true });

  if (error) {
    logQueryError('QuestionsSection.questions', error, { vendorProfileId }, 'graceful_degrade');
  }
  return (
    <QuestionsSectionBody
      measured={!error && data !== null}
      all={(data ?? []) as VendorQuestion[]}
      starters={tradeStarters}
    />
  );
}

/** The drawing, from plain props — also what `/dev/questions-lab` renders. */
export function QuestionsSectionBody({
  measured,
  all,
  starters: tradeStarters,
}: {
  measured: boolean;
  all: VendorQuestion[];
  starters?: ReadonlyArray<StarterQuestion>;
}) {
  const asked = askedQuestions(all);
  const retired = all.filter((q) => !q.is_asked);
  const starters = measured ? startersNotYetAdded(all, tradeStarters) : [];

  return (
    <section id="questions" className="scroll-mt-4 space-y-2 border-t border-[color:var(--m-line)] pt-4">
      <header className="space-y-1">
        <h2 className="inline-flex items-center gap-2 text-[17px] font-bold leading-tight text-ink">
          <MessageCircleQuestion aria-hidden className="h-5 w-5 text-gild" strokeWidth={1.7} />
          Questions for the couple
        </h2>
        {/* ⓘ Title + one short line visible; the rest inside the tip (house rule). */}
        <InfoTip
          label="Write them once — every couple you work with answers them."
          labelAs="p"
          labelClassName={`max-w-prose ${TEMPLATE_SUBLINE}`}
          align="start"
        >
          Couples who book you answer them in their event. Before a booking, send them from the
          chat: ＋ › Questions for the couple. You read the answers on their customer card. Their
          answers stay with their event — only your questions carry on.
        </InfoTip>
      </header>

      {!measured ? (
        <TemplateFail data="questions">
          <strong>We couldn&rsquo;t load your questions.</strong> They have not been deleted —
          reload before writing them again.
        </TemplateFail>
      ) : asked.length === 0 ? (
        <TemplateEmpty data="questions">
          You are not asking couples anything yet. Start from the suggestions below, or write
          your own.
        </TemplateEmpty>
      ) : (
        <ol className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
          {asked.map((q, i) => (
            <li key={q.question_id} className="py-3">
              <StayForm door="supActivities.updateQuestion" action={updateQuestion} className="space-y-2">
                <input type="hidden" name="question_id" value={q.question_id} />
                <div className="flex items-start gap-2">
                  <span className="min-w-5 pt-3 text-[13px] font-semibold tabular-nums text-[color:var(--m-slate-2)]">{i + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <input
                      name="prompt"
                      defaultValue={q.prompt}
                      maxLength={QUESTION_PROMPT_MAX}
                      aria-label="Question"
                      className={`${FIELD} font-medium`}
                    />
                    <input
                      name="hint"
                      defaultValue={q.hint ?? ''}
                      maxLength={QUESTION_HINT_MAX}
                      aria-label="Hint shown under the answer box"
                      placeholder="Hint for the couple (optional)"
                      className={FIELD}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-7">
                  <ActionButton type="submit" tone="brand" icon={<Check aria-hidden />} label="Save" />
                </div>
              </StayForm>
              <StayForm door="supActivities.toggleQuestionAsked" action={toggleQuestionAsked} className="mt-1 flex justify-end">
                <input type="hidden" name="question_id" value={q.question_id} />
                <input type="hidden" name="is_asked" value="false" />
                <ActionButton type="submit" tone="neutral" quiet icon={<CircleOff aria-hidden />} label="Stop asking" />
              </StayForm>
            </li>
          ))}
        </ol>
      )}

      {starters.length > 0 ? (
        <TemplateSection label="Suggested — tap to add, then edit freely">
          <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
            {starters.map((s) => (
              <li key={s.prompt}>
                <StayForm door="supActivities.addQuestion" action={addQuestion}>
                  <input type="hidden" name="prompt" value={s.prompt} />
                  <input type="hidden" name="hint" value={s.hint} />
                  <button
                    type="submit"
                    className="sn-press flex min-h-14 w-full items-center gap-2.5 py-2 text-left text-[15px] text-ink"
                  >
                    <Plus aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={2} />
                    {s.prompt}
                  </button>
                </StayForm>
              </li>
            ))}
          </ul>
        </TemplateSection>
      ) : null}

      <TemplateSection label="Write your own">
        <StayForm door="supActivities.addQuestion" action={addQuestion} className="space-y-2">
          <input
            name="prompt"
            required
            maxLength={QUESTION_PROMPT_MAX}
            aria-label="Your question"
            placeholder="e.g. Which song should play as you enter the reception?"
            className={FIELD}
          />
          <input
            name="hint"
            maxLength={QUESTION_HINT_MAX}
            aria-label="Hint for the couple"
            placeholder="Hint for the couple (optional)"
            className={FIELD}
          />
          <ActionButton type="submit" tone="brand" icon={<Plus aria-hidden />} label="Add question" />
        </StayForm>
      </TemplateSection>

      {retired.length > 0 ? (
        <details className="mt-[18px]">
          <summary className="flex min-h-11 cursor-pointer items-center text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
            Not asking · {retired.length}
          </summary>
          <p className={TEMPLATE_SUBLINE}>
            Kept, not deleted — couples who already answered these still have their answers.
          </p>
          <ul className="mt-1 [&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
            {retired.map((q) => (
              <li key={q.question_id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="text-[15px] text-ink">{q.prompt}</span>
                <StayForm door="supActivities.toggleQuestionAsked" action={toggleQuestionAsked}>
                  <input type="hidden" name="question_id" value={q.question_id} />
                  <input type="hidden" name="is_asked" value="true" />
                  <ActionButton type="submit" tone="neutral" icon={<RotateCcw aria-hidden />} label="Ask again" />
                </StayForm>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** A typed field — the template's 12-corner field, 44 high, on the page's own paper. */
const FIELD =
  'w-full min-h-11 rounded-xl border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-[15px] text-ink placeholder:text-[color:var(--m-slate-2)]'; // no-card-ok: a typed field's own outline (inputs / selects / textareas), not a box around content
