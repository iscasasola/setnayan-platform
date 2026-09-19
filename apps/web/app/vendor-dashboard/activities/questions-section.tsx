import type { SupabaseClient } from '@supabase/supabase-js';
import { MessageCircleQuestion, Plus } from 'lucide-react';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  askedQuestions,
  startersNotYetAdded,
  QUESTION_HINT_MAX,
  QUESTION_PROMPT_MAX,
  type VendorQuestion,
} from '@/lib/emcee-questions';
import { addQuestion, toggleQuestionAsked, updateQuestion } from './question-actions';

/**
 * QUESTIONS FOR THE COUPLE — the host's reusable question set. (DAY-7.)
 *
 * Spec § 8 of `Emcee_Script_System_BUILD_SPEC_2026-07-29.md`. It sits on the
 * segments page because it is the same KIND of thing — his craft, written once,
 * reused at every wedding — and a host who has written his segments is
 * standing exactly where he thinks about what he needs to ask.
 *
 * The couple answers on their schedule page, under his segments; he reads the
 * answers on their Customer Card's Script tab.
 */
export async function QuestionsSection({
  supabase,
  vendorProfileId,
}: {
  supabase: SupabaseClient;
  vendorProfileId: string;
}) {
  const { data, error } = await supabase
    .from('vendor_questions')
    .select('question_id, vendor_profile_id, prompt, hint, is_asked, display_order')
    .eq('vendor_profile_id', vendorProfileId)
    .order('display_order', { ascending: true });

  if (error) {
    logQueryError('QuestionsSection.questions', error, { vendorProfileId }, 'graceful_degrade');
  }
  const measured = !error && data !== null;
  const all = (data ?? []) as VendorQuestion[];
  const asked = askedQuestions(all);
  const retired = all.filter((q) => !q.is_asked);
  const starters = measured ? startersNotYetAdded(all) : [];

  return (
    <section id="questions" className="scroll-mt-4 space-y-4 border-t border-ink/10 pt-6">
      <header className="space-y-2">
        <h2 className="inline-flex items-center gap-2 font-pahina text-2xl font-light leading-tight tracking-tight text-ink">
          <MessageCircleQuestion aria-hidden className="h-5 w-5 text-gild" strokeWidth={1.7} />
          Questions for the couple
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-ink/70">
          What only they can tell you — how to say their names, who to call up and in what
          order, what you must never mention. Write your questions once; every couple who
          books you answers them on their schedule page, and you read the answers on their
          Script tab. Their answers stay with their wedding — only your questions carry on.
        </p>
      </header>

      {!measured ? (
        <p
          role="alert"
          className="border-t-[3px] border-mulberry/70 bg-mulberry/5 px-4 py-3 text-sm leading-relaxed text-ink/70"
        >
          <strong className="text-ink">We couldn&rsquo;t load your questions.</strong> They have
          not been deleted — reload before writing them again.
        </p>
      ) : asked.length === 0 ? (
        <p className="border border-dashed border-ink/15 px-4 py-6 text-center text-sm leading-relaxed text-ink/65">
          You are not asking couples anything yet. Start from the suggestions below, or write
          your own.
        </p>
      ) : (
        <ol className="space-y-2">
          {asked.map((q, i) => (
            <li key={q.question_id} className="border border-ink/10 bg-white p-3">
              <form action={updateQuestion} className="space-y-2">
                <input type="hidden" name="question_id" value={q.question_id} />
                <div className="flex items-start gap-2">
                  <span className="pt-2 font-mono text-[0.66rem] text-ink/45">{i + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <input
                      name="prompt"
                      defaultValue={q.prompt}
                      maxLength={QUESTION_PROMPT_MAX}
                      aria-label="Question"
                      className="w-full border border-ink/15 px-2.5 py-1.5 text-sm font-medium text-ink"
                    />
                    <input
                      name="hint"
                      defaultValue={q.hint ?? ''}
                      maxLength={QUESTION_HINT_MAX}
                      aria-label="Hint shown under the answer box"
                      placeholder="Hint for the couple (optional)"
                      className="w-full border border-ink/15 px-2.5 py-1.5 text-xs text-ink/80 placeholder:text-ink/40"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-6">
                  <button
                    type="submit"
                    className="border border-ink/15 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-ink/75 transition-colors hover:border-gild"
                  >
                    Save
                  </button>
                </div>
              </form>
              <form action={toggleQuestionAsked} className="mt-1 flex justify-end">
                <input type="hidden" name="question_id" value={q.question_id} />
                <input type="hidden" name="is_asked" value="false" />
                <button
                  type="submit"
                  className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-ink/55 underline-offset-4 hover:text-terracotta-700 hover:underline"
                >
                  Stop asking
                </button>
              </form>
            </li>
          ))}
        </ol>
      )}

      {starters.length > 0 ? (
        <div className="space-y-2 border border-ink/10 bg-paper-deep p-4">
          <h3 className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
            Suggested — tap to add, then edit freely
          </h3>
          <ul className="space-y-1.5">
            {starters.map((s) => (
              <li key={s.prompt}>
                <form action={addQuestion}>
                  <input type="hidden" name="prompt" value={s.prompt} />
                  <input type="hidden" name="hint" value={s.hint} />
                  <button
                    type="submit"
                    className="flex w-full items-start gap-2 border border-ink/12 bg-white px-3 py-2 text-left text-sm text-ink transition-colors hover:border-gild/60"
                  >
                    <Plus aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gild" strokeWidth={2} />
                    {s.prompt}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={addQuestion} className="space-y-2 border border-ink/10 bg-paper-deep p-4">
        <h3 className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
          Write your own
        </h3>
        <input
          name="prompt"
          required
          maxLength={QUESTION_PROMPT_MAX}
          aria-label="Your question"
          placeholder="e.g. Which song should play as you enter the reception?"
          className="w-full border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40"
        />
        <input
          name="hint"
          maxLength={QUESTION_HINT_MAX}
          aria-label="Hint for the couple"
          placeholder="Hint for the couple (optional)"
          className="w-full border border-ink/15 bg-white px-3 py-2 text-xs text-ink placeholder:text-ink/40"
        />
        <button
          type="submit"
          className="bg-ink px-4 py-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-paper transition-opacity hover:opacity-90"
        >
          Add question
        </button>
      </form>

      {retired.length > 0 ? (
        <details className="border border-ink/10 bg-paper-deep p-4">
          <summary className="cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/60">
            Not asking · {retired.length}
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-ink/60">
            Kept, not deleted — couples who already answered these still have their answers.
          </p>
          <ul className="mt-3 space-y-2">
            {retired.map((q) => (
              <li key={q.question_id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink/70">{q.prompt}</span>
                <form action={toggleQuestionAsked}>
                  <input type="hidden" name="question_id" value={q.question_id} />
                  <input type="hidden" name="is_asked" value="true" />
                  <button
                    type="submit"
                    className="border border-ink/15 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-ink/70 transition-colors hover:border-gild"
                  >
                    Ask again
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
