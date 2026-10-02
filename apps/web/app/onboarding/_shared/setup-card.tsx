'use client';

/**
 * setup-card.tsx — the ONE screen that draws every setup card (G1).
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "THE ONBOARDING PHONE DESIGN — APPROVED",
 * prototypes/event_onboarding_phone_2026-10-01_fable.html): one question per
 * screen, "n of N", every card answered (a quick answer is a real answer — no
 * Skip, no Later), one small "You can change this anytime". The same card on
 * every type; the profile changes only the words, the colours and which cards
 * appear (`resolveSetupSteps`, flow-config.ts).
 *
 * INTERACTION_RULES: title ≤ 5 words + one line ≤ 12 words, details behind ⓘ;
 * two options → two buttons; three or more → ONE PickMenu; no confirm dialogs.
 * The frame stays the Setnayan look; the accent takes on the type's skin
 * (wedding gold · birthday coral · casual teal · a wake grey, no gold).
 */

import {
  LOGO_QUESTION,
  coverChoices,
  giftsChoices,
  giftsQuestion,
  logoChoices,
  papicChoices,
  papicQuestion,
  type AnswerChoice,
} from '@/lib/event-answers';
import { useState, type ReactNode } from 'react';
import { formatCount } from '@/lib/format-number';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  defaultLookId,
  moreRows,
  setupQuickAnswers,
  type SetupAnswers,
  type SetupCardId,
  type SetupView,
} from '@/lib/onboarding/setup-answers';

const SKIN_ACCENT: Record<SetupView['skin'], string> = {
  wedding: '#8a6a2b',
  party: '#d0604b',
  casual: '#2a7f7a',
  quiet: '#6b6b6b',
};


/**
 * The frame every setup card shares — "n of N", the title with its ⓘ, the one
 * line, the answer, the quick answers, one small "You can change this anytime".
 * Exported so the wedding's own cards (`wedding-cards.tsx`) wear the SAME frame
 * as the engine's: one look, never a second card component.
 */
export function SetupFrame({
  skin,
  n,
  total,
  title,
  line,
  info,
  quick = [],
  onQuick,
  footer = 'You can change this anytime',
  dataCard,
  children,
}: {
  skin: SetupView['skin'];
  n: number;
  total: number;
  title: string;
  line: string;
  info: string;
  quick?: readonly string[];
  onQuick?: (label: string) => void;
  footer?: string;
  dataCard: string;
  children: ReactNode;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <div data-setup-card={dataCard} data-skin={skin}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
        {formatCount(n)} of {formatCount(total)}
      </p>
      <div className="mt-2 flex items-start gap-2">
        <h1
          className={`text-[28px] font-medium leading-[1.12] text-ink sm:text-4xl ${
            skin === 'wedding' ? 'font-serif italic' : skin === 'quiet' ? 'font-serif font-light' : 'font-sans'
          }`}
        >
          {title}
        </h1>
        <button
          type="button"
          aria-expanded={infoOpen}
          aria-label="More about this"
          onClick={() => setInfoOpen((v) => !v)}
          className="mt-1 inline-flex !min-h-0 h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/20 text-xs text-ink/55"
        >
          i
        </button>
      </div>
      <p className="mt-2 text-ink/60">{line}</p>
      {infoOpen ? <p className="mt-2 text-sm text-ink/50">{info}</p> : null}

      <div className="mt-6">{children}</div>

      {quick.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQuick?.(q)}
              className="rounded-full border border-ink/15 bg-paper px-4 py-2 text-sm text-ink/70"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-6 text-xs text-ink/40">{footer}</p>
    </div>
  );
}

type Props = {
  card: SetupCardId;
  view: SetupView;
  answers: SetupAnswers;
  onChange: (patch: Partial<SetupAnswers>) => void;
  /** Move on — a quick answer answers AND advances. */
  onNext: () => void;
  /** 1-based position and the total, for "n of N". */
  n: number;
  total: number;
};

