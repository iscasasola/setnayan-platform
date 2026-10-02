/**
 * religion-panel.tsx — the right-hand panel for one religion (or for
 * mixed-faith couples, which has only "What to expect").
 *
 * Two links are edited HERE and only here, and shown read-only on the other
 * side: "Asked on" (which event types ask "Which religion?" — the event type
 * panel shows "Religions asked") and "Services only for this religion" (the
 * service panel shows "Religion: X only").
 *
 * "What to expect" is the Traditions tab that used to live in /admin/ugat,
 * now on all 17 religions (it stopped at 8).
 */
import { formatCount } from '@/lib/format-number';
import { SubmitButton } from '@/app/_components/submit-button';
import { DIMENSION_LABEL, WEDDING_TRADITIONS_GUIDE, type TraditionGuideKey } from '@/lib/wedding-traditions';
import { RITE_LADDER } from '@/lib/faith-rites';
import { FAITH_REGISTRY } from '@/lib/faith-registry';
import {
  relabelFaithVocab,
  reorderFaithVocab,
  setFaithAskedOn,
  setFaithLaunchStatus,
  setFaithLaunchThreshold,
  setFaithVocabStatus,
  setServiceFaith,
} from '../actions';
import {
  deleteTraditionItem,
  resetTraditionsToDefaults,
  seedTraditionsFromDefaults,
  upsertTraditionItem,
} from '../tradition-actions';
import type { BackState } from './back';
import type { ReligionsData, TraditionRow } from './load';
import { LAUNCH_STATUS_LABEL, askedOnKeys, type Religion, type VocabLabel } from './model';
import { FieldPick, ListPick, SavePick, TogglePick } from './pickers';
import { BackFields, INPUT, KeyRow, ReadOnly, SAVE, Section, SwitchForm, backRecord } from './ui';

const DIMENSIONS = (['officiant', 'ceremonial', 'food', 'custom', 'paperwork'] as const).map((k) => ({
  key: k,
  label: DIMENSION_LABEL[k] ?? k,
}));

