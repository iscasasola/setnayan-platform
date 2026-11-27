import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, CircleOff, Plus, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TEMPLATE_SUBLINE, TemplateEmpty, TemplateFail } from '@/app/_components/template-rows';
import { Fold } from '@/app/_components/fold';
import { ToolSection } from '../_components/tool-page';
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
  clientNoun,
}: {
  supabase: SupabaseClient;
  vendorProfileId: string;
  /** The shop's trade set; omitted = the host's emcee set (the original). */
  starters?: ReadonlyArray<StarterQuestion>;
  /**
   * 🔤 Mounted on ONE client (the picked client's Forms page): that event kind's own word (`readClientNoun` —
   * "celebrant" on a debut, "couple" on a wedding). Omitted = the shared questions page, unchanged.
   */
  clientNoun?: string;
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
      clientNoun={clientNoun}
    />
  );
}

/** The drawing, from plain props — also what `/dev/questions-lab` renders. */
export function QuestionsSectionBody({
  measured,
  all,
  starters: tradeStarters,
  clientNoun,
}: {
  measured: boolean;
  all: VendorQuestion[];
  starters?: ReadonlyArray<StarterQuestion>;
  clientNoun?: string;
}) {
  // 🔤 One client's page names that client by its event kind; the every-client lines say "client" (owner, 17 Nov:
  // "Questions for the couple" on a debut). The shared page (no noun) keeps its shipped words.
  const one = clientNoun ?? 'couple';
  const every = clientNoun ? 'client' : 'couple';
  const asked = askedQuestions(all);
  const retired = all.filter((q) => !q.is_asked);
  const starters = measured ? startersNotYetAdded(all, tradeStarters) : [];

  return (
    <section id="questions" className="scroll-mt-4">
      {/* The redraw (v3, 21 Nov 2026): the supplier label with its count and ⓘ; the gold icon and the top line are gone. */}
      <h2 className="hc-k2 mb-1 mt-[18px] min-h-9">
        <InfoTip
          label={`Questions for the ${one}`}
          labelNode={
            <span className="inline-flex items-center gap-2">
              Questions for the {one}
              {measured && asked.length > 0 ? <em className="tabular-nums">{asked.length}</em> : null}
            </span>
          }
          align="start"
        >
          {every === 'client' ? 'Clients' : 'Couples'} who book you answer them in their event. Before a booking, send them from the
          chat: ＋ › Questions for the {one}. You read the answers on their customer card. Their
          answers stay with their event — only your questions carry on.
        </InfoTip>
      </h2>
      <p className={`mb-2 ${TEMPLATE_SUBLINE}`}>Write them once — every {every} you work with answers them.</p>

      {!measured ? (
        <TemplateFail data="questions">
          <strong>We couldn&rsquo;t load your questions.</strong> They have not been deleted —
          reload before writing them again.
        </TemplateFail>
      ) : asked.length === 0 ? (
        <TemplateEmpty data="questions">
          You are not asking {every}s anything yet. Start from the suggestions below, or write
          your own.
        </TemplateEmpty>
      ) : (
        <ol className="sn-frame px-4 py-1">
          {asked.map((q, i) => (
            <li key={q.question_id}>
              <Fold title={`${i + 1}. ${q.prompt}`} line={q.hint ? `Hint: ${q.hint}` : undefined} wrap data="question">
              <div className="pb-4 pt-1">
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
                      placeholder={`Hint for the ${one} (optional)`}
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
              </div>
              </Fold>
            </li>
          ))}
        </ol>
      )}

      {starters.length > 0 ? (
        <ToolSection label="Suggested — tap to add, then edit freely" data="questions-starters">
          <ul className="sn-frame px-4 py-1">
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
        </ToolSection>
      ) : null}

      <ToolSection label="Write your own" data="questions-own">
        <StayForm door="supActivities.addQuestion" action={addQuestion} className="space-y-2">
          <input
            name="prompt"
            required
            maxLength={QUESTION_PROMPT_MAX}
            aria-label="Your question"
            className={FIELD}
          />
          <input
            name="hint"
            maxLength={QUESTION_HINT_MAX}
            aria-label={`Hint for the ${one}`}
            placeholder={`Hint for the ${one} (optional)`}
            className={FIELD}
          />
          <ActionButton type="submit" tone="brand" icon={<Plus aria-hidden />} label="Add question" />
        </StayForm>
      </ToolSection>

      {retired.length > 0 ? (
        <div className="sn-frame mt-3 px-4 py-1">
          <Fold title={`Not asking · ${retired.length}`} data="questions-retired">
          <p className={TEMPLATE_SUBLINE}>
            Kept, not deleted — {every}s who already answered these still have their answers.
          </p>
          <ul className="pb-2">
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
          </Fold>
        </div>
      ) : null}
    </section>
  );
}

/** A typed field — the template's 12-corner field, 44 high, on the page's own paper. */
const FIELD =
  'w-full min-h-11 rounded-xl border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-[15px] text-ink placeholder:text-[color:var(--m-slate-2)]'; // no-card-ok: a typed field's own outline (inputs / selects / textareas), not a box around content
