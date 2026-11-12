'use client';

/**
 * decision-form.tsx — the ONE Decision dropdown on a service request (owner ruling 5).
 *
 *   Add as a new service       → name (their words unless tidied) + category, preset to where they filed
 *   Move to an existing service→ a search of the live services, the filed category's first
 *   Keep just for this shop    → nothing else to fill
 *   Not added                  → the note is REQUIRED (the supplier reads it)
 *
 * Every choice takes a note, and the form prints how many cards move from where to where before the
 * press. ⛔ Nothing here presses by itself: a draft's suggestion arrives only as a default.
 * The server re-checks everything (`decisionProblem` in `decideServiceRequest`).
 */
import { useMemo, useState } from 'react';

import { FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SubmitButton } from '@/app/_components/submit-button';
import { mintKeyFor } from '@/lib/category-proposal-draft';
import {
  cardsMoveLine,
  DECISION_CHOICES,
  decisionProblem,
  othersPlace,
  serviceNameProblem,
  type DecisionChoice,
} from '@/lib/service-requests';
import { decideServiceRequest } from '../../actions';

export type DecisionCategory = { key: string; label: string; group: string };
export type DecisionService = { key: string; label: string; tileId: string; categoryLabel: string; group: string };

const BUTTON: Record<DecisionChoice, { word: (n: number) => string; cls: string }> = {
  add: { word: () => 'Add service', cls: 'bg-success-600 text-white' },
  move: { word: (n) => (n ? `Move ${n} card${n === 1 ? '' : 's'}` : 'Move'), cls: 'bg-success-600 text-white' },
  keep: { word: () => 'Keep for shop', cls: 'bg-success-600 text-white' },
  no: { word: () => 'Not added', cls: 'bg-danger-600 text-white' },
};