export function ReligionPanel({
  religion,
  eventLabels,
  data,
  state,
}: {
  religion: Religion;
  eventLabels: readonly VocabLabel[];
  data: ReligionsData;
  state: BackState;
}) {
  const back = backRecord(state);
  const tagged = data.services.filter((s) => s.faith === religion.key);
  const registry = FAITH_REGISTRY.find((f) => f.faithCol === religion.key) ?? null;
  const rites = religion.ceremonyType ? RITE_LADDER[religion.ceremonyType] ?? [] : [];
  const asked = askedOnKeys(religion);
  const eventName = new Map(eventLabels.map((e) => [e.key, e.label]));

  return (
    <article data-panel="religion">
      <header className="pb-3">
        <p className="text-xs font-medium text-ink/70">Religion</p>
        <h2 className="text-xl font-semibold text-ink">{religion.label}</h2>
        <p className="text-xs text-ink/70">key {religion.key}{religion.isCivil ? ' · civil' : ''}</p>
      </header>

      <Section title="Name & status">
        <form action={relabelFaithVocab} className="flex flex-wrap items-center gap-2">
          <BackFields state={state} />
          <input type="hidden" name="faith_key" value={religion.key} />
          <span className="w-40 shrink-0 text-xs font-medium text-ink/70">Name</span>
          <input name="label_en" defaultValue={religion.label} minLength={2} maxLength={80} className={`${INPUT} flex-1`} />
          <SubmitButton className={SAVE} pendingLabel="Saving…">
            Save
          </SubmitButton>
        </form>
        {religion.launch ? (
          <>
            <KeyRow label="Status for couples">
              <SavePick
                label="Status for couples"
                value={religion.launch.status}
                choices={(['active', 'coming_soon', 'disabled'] as const).map((k) => ({ key: k, label: LAUNCH_STATUS_LABEL[k] }))}
                action={setFaithLaunchStatus}
                field="status"
                hidden={{ ...back, faith_key: religion.key }}
              />
            </KeyRow>
            <form action={setFaithLaunchThreshold} className="flex flex-wrap items-center gap-2">
              <BackFields state={state} />
              <input type="hidden" name="faith_key" value={religion.key} />
              <span className="w-40 shrink-0 text-xs font-medium text-ink/70">Ready at</span>
              <input type="number" name="threshold" min={1} defaultValue={religion.launch.threshold} className={`${INPUT} w-20`} />
              <span className="text-xs text-ink/70">verified suppliers</span>
              <SubmitButton className={SAVE} pendingLabel="Saving…" overlay={false}>
                Save
              </SubmitButton>
            </form>
            <ReadOnly>
              Today: {formatCount(religion.launch.vendorCount)} verified suppliers · {formatCount(religion.launch.venueCount)} ceremony venues ·{' '}
              {religion.launch.ready ? 'ready' : `ready when ≥ ${formatCount(religion.launch.threshold)}`}
            </ReadOnly>
          </>
        ) : (
          <ReadOnly>Status for couples — this religion has no couple-facing launch row yet.</ReadOnly>
        )}
        {religion.status === 'active' ? (
          <KeyRow label="Order">
            <SavePick
              label="Order"
              value=""
              buttonText="Move"
              choices={[
                { key: 'up', label: 'Move up' },
                { key: 'down', label: 'Move down' },
              ]}
              action={reorderFaithVocab}
              field="dir"
              hidden={{ ...back, faith_key: religion.key }}
            />
          </KeyRow>
        ) : null}
      </Section>

      <Section title="Asked on">
        <ListPick
          label="Asked on"
          picked={asked}
          choices={eventLabels.map((e) => ({ key: e.key, label: e.label }))}
          action={setFaithAskedOn}
          field="event_types"
          hidden={{ ...back, faith_key: religion.key }}
          buttonText={asked.length === 0 ? 'No event type' : asked.map((k) => eventName.get(k) ?? k).join(' · ')}
        />
      </Section>

      <Section title={`Services only for this religion (${formatCount(tagged.length)})`}>
        {tagged.length === 0 ? <ReadOnly>None yet — every service shows for everyone.</ReadOnly> : null}
        <TogglePick
          label={`Services only for ${religion.label}`}
          picked={tagged.map((s) => s.canonical)}
          choices={data.services.map((s) => ({
            key: s.canonical,
            label: s.en,
            group: s.tileLabel,
            disabledNote: s.dietary
              ? 'dietary stays for everyone'
              : s.faith && s.faith !== religion.key
                ? `only for ${s.faith}`
                : undefined,
          }))}
          action={setServiceFaith}
          keyField="canonical_service"
          onField="faith"
          onValue={religion.key}
          offValue=""
          hidden={back}
          buttonText={tagged.length === 0 ? '+ Add a service' : tagged.map((s) => s.en).join(' · ')}
        />
      </Section>

      <WhatToExpect ceremonyType={religion.ceremonyType} data={data} state={state} />

      <Section title="Child milestones">
        {rites.length === 0 ? (
          <ReadOnly>None.</ReadOnly>
        ) : (
          <ul className="space-y-1 text-sm text-ink">
            {rites.map((r) => (
              <li key={r.rite}>
                {r.label} · {r.age === 0 ? 'within the first year' : `around age ${r.age}`} · the parish sets the day
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Picture & one line">
        {registry ? (
          <ReadOnly>
            {registry.label} — {registry.desc}
          </ReadOnly>
        ) : (
          <ReadOnly>No picture or line yet.</ReadOnly>
        )}
      </Section>

      <Section title={religion.status === 'active' ? `Deactivate ${religion.label}` : `Reactivate ${religion.label}`} closed>
        <SwitchForm
          action={setFaithVocabStatus}
          on={religion.status === 'active'}
          label="Active"
          fields={{ faith_key: religion.key }}
          valueField="active"
          state={state}
        />
      </Section>
    </article>
  );
}

/** Mixed-faith couples — no religion row, only "What to expect". */
export function MixedFaithPanel({ data, state }: { data: ReligionsData; state: BackState }) {
  return (
    <article data-panel="religion">
      <header className="pb-3">
        <p className="text-xs font-medium text-ink/70">Couples of two faiths</p>
        <h2 className="text-xl font-semibold text-ink">Mixed-faith couples</h2>
      </header>
      <WhatToExpect ceremonyType="mixed" data={data} state={state} />
    </article>
  );
}

/** "What to expect" — the couple's /paperwork guide, per religion. */
function WhatToExpect({
  ceremonyType,
  data,
  state,
}: {
  ceremonyType: string | null;
  data: ReligionsData;
  state: BackState;
}) {
  if (!ceremonyType) {
    return (
      <Section title="What to expect">
        <ReadOnly>This religion has no ceremony key yet, so couples see no “What to expect” for it.</ReadOnly>
      </Section>
    );
  }
  // 🔑 A refused read must not draw "showing the built-in starter content", and
  // must not offer "Load starter content" — that would write the defaults on
  // top of items that exist but could not be read.
  const traditionsUnread = data.failed.includes('what to expect');
  if (traditionsUnread) {
    return (
      <Section title="What to expect">
        <p role="alert" className="text-sm text-ink">
          Couldn’t load the items — loading starter content is off until they can be read.
        </p>
      </Section>
    );
  }
  const items = data.traditions.filter((t) => t.ceremony_type === ceremonyType);
  const guide = WEDDING_TRADITIONS_GUIDE[ceremonyType as TraditionGuideKey];
  const anyRows = data.traditions.length > 0;
  return (
    <Section title="What to expect">
      {/* Kept on purpose (a sentence that earned its keep): these items go
          live to couples with no deploy, and several religions are still
          unvalidated. */}
      <p className="text-sm text-ink" data-starter-warning="">
        ⚠ This is starter content; validate each religion’s specifics with its clergy before relying on it — every
        save goes live to couples.
      </p>
      {items.length === 0 ? (
        <>
          {guide && guide.items.length > 0 ? (
            <ul className="space-y-1 text-sm text-ink" data-starter-items="">
              {guide.items.map((i) => (
                <li key={`${i.dimension}-${i.label}`}>
                  <span className="font-medium">{DIMENSION_LABEL[i.dimension] ?? i.dimension}</span> {i.label}
                </li>
              ))}
            </ul>
          ) : null}
          <form action={seedTraditionsFromDefaults}>
            <BackFields state={state} />
            <SubmitButton className={SAVE} pendingLabel="Loading…">
              Load starter content to edit it
            </SubmitButton>
          </form>
        </>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.item_id}>
              <ItemForm ceremonyType={ceremonyType} item={item} state={state} />
            </li>
          ))}
        </ul>
      )}
      <ItemForm ceremonyType={ceremonyType} item={null} state={state} />
      {anyRows ? (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-ink/70">Reset every religion to the latest starter content…</summary>
          <form action={resetTraditionsToDefaults} className="mt-2">
            <BackFields state={state} />
            <SubmitButton className="rounded-full border border-danger-300 px-3 py-1.5 text-xs font-semibold text-danger-700" pendingLabel="Resetting…">
              Reset all — discards every edit
            </SubmitButton>
          </form>
        </details>
      ) : null}
    </Section>
  );
}

function ItemForm({ ceremonyType, item, state }: { ceremonyType: string; item: TraditionRow | null; state: BackState }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl p-2" data-tradition-item={item ? 'saved' : 'new'}>
      <form action={upsertTraditionItem} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <BackFields state={state} />
        {item ? <input type="hidden" name="item_id" value={item.item_id} /> : null}
        <input type="hidden" name="ceremony_type" value={ceremonyType} />
        <FieldPick label="Dimension" name="dimension" defaultValue={item?.dimension ?? 'officiant'} choices={DIMENSIONS} />
        <input name="label" required maxLength={120} defaultValue={item?.label ?? ''} placeholder="e.g. Catholic priest" aria-label="Label" className={`${INPUT} w-40`} />
        <input name="note" maxLength={400} defaultValue={item?.note ?? ''} placeholder="One line" aria-label="Note" className={`${INPUT} flex-1`} />
        <input type="number" name="sort_order" defaultValue={item?.sort_order ?? 999} aria-label="Order" className={`${INPUT} w-16`} />
        <label className="flex items-center gap-1 text-xs text-ink">
          <input type="checkbox" name="is_active" value="true" defaultChecked={item?.is_active ?? true} className="h-4 w-4 accent-terracotta" />
          Shown
        </label>
        {/* Unticked posts "false": the action reads the FIRST is_active, and an
            unticked box posts nothing — so before this, an item could never be
            hidden (the action defaulted a missing value to true). */}
        <input type="hidden" name="is_active" value="false" />
        <SubmitButton className={SAVE} pendingLabel="Saving…" overlay={false}>
          {item ? 'Save' : 'Add item'}
        </SubmitButton>
      </form>
      {item ? (
        <form action={deleteTraditionItem}>
          <BackFields state={state} />
          <input type="hidden" name="item_id" value={item.item_id} />
          <SubmitButton className="text-xs font-medium text-ink/70 underline" pendingLabel="…" overlay={false}>
            Remove
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