export function SetupCard({ card, view, answers, onChange, onNext, n, total }: Props) {
  const accent = SKIN_ACCENT[view.skin];
  const copy = cardCopy(card, view);
  const quick = setupQuickAnswers(card, view.solemn);

  const choice = (on: boolean) =>
    `min-h-[48px] flex-1 rounded-[var(--m-r-md)] border px-4 py-3 text-left text-sm ${
      on ? 'bg-paper font-semibold text-ink' : 'border-ink/15 bg-paper text-ink/60'
    }`;
  const choiceStyle = (on: boolean) => (on ? { borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}` } : undefined);

  function answerQuick(label: string) {
    if (card === 'setup_where') onChange(label === 'At home' ? { where: 'home', whereText: '' } : { where: 'undecided', whereText: '' });
    if (card === 'setup_photo') onChange({ photo: 'theme' });
    if (card === 'setup_look') onChange({ look: answers.look || defaultLookId(view) });
    if (card === 'setup_guests') onChange({ guests: 'later' });
    onNext();
  }

  return (
    <SetupFrame
      dataCard={card}
      skin={view.skin}
      n={n}
      total={total}
      title={copy.title}
      line={copy.line}
      info={copy.info}
      quick={quick}
      onQuick={answerQuick}
      footer={card === 'setup_more' ? 'You can change any of these anytime' : 'You can change this anytime'}
    >
        {card === 'setup_where' ? (
          <input
            value={answers.where === 'place' ? answers.whereText : ''}
            onChange={(e) => onChange({ where: 'place', whereText: e.target.value })}
            placeholder={view.solemn ? 'The chapel, parish or home' : 'The venue or place'}
            className="w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-lg text-ink outline-none"
            style={answers.where === 'place' ? { borderColor: accent } : undefined}
          />
        ) : null}

        {card === 'setup_photo' ? (
          <div className="flex flex-col gap-2">
            <button type="button" className={choice(answers.photo === 'upload')} style={choiceStyle(answers.photo === 'upload')} onClick={() => onChange({ photo: 'upload' })}>
              {coverChoices(view.solemn)[0]!.label}
              {answers.photo === 'upload' ? (
                <span className="mt-1 block text-xs font-normal text-ink/50">You’ll add it from your Event Hub.</span>
              ) : null}
            </button>
          </div>
        ) : null}

        {card === 'setup_look' ? (
          <>
            <PickMenu
              label="Pick a look"
              value={answers.look}
              options={view.looks.map((l) => ({
                key: l.id,
                label: l.pro ? `${l.name} ◆` : l.name,
                ...(view.skin === 'wedding' ? { group: l.pro ? 'Event Hub Pro ◆' : 'Free' } : {}),
              }))}
              onPick={(key) => onChange({ look: key })}
              dataAttr="data-setup-look"
            />
            {view.looks.some((l) => l.pro) ? (
              <p className="mt-2 text-xs text-ink/50">◆ Pro — try it now; you pay only when you apply it.</p>
            ) : null}
          </>
        ) : null}

        {card === 'setup_guests' ? (
          <PickMenu
            label="How do you want to add them?"
            value={answers.guests}
            buttonText={answers.guests ? undefined : 'Pick one'}
            options={[
              { key: 'people', label: 'From your people', hint: 'Contacts you’ve used' },
              { key: 'type', label: 'Type names' },
              { key: 'import', label: 'Import a list', hint: 'CSV · Sheets' },
              { key: 'later', label: view.solemn ? 'Later' : 'I’ll add them later' },
            ]}
            onPick={(key) => onChange({ guests: key as SetupAnswers['guests'] })}
            dataAttr="data-setup-guests"
          />
        ) : null}

        {card === 'setup_more' ? (
          <div className="flex flex-col gap-5">
            {moreRows(view, answers.reply).map((row) => {
              const r = moreRowCopy(row, view);
              const value = answers[row] as string;
              return (
                <div key={row} data-setup-more-row={row}>
                  <p className="text-sm font-medium text-ink/75">{r.title}</p>
                  <p className="text-xs text-ink/45">{r.line}</p>
                  <div className="mt-2 flex gap-2">
                    {r.options.map((o) => (
                      <button key={o.v} type="button" className={choice(value === o.v)} style={choiceStyle(value === o.v)} onClick={() => onChange({ [row]: o.v } as Partial<SetupAnswers>)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
    </SetupFrame>
  );
}

function cardCopy(card: SetupCardId, view: SetupView): { title: string; line: string; info: string } {
  const s = view.solemn;
  switch (card) {
    case 'setup_where':
      return {
        title: s ? 'Where is it held?' : 'Where is it?',
        line: s ? 'A chapel, the family home, or a parish.' : 'Guests get directions from your Event Hub.',
        info: 'It shows on your Event Hub and in every invitation. Change it in Details.',
      };
    case 'setup_photo':
      return {
        title: s ? 'Add a photograph' : 'Add a cover photo',
        line: s ? 'A photograph of them, at the top of the notice.' : 'It sits at the top of your Event Hub.',
        info: 'Until you add one, the look’s own picture stands in.',
      };
    case 'setup_look':
      return {
        title: 'Pick a look',
        line: s ? 'Quiet looks only. One pick sets the whole notice.' : 'One pick sets the background, fonts and colours.',
        info: 'The look is what your guests see. Change it any time in the Event Hub Maker.',
      };
    case 'setup_guests':
      return {
        title: s ? 'Who should be told?' : `Add your ${view.guestWord}`,
        line: s
          ? 'The people the notice reaches.'
          : view.skin === 'wedding'
            ? 'We’ll ask whose side as you add them.'
            : 'Your list makes the invites and the replies.',
        info: 'Pick how — you add them right after this.',
      };
    case 'setup_more':
      return {
        title: s ? 'Two more, when you’re ready' : 'A few more, quick',
        line: 'Each has an answer already. Change any you like.',
        info: 'Every one of these lives in your Event Hub and can be switched later.',
      };
  }
}

function moreRowCopy(
  row: 'logo' | 'questions' | 'papic' | 'gifts',
  view: SetupView,
): { title: string; line: string; options: { v: string; label: string }[] } {
  // 🗂 The words of logo · Papic · gifts are the Your info rows' own
  // (lib/event-answers.ts) — the question asked once and the row that changes
  // it later say the same thing.
  const opts = (cs: readonly AnswerChoice[]) => cs.map((c) => ({ v: c.key, label: c.label }));
  switch (row) {
    case 'logo':
      return {
        title: LOGO_QUESTION,
        line: 'For invites and the top of your Event Hub.',
        options: opts(logoChoices(view.skin === 'wedding')),
      };
    case 'questions':
      return {
        title: 'What to ask guests',
        line: view.skin === 'wedding' ? 'Meal · plus-one · a message.' : 'Coming? · How many? · A message.',
        options: [
          { v: 'defaults', label: 'Use the defaults' },
          { v: 'change', label: 'Change' },
        ],
      };
    case 'papic':
      return {
        title: papicQuestion(view.solemn),
        line: view.solemn ? 'Those who come can add theirs, quietly.' : 'Papic — they shoot; tagging comes with it.',
        options: opts(papicChoices()),
      };
    case 'gifts':
      return {
        title: giftsQuestion(view.giftsMode === 'none' ? 'gifts' : view.giftsMode),
        line: 'GCash or bank, right on your Event Hub.',
        options: opts(giftsChoices()),
      };
  }
}