export function DecisionForm({
  requestId,
  label,
  filedTileId,
  filedCategoryLabel,
  suggestedName,
  suggestedTarget,
  cards,
  shops,
  categories,
  services,
}: {
  requestId: string;
  label: string;
  filedTileId: string | null;
  filedCategoryLabel: string | null;
  suggestedName: string | null;
  suggestedTarget: string | null;
  cards: number;
  shops: number;
  categories: readonly DecisionCategory[];
  services: readonly DecisionService[];
}) {
  const [choice, setChoice] = useState<DecisionChoice | ''>('');
  const [name, setName] = useState(suggestedName ?? label);
  const [tile, setTile] = useState(filedTileId ?? '');
  const [target, setTarget] = useState(suggestedTarget ?? '');
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const from = othersPlace(filedCategoryLabel);
  const tileLabel = categories.find((c) => c.key === tile)?.label ?? null;
  const picked = services.find((s) => s.key === target) ?? null;
  const to =
    choice === 'add'
      ? `${tileLabel ?? 'Pick a category'} › ${name.trim() || label}`
      : choice === 'move'
        ? picked
          ? `${picked.categoryLabel} › ${picked.label}`
          : null
        : from;
  const hits = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = services.filter((s) => !ql || s.label.toLowerCase().includes(ql) || s.categoryLabel.toLowerCase().includes(ql));
    return [...list].sort((a, b) => (a.tileId === filedTileId ? 0 : 1) - (b.tileId === filedTileId ? 0 : 1)).slice(0, 8);
  }, [q, services, filedTileId]);

  const problem = choice ? decisionProblem({ choice, name, tileId: tile, target, note }) : 'Choose what to do.';

  return (
    <form
      action={decideServiceRequest}
      className="space-y-4"
      data-decision-form=""
      onSubmit={(e) => {
        if (nudgeFormRows(e.currentTarget) > 0 || problem) {
          e.preventDefault();
          setTried(true);
        }
      }}
    >
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="choice" value={choice} />
      <input type="hidden" name="tile_id" value={tile} />
      <input type="hidden" name="target" value={target} />

      <div>
        <h2 className="mb-1.5 text-base font-semibold text-ink">Decision</h2>
        <PickMenu
          label="Decision"
          value={choice || null}
          buttonText={choice ? DECISION_CHOICES.find((c) => c.key === choice)?.label : 'Choose what to do'}
          options={DECISION_CHOICES.map((c) => ({ key: c.key, label: c.label, hint: c.hint }))}
          className="w-full border border-ink/15"
          dataAttr="data-decision-pick"
          onPick={(k) => {
            setChoice(k as DecisionChoice);
            setTried(false);
          }}
        />
      </div>

      {choice === 'add' ? (
        <>
          <FormRows width="wide">
            <TypedRow
              name="Name of the new service"
              value={name}
              boxed
              required
              maxLength={80}
              check={(t) => serviceNameProblem(t)}
              fieldName="name"
              onType={setName}
              onKeep={(t) => setName(t)}
              note={`Their words, unless you tidy them. Key: ${mintKeyFor(name) || 'needs letters or numbers'}`}
              data="decide-name"
            />
          </FormRows>
          <div>
            <p className="mb-1 text-[13px] font-medium text-ink/75">Category</p>
            <PickMenu
              label="Category"
              value={tile || null}
              buttonText={tileLabel ? `${categories.find((c) => c.key === tile)?.group} › ${tileLabel}` : '— choose a category —'}
              options={categories.map((c) => ({ key: c.key, label: c.label, group: c.group }))}
              stickyGroups
              className="w-full border border-ink/15"
              onPick={setTile}
            />
            <p className="mt-1 text-[12.5px] text-ink/60">Preset to where they filed it. Change it if it belongs elsewhere.</p>
          </div>
        </>
      ) : null}

      {choice === 'move' ? (
        <div>
          <label htmlFor="decide-move" className="mb-1 block text-[13px] font-medium text-ink/75">
            Move to
          </label>
          <input
            id="decide-move"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setTarget('');
            }}
            placeholder="Search services"
            className="min-h-11 w-full rounded-full border border-ink/20 bg-white px-4 text-sm"
          />
          {picked ? (
            <div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl bg-white px-4 ring-2 ring-terracotta py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{picked.label}</span>
                <span className="block text-[12.5px] text-ink/60">
                  {picked.group} › {picked.categoryLabel}
                </span>
              </span>
              <button type="button" className="text-[12.5px] font-semibold text-terracotta-700" onClick={() => setTarget('')}>
                Change
              </button>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-ink/10 overflow-hidden rounded-xl bg-white shadow-sm">
              {hits.length === 0 ? <li className="px-4 py-3 text-sm text-ink/60">No service matches “{q}”.</li> : null}
              {hits.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => setTarget(s.key)}
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-ink/[0.03]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{s.label}</span>
                      <span className="block text-[12.5px] text-ink/60">
                        {s.group} › {s.categoryLabel}
                      </span>
                    </span>
                    {s.tileId === filedTileId ? (
                      <span className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[11px] text-ink/70">same category</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {choice === 'keep' ? (
        <p className="text-sm text-ink/70">
          Their shop keeps the name on its cards. The directory does not get a new service. Their cards stay where they are.
        </p>
      ) : null}

      {choice ? (
        <>
          <FormRows width="wide">
            <TypedRow
              key={choice === 'no' ? 'note-required' : 'note-optional'}
              name={`Note to the supplier${shops > 1 ? 's' : ''}${choice === 'no' ? '' : ' (optional)'}`}
              value={note}
              long
              boxed
              required={choice === 'no'}
              maxLength={400}
              empty={choice === 'no' ? 'Say why, in plain words. They read this.' : 'They read this under the decision.'}
              placeholder={choice === 'no' ? 'Say why, in plain words. They read this.' : 'They read this under the decision.'}
              check={(t) => (choice === 'no' && t.trim().length === 0 ? 'A “Not added” needs a reason the supplier can read.' : null)}
              fieldName="resolution_note"
              onType={setNote}
              onKeep={(t) => setNote(t)}
              data="decide-note"
            />
          </FormRows>
          <p className="flex items-baseline gap-2 rounded-xl bg-ink/[0.03] px-4 py-3 text-sm text-ink" data-cards-move="">
            <b className="text-lg">{cards}</b>
            <span>{cardsMoveLine(cards, from, to)}</span>
          </p>
          {shops > 1 ? (
            <p className="text-[12.5px] text-ink/60">This decides it for all {shops} shops that asked for this name; each gets the notice.</p>
          ) : null}
        </>
      ) : null}

      {tried && problem ? (
        <p role="alert" className="text-sm font-medium text-danger-700">
          {problem}
        </p>
      ) : null}

      <SubmitButton
        disabled={!choice}
        className={`min-h-11 rounded-full px-6 text-sm font-semibold disabled:opacity-40 ${choice ? BUTTON[choice].cls : 'bg-terracotta-700 text-white'}`}
        pendingLabel="Deciding…"
      >
        {choice ? BUTTON[choice].word(cards) : 'Decide'}
      </SubmitButton>
    </form>
  );
}
