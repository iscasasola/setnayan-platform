'use client';

/**
 * 📝 FORM — both faces, one question at a time (Supplier Build 3 · lane C; prototype v8.3 `STEPS.form` + `formCard`).
 *
 * Supplier (+): ① Which form? (the shop's saved library) → ② its questions, as they will be asked → Send — the SHIPPED
 * send (`formsAction` op=send: `event_form_sends` row + the "I sent you a form" line + the in-app notice).
 * Host: under that line, the form answers ONE question at a time ("They answer one question at a time and can stop and
 * continue"), each answer kept through the SHIPPED `saveSupplierAnswers` (only what this screen changed is written).
 * A form the supplier made final (`event_form_sends.locked`) is read-only — "Ask for a change" is the way.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Pause } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { formsAction } from '@/app/vendor-dashboard/forms/actions';
import { saveSupplierAnswers } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/question-answers-actions';
import { HOST_ANSWER_BASE_FIELD, HOST_ANSWER_FIELD } from '@/lib/host-answers-merge';
import { formProgress } from '@/lib/chat-cards';
import { formatCount } from '@/lib/format-number';
import { ChatCardShell, ChatStepCard, isStepEnter, type ChatCardStep } from '../chat-step-card';
import { loadSentFormForAnswer, loadShopFormsForCard, type FormToAnswer } from './card-calls';
import { CouldNotLoad, EmptyLine, Loading, Problem, type Read } from './card-bits';

type LibForm = { formId: string; title: string; questions: string[] };

export function FormStepCard({
  threadId,
  eventId,
  returnPath,
  onClose,
  onSent,
  seed,
}: {
  threadId: string;
  eventId: string;
  returnPath: string;
  onClose?: () => void;
  onSent?: () => void;
  seed?: { forms: LibForm[]; pick?: string; step?: number };
}) {
  const formId = useId();
  const [read, setRead] = useState<Read<LibForm[]>>(seed ? { at: 'ok', data: seed.forms } : { at: 'loading' });
  const [pick, setPick] = useState<string | null>(seed?.pick ?? null);
  const [step, setStep] = useState(seed?.step ?? 0);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadShopFormsForCard(threadId).then((r) => setRead(r.ok ? { at: 'ok', data: r.forms } : { at: 'failed' }));
  }, [threadId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  if (read.at !== 'ok' || read.data.length === 0) {
    return (
      <ChatCardShell topic="forms" kicker="You · not sent yet" title="Form" onClose={onClose}>
        {read.at === 'loading' ? (
          <Loading />
        ) : read.at === 'failed' ? (
          <CouldNotLoad what="your forms" onRetry={load} />
        ) : (
          <EmptyLine line="No saved forms yet — make one under Forms in your shop, then send it here." />
        )}
      </ChatCardShell>
    );
  }
  const forms = read.data;
  const f = forms.find((x) => x.formId === pick) ?? null;
  const steps: ChatCardStep[] = [
    {
      title: 'Which form?',
      body: (
        <PickMenu
          label="Which form?"
          value={pick}
          options={forms.map((x) => ({ key: x.formId, label: `${x.title} · ${x.questions.length} question${x.questions.length === 1 ? '' : 's'}` }))}
          onPick={setPick}
          buttonText={pick ? undefined : 'Pick a saved form'}
          dataAttr="data-form-pick"
        />
      ),
      ok: !!pick,
    },
    {
      title: f?.title ?? '',
      sub: 'They answer one question at a time and can stop and continue.',
      body: (
        <div className="grid gap-2">
          <ol className="m-0 grid list-decimal gap-1.5 pl-5 text-[15px]">
            {(f?.questions ?? []).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
          <Problem text={problem} />
        </div>
      ),
      ok: !!f && f.questions.length > 0,
    },
  ];
  return (
    <form
      id={formId}
      action={async (fd) => {
        setSending(true);
        setProblem(null);
        const r = await formsAction({ status: 'idle' }, fd);
        setSending(false);
        if (r.status === 'sent') onSent?.();
        else setProblem(r.status === 'error' ? r.message : "Couldn't send that. Try again.");
      }}
    >
      <input type="hidden" name="op" value="send" />
      <input type="hidden" name="form_id" value={pick ?? ''} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <ChatStepCard topic="forms" kicker="You · not sent yet" title="Form" steps={steps} step={step} onStep={setStep} sending={sending} onClose={onClose} submitForm={formId} />
    </form>
  );
}

/** The supplier's form line, as the host answers it. Mounted (lazily) under "I sent you a form — “<title>”". */
export function FormAnswerCard({ threadId, title, returnPath, seed }: { threadId: string; title: string; returnPath: string; seed?: FormToAnswer }) {
  const [read, setRead] = useState<Read<FormToAnswer | null>>(seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadSentFormForAnswer(threadId, title).then((r) => setRead(r.ok ? { at: 'ok', data: r.form } : { at: 'failed' }));
  }, [threadId, title]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);
  if (read.at === 'ok' && !read.data) return null;
  return (
    <ChatCardShell topic="forms" kicker="Form" title={title} tone="theirs">
      {read.at === 'loading' ? <Loading /> : read.at === 'failed' ? <CouldNotLoad what="this form" onRetry={load} /> : <Answering form={read.data!} returnPath={returnPath} />}
    </ChatCardShell>
  );
}

function Answering({ form, returnPath }: { form: FormToAnswer; returnPath: string }) {
  const [answers, setAnswers] = useState<(string | null)[]>(form.questions.map((q) => q.answer));
  const prog = formProgress(answers);
  const [at, setAt] = useState(prog.done ? -1 : prog.at);
  const [draft, setDraft] = useState('');
  const [paused, setPaused] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const n = form.questions.length;
  const list = (
    <ol className="m-0 grid gap-1 pl-0" data-form-answers="">
      {form.questions.map((q, i) => (
        <li key={q.id} className="list-none">
          <button
            type="button"
            disabled={form.locked || answers[i] == null}
            onClick={() => {
              setAt(i);
              setDraft(answers[i] ?? '');
            }}
            className="grid w-full gap-0.5 rounded-lg px-1 py-1.5 text-left"
          >
            <span className="text-[13px] text-ink/60">
              {i + 1}. {q.prompt}
            </span>
            <span className={`text-[15px] ${answers[i] == null ? 'text-ink/35' : 'text-ink'}`}>{answers[i] ?? '—'}</span>
          </button>
        </li>
      ))}
    </ol>
  );
  if (form.locked) return <div className="grid gap-2"><p className="text-[14px] text-ink/60">The supplier made this form final · {formatCount(prog.answered)} of {formatCount(n)} answered</p>{list}</div>;
  if (at < 0 || paused) {
    return (
      <div className="grid gap-2">
        <p className={`text-[14px] ${prog.done ? 'font-medium text-success-700' : 'text-ink/65'}`}>
          {prog.done ? `All ${formatCount(n)} answered · tap one to change it` : `${formatCount(prog.answered)} of ${formatCount(n)} answered`}
        </p>
        {list}
        {paused && !prog.done ? (
          <div className="flex">
            <ActionButton tone="brand" main icon={ChevronRight} label="Continue" onClick={() => setPaused(false)} />
          </div>
        ) : null}
      </div>
    );
  }
  const q = form.questions[at]!;
  const save = async () => {
    const v = draft.trim();
    if (!v || saving) return;
    setSaving(true);
    setProblem(null);
    const fd = new FormData();
    fd.set('event_id', form.eventId);
    fd.set('vendor_profile_id', form.vendorProfileId);
    fd.set('return_path', returnPath);
    fd.set(`${HOST_ANSWER_FIELD}${q.id}`, v);
    fd.set(`${HOST_ANSWER_BASE_FIELD}${q.id}`, answers[at] ?? '');
    const r = await saveSupplierAnswers({ status: 'idle' }, fd);
    setSaving(false);
    if (r.status !== 'saved') return setProblem(r.status === 'error' ? r.message : "Couldn't save that. Try again.");
    const next = answers.map((a, i) => (i === at ? v : a));
    setAnswers(next);
    setDraft('');
    const p = formProgress(next);
    setAt(p.done ? -1 : p.at);
  };
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)] gap-3"
      data-form-asking={`${at + 1}/${n}`}
      onKeyDown={(e) => {
        if (isStepEnter(e, e.target)) {
          e.preventDefault();
          void save();
        }
      }}
    >
      <div className="grid gap-1">
        <p className="text-[13px] tabular-nums text-ink/55">
          {formatCount(at + 1)} of {formatCount(n)}
        </p>
        <p className="text-[17px] font-semibold leading-snug text-ink">{q.prompt}</p>
      </div>
      <TypedRow name="Your answer" long boxed value={draft} empty="Type it here" maxLength={2000} openAsk={at + 1} onType={setDraft} onKeep={(v) => setDraft(v)} />
      <Problem text={problem} />
      <FitFoot>
        <ActionButton tone="neutral" quiet icon={Pause} label="Stop for now" onClick={() => setPaused(true)} />
        {at > 0 ? <ActionButton tone="neutral" icon={ChevronLeft} label="Back" onClick={() => setAt(at - 1)} /> : null}
        <ActionButton tone="brand" main icon={ChevronRight} label={saving ? 'Saving…' : at === n - 1 ? 'Done' : 'Next'} onClick={() => void save()} waiting={!draft.trim() || saving} />
      </FitFoot>
    </div>
  );
}

/** Three buttons on a "theirs" card (92% wide) do not fit at 320–390 with words — the house fit pass (rule 3a) drops
 *  every secondary to one state together, the main verb keeps its word. */
function FitFoot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFitRow(ref);
  return (
    // A spacer, never justify-end: overflow to the LEFT is not in scrollWidth, so the fit pass would read "fits".
    <div ref={ref} className="flex items-center gap-2 border-t border-ink/10 pt-3">
      <span className="mr-auto" />
      {children}
    </div>
  );
}
