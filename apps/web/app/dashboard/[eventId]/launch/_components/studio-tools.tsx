'use client';

import { useContext, useEffect, useId, useState, useTransition, type ReactNode } from 'react';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { EGIFT_KIND_META, type EgiftMethodKind } from '@/lib/egift-kinds';
import { PabuyaCardList } from '@/app/_components/pabuya/pabuya-card-list';
import { saveEgiftMethod, setEgiftMethodEnabled } from '../../pabuya/actions';
import type { ManagerMethod } from '../../pabuya/_components/pabuya-manager';
import { HUB_LIVE_WORDS } from '../../website/_components/hub-draft-field';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { setLaunchPhase, setOpenBrowse } from '../../website/editor/actions';
import { updateLandingPageVisibility } from '../../website/privacy/actions';
import { LaunchStdButton } from '../../studio/save-the-date/_components/launch-std-button';
import type { LaunchPhaseKey } from '../../website/editor/_components/launch-phase-choices';
import { MAKER_OPEN_RESET_EVENT } from '../../website/_components/maker-open-reset';
import { QrActions } from '@/app/_components/qr-actions';
import { MAKER_STAY_FIELD } from '@/lib/maker-stay';
import {
  WHICH_VERSION_LABEL,
  WHICH_VERSION_OPTIONS,
  isWhichVersion,
  whichVersionLabel,
  whichVersionNow,
  whichVersionWrites,
  type WhichVersion,
} from '@/lib/which-version-guests-see';
import { useMaker } from './maker-context';
import { TextPanel } from '../../website/editor/_components/text-panel';
import { updateWhatToBring } from '../../website/what-to-bring/actions';
import { DetailsSelectContext } from './details-go';
import { ISeg, ISegmented } from '../../website/editor/_components/inspector-kit';
import { LOOK_SECTION_ITEM_KEYS, type LookSectionItemKey } from '@/lib/maker-details-items';
import {
  STUDIO_GROUP,
  STUDIO_GROUP_HEAD,
  STUDIO_GROUP_HEAD_LINE,
  STUDIO_QUIET_BUTTON,
  STUDIO_QUIET_ROW,
  STUDIO_ROW,
  STUDIO_ROW_LABEL,
  STUDIO_ROW_PICK,
  STUDIO_SWITCH_TRACK,
} from '@/lib/studio-skin';

/**
 * 🧭 THE NEW MAKER'S STUDIO TOOLS, REDRAWN TO THE PROTOTYPE (owner 2026-10-06;
 * plan `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 4;
 * prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`
 * `infoForm` and the E-Gifts renderer). Drawn only while the new Maker is on
 * (`makerStagesStudioEnabled`, handed to `MakerDetails` as `studio`), and loaded
 * through `details-lazy.tsx` (the `maker-details` chunk) — never in the
 * Maker's first load.
 *
 * 🔑 NOTHING HERE IS A NEW WRITE. Every control posts through an action that
 * already ships (the E-Gifts page's own `saveEgiftMethod` /
 * `setEgiftMethodEnabled`), with the shipped fields; nothing is invented.
 */

/* ── shared bits ─────────────────────────────────────────────────────────── */

/** The prototype's group heading — a name and a small line beside it. */
export function StudioHeading({ title, line, data }: { title: string; line?: string; data?: string }) {
  return (
    <p data-studio-heading={data} className={STUDIO_GROUP_HEAD}>
      {title}
      {line ? <small className={STUDIO_GROUP_HEAD_LINE}>{line}</small> : null}
    </p>
  );
}

/** One switch row: the name on the left, the knob on the right — 44 px, the whole row a target. */
export function StudioSwitch({
  label,
  on,
  onChange,
  disabled = false,
  data,
}: {
  label: ReactNode;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  data?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} data-studio-switch={data} className="flex min-h-[52px] cursor-pointer items-center justify-between gap-2.5 py-1">
      <span className="min-w-0 text-[14.5px] font-semibold text-ink">{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span aria-hidden className={STUDIO_SWITCH_TRACK} />
    </label>
  );
}

/**
 * 📍 A FACT SET ELSEWHERE, SHOWN READ-ONLY (owner 2026-10-06, DECISION_LOG
 * "DATE AND VENUE LIVE IN SUPPLIERS, NOT IN 'YOUR EVENT'"): the value as guests
 * read it, and where it is set. No field — nothing here can change it.
 */
export function StudioReadOnlyFact({ label, value, line, data }: { label?: string; value: string | null; line: string; data: string }) {
  return (
    <div data-studio-read-only={data} className="flex min-h-11 flex-col gap-0.5 py-1">
      {label ? <span className="text-[14px] font-semibold text-ink">{label}</span> : null}
      <span className={`whitespace-pre-line text-[14px] ${value ? 'text-ink/80' : 'text-ink/50'}`}>{value ?? 'Not set yet'}</span>
      <small className="text-[12px] text-ink/55">{line}</small>
    </div>
  );
}

/* ── 🎁 E-GIFTS ──────────────────────────────────────────────────────────── */

/** The four ways to give the prototype draws, in its order — the shipped kinds (`lib/egift-kinds.ts`). */
export const STUDIO_GIFT_KINDS = ['gcash', 'maya', 'bank', 'paypal'] as const satisfies readonly EgiftMethodKind[];

type GiftRow = { id: string | null; on: boolean; handle: string; accountName: string };

function rowsFrom(methods: readonly ManagerMethod[]): Record<(typeof STUDIO_GIFT_KINDS)[number], GiftRow> {
  const out = {} as Record<(typeof STUDIO_GIFT_KINDS)[number], GiftRow>;
  for (const k of STUDIO_GIFT_KINDS) {
    /* The first of its kind — the one guests see first (the manager keeps any others). */
    const m = methods.find((x) => x.method_kind === k && x.is_enabled) ?? methods.find((x) => x.method_kind === k) ?? null;
    out[k] = { id: m?.egift_method_id ?? null, on: m?.is_enabled ?? false, handle: m?.handle ?? '', accountName: m?.account_name ?? '' };
  }
  return out;
}

/**
 * 🎁 STUDIO › E-GIFTS (prototype `EDITORS.gifts`): What guests see on top, then
 * one switch per way to give with its field under it, then the thank-you line
 * (handed in — the shipped `PabuyaMessageEditor`). Every write is the E-Gifts
 * page's own, LIVE as it has always been — and said so.
 *
 *  · switching a way ON that has no account yet opens its field; the account is
 *    created (`saveEgiftMethod`) the first time a number is typed and left;
 *  · switching it OFF hides it from guests (`setEgiftMethodEnabled`) — the
 *    manager's own Show / Hide, never a delete.
 */
export function StudioEgifts({
  eventId,
  methods,
  thanks,
}: {
  eventId: string;
  methods: readonly ManagerMethod[];
  /** The thank-you line's shipped editor (`PabuyaMessageEditor`) — absent where the form draws it as its own item. */
  thanks?: ReactNode;
}) {
  const [rows, setRows] = useState(() => rowsFrom(methods));
  /* A way created here comes back from the server with its id (the Maker re-reads after a create). */
  useEffect(() => {
    const fresh = rowsFrom(methods);
    setRows((r) => {
      let changed = false;
      const next = { ...r };
      for (const k of STUDIO_GIFT_KINDS) {
        if (!r[k].id && fresh[k].id) {
          next[k] = { ...r[k], id: fresh[k].id };
          changed = true;
        }
      }
      return changed ? next : r;
    });
  }, [methods]);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const fd = (fields: Record<string, string>) => {
    const f = new FormData();
    f.set('event_id', eventId);
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const toggle = (kind: (typeof STUDIO_GIFT_KINDS)[number], on: boolean) => {
    const before = rows[kind];
    setError(null);
    setRows((r) => ({ ...r, [kind]: { ...r[kind], on } }));
    if (!before.id) return; // nothing to show or hide until its account is typed
    start(async () => {
      const res = await makerSave(() => setEgiftMethodEnabled(fd({ egift_method_id: before.id!, is_enabled: on ? 'true' : 'false' })), requestMakerRefresh);
      if (!res.ok) {
        setRows((r) => ({ ...r, [kind]: before }));
        setError(res.error);
      }
    });
  };
  const saveHandle = (kind: (typeof STUDIO_GIFT_KINDS)[number]) => {
    const row = rows[kind];
    const original = methods.find((m) => m.egift_method_id === row.id) ?? null;
    if (original && (original.handle ?? '') === row.handle.trim() && (original.account_name ?? '') === row.accountName.trim()) return;
    if (!original && row.handle.trim() === '') return;
    setError(null);
    start(async () => {
      const res = await makerSave(() => saveEgiftMethod(
        fd({
          ...(original ? { egift_method_id: original.egift_method_id } : {}),
          method_kind: kind,
          label: original?.label ?? EGIFT_KIND_META[kind].defaultLabel,
          account_name: row.accountName,
          handle: row.handle,
          note: original?.note ?? '',
          qr_r2_key: original?.qr_r2_key ?? '',
        }),
      ), requestMakerRefresh);
      if (!res.ok) setError(res.error);
    });
  };
  const seen = STUDIO_GIFT_KINDS.filter((k) => rows[k].on && rows[k].handle.trim()).map((k) => ({
    kind: k,
    label: methods.find((m) => m.egift_method_id === rows[k].id)?.label ?? EGIFT_KIND_META[k].defaultLabel,
    accountName: rows[k].accountName.trim() || null,
    handle: rows[k].handle.trim() || null,
    note: null,
    qrUrl: methods.find((m) => m.egift_method_id === rows[k].id)?.qrDisplayUrl ?? null,
  }));
  return (
    <div data-studio-egifts="" className="flex flex-col">
      <StudioHeading title="What guests see" data="egifts-preview" />
      <div data-studio-egifts-preview="" className="pointer-events-none">
        <PabuyaCardList methods={seen} emptyHint="Switch on a way to give below" />
      </div>
      <StudioHeading title="Ways to give" line="switch on what you have" />
      <div className={STUDIO_GROUP}>
        {STUDIO_GIFT_KINDS.map((k) => {
          const meta = EGIFT_KIND_META[k];
          const row = rows[k];
          return (
            <div key={k} data-studio-gift={k} className="flex flex-col border-t border-ink/10 first:border-t-0">
              <StudioSwitch label={meta.defaultLabel} on={row.on} onChange={(v) => toggle(k, v)} data={`gift-${k}`} />
              {row.on ? (
                <div className="flex flex-col gap-2 pb-3">
                  <input
                    value={row.handle}
                    onChange={(e) => setRows((r) => ({ ...r, [k]: { ...r[k], handle: e.target.value } }))}
                    onBlur={() => saveHandle(k)}
                    maxLength={200}
                    aria-label={meta.handleLabel}
                    placeholder={meta.handlePlaceholder}
                    className="min-h-11 rounded-md border border-ink/10 px-3 text-[14px] text-ink"
                  />
                  <input
                    value={row.accountName}
                    onChange={(e) => setRows((r) => ({ ...r, [k]: { ...r[k], accountName: e.target.value } }))}
                    onBlur={() => saveHandle(k)}
                    maxLength={80}
                    aria-label="Name on the account"
                    placeholder="Name on the account"
                    className="min-h-11 rounded-md border border-ink/10 px-3 text-[14px] text-ink"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {thanks ? (
        <>
          <StudioHeading title="What it says" />
          <div data-studio-egifts-thanks="" className={`${STUDIO_GROUP} py-3`}>
            {thanks}
          </div>
        </>
      ) : null}
      <p className="px-1.5 pt-1 text-center text-[12px] text-ink/50">{HUB_LIVE_WORDS}</p>
      {error ? (
        <p role="alert" className="pt-2 text-[13px] text-terracotta-700">
          {error} Nothing else was changed.
        </p>
      ) : null}
    </div>
  );
}

/* ── 🌐 INFO › YOUR EVENT HUB ────────────────────────────────────────────── */

/** What Your Event Hub's rows read — null when the read failed (said, never a guessed "Private"). */
export type StudioHubFacts = {
  visibility: 'public' | 'unlisted' | 'private';
  /** The pinned phase (`manualLaunchPhase`), null = Automatic. */
  pinned: LaunchPhaseKey | null;
  openBrowse: boolean;
  launched: boolean;
  scheduledAt: string | null;
};

/** Who can view — the shipped three, in the shipped words (`VisibilityPanel`). */
const WHO_CAN_VIEW = [
  { key: 'private', label: 'Private', hint: 'Only your hosts and your guests.' },
  { key: 'unlisted', label: 'Unlisted', hint: 'Anyone with the link — not listed publicly.' },
  { key: 'public', label: 'Public', hint: 'Anyone can find and open it. Turns on “Accept” — people can ask to join.' },
] as const;

/** A shipped Maker form's own landing: back on the address the couple is on (`lib/maker-stay.ts`). */
function stayForm(eventId: string, fields: Record<string, string>): FormData {
  const f = new FormData();
  f.set('event_id', eventId);
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  f.set('return_to', `${window.location.pathname}${window.location.search}`);
  f.set(MAKER_STAY_FIELD, '1');
  return f;
}

/** One row of the form: the name on the left, the control on the right. */
function HubRow({ label, children, data }: { label: string; children: ReactNode; data: string }) {
  return (
    <div data-studio-hub-row={data} className={`${STUDIO_ROW} flex-wrap`}>
      <span className={`${STUDIO_ROW_LABEL} text-[14px] text-ink`}>{label}</span>
      {children}
    </div>
  );
}

/**
 * 🌐 YOUR EVENT HUB (prototype `infoForm` › "Your Event Hub"): Go live ▾ · Who can
 * view ▾ · Which version guests see ▾ · the Event Bar. Each is the SHIPPED
 * control's write — live, and said so (`HubSavesImmediately`):
 *   · Go live            → `LaunchStdButton` (the ⋯ sheet's own);
 *   · Who can view ▾     → `updateLandingPageVisibility`;
 *   · Which version ▾    → `setLaunchPhase` + `setOpenBrowse` — "All of them" is
 *     open browsing, ONE control (`lib/which-version-guests-see.ts`);
 *   · Event Bar          → the switch the work area registered (`MakerEventBar`).
 */
export function StudioHubSettings({ eventId, slug, hub }: { eventId: string; slug: string | null; hub: StudioHubFacts | null }) {
  const maker = useMaker();
  const [who, setWho] = useState(hub?.visibility ?? 'private');
  const [version, setVersion] = useState<WhichVersion>(() => (hub ? whichVersionNow(hub) : 'auto'));
  const [open, setOpen] = useState(hub?.openBrowse ?? false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  if (!hub) {
    return (
      <p role="alert" className="text-[13px] text-terracotta-700" data-studio-hub-unread="">
        Your Event Hub settings could not be read just now. Nothing was changed — please reopen this in a moment.
      </p>
    );
  }
  const pickWho = (next: string) => {
    if (next === who || !WHO_CAN_VIEW.some((w) => w.key === next)) return;
    const before = who;
    setWho(next as typeof who);
    setError(null);
    start(async () => {
      try {
        await makerSave(() => updateLandingPageVisibility(stayForm(eventId, { visibility: next })), requestMakerRefresh, { ok: () => true });
      } catch {
        setWho(before);
        setError('“Who can view” did not save, so it is back as it was. Please try again.');
      }
    });
  };
  const pickVersion = (next: string) => {
    if (!isWhichVersion(next) || next === version) return;
    const before = { version, open };
    const writes = whichVersionWrites(next, { openBrowse: open });
    setVersion(next);
    setOpen(next === 'all');
    setError(null);
    start(async () => {
      try {
        if (writes.openBrowse !== null) await makerSave(() => setOpenBrowse(stayForm(eventId, { open_browse: writes.openBrowse! })), requestMakerRefresh, { ok: () => true });
        // Last: it lands back on this address (its redirect), with both columns written.
        await makerSave(() => setLaunchPhase(stayForm(eventId, { launch_phase: writes.launchPhase })), requestMakerRefresh, { ok: () => true });
      } catch (e) {
        /* A redirect is how a shipped action says "done" — it is not a failure. */
        if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
        setVersion(before.version);
        setOpen(before.open);
        setError(`“${WHICH_VERSION_LABEL}” did not save, so it is back as it was. Please try again.`);
      }
    });
  };
  return (
    <div data-studio-hub="" className="flex flex-col">
      {/* "Guests see this right away" is said once, by the address right above (its own `HubSavesImmediately`). */}
      <HubRow label="Go live" data="go-live">
        <LaunchStdButton eventId={eventId} slug={slug} initialLaunched={hub.launched} initialScheduledAt={hub.scheduledAt} />
      </HubRow>
      <HubRow label="Who can view" data="who-can-view">
        <PickMenu
          label="Who can view"
          dataAttr="data-studio-who-pick"
          value={who}
          buttonText={WHO_CAN_VIEW.find((w) => w.key === who)?.label ?? 'Private'}
          options={WHO_CAN_VIEW}
          onPick={pickWho}
          className={STUDIO_ROW_PICK}
        />
      </HubRow>
      <HubRow label={WHICH_VERSION_LABEL} data="which-version">
        <PickMenu
          label={WHICH_VERSION_LABEL}
          dataAttr="data-studio-version-pick"
          value={version}
          buttonText={whichVersionLabel(version)}
          options={WHICH_VERSION_OPTIONS}
          onPick={pickVersion}
          className={STUDIO_ROW_PICK}
        />
      </HubRow>
      {maker?.eventBar ? (
        <div className="border-t border-ink/10">
          <StudioSwitch label="Event Bar" on={maker.eventBar.on} onChange={() => maker.eventBar?.toggle()} data="event-bar" />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The QR's Copy · Share · Download — the shipped buttons (`QrActions`), on the live address. */
export function StudioQrActions({ slug, path }: { slug: string | null; path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(path ? new URL(path, window.location.origin).toString() : null);
  }, [path]);
  if (!slug || !url) return null;
  return (
    <QrActions
      url={url}
      download={{ href: `/api/website/qr/${encodeURIComponent(slug)}`, filename: 'setnayan-event-qr.png' }}
      className="flex flex-wrap gap-1.5 pt-2"
    />
  );
}

/**
 * The form's quiet rows at the very bottom (prototype `infoForm`): Restore · drop
 * the draft (the draft bar's own Restore) · Reset… (the draft bar's ONE confirm,
 * `MAKER_OPEN_RESET_EVENT`) · About. Settings had them in the shipped Maker's
 * lower third; the new Maker's phone frame has no Settings, so they live here.
 */
export function StudioQuietRows() {
  const maker = useMaker();
  const draft = maker?.draft ?? null;
  const quiet = STUDIO_QUIET_ROW;
  return (
    <div data-studio-quiet="" className="mt-4 flex flex-col">
      {draft ? (
        <div className={quiet} data-studio-quiet-row="restore">
          <span>
            <b className="font-semibold text-ink/70">Restore</b> · back to what guests see now
          </span>
          <button
            type="button"
            disabled={!draft.canRestore}
            onClick={() => draft.canRestore && draft.restore()}
            className={STUDIO_QUIET_BUTTON}
          >
            Restore
          </button>
        </div>
      ) : null}
      {draft ? (
      <div className={quiet} data-studio-quiet-row="reset">
        <span>
          <b className="font-semibold text-ink/70">Reset</b> · start this stage over
        </span>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(MAKER_OPEN_RESET_EVENT))}
          className={`${STUDIO_QUIET_BUTTON} !bg-terracotta-700/10 !text-terracotta-700 !ring-terracotta-700/25`}
        >
          Reset…
        </button>
      </div>
      ) : null}
      <div className={quiet} data-studio-quiet-row="about">
        <span>
          <b className="font-semibold text-ink/70">About</b> · Made with Setnayan
        </span>
      </div>
    </div>
  );
}

/* ── 🌄 STUDIO › LOOK ────────────────────────────────────────────────────── */

/** The four, in the owner's words (DECISION_LOG 2026-10-06 "STUDIO › LOOK IS THE GLOBAL LOOK"). */
export const STUDIO_LOOK_LABEL: Readonly<Record<LookSectionItemKey, string>> = {
  background: 'Background',
  colours: 'Colours',
  font: 'Fonts',
  music: 'Music',
};

/** Said once, at the top of Background (the owner: *"explain that this is the main background"*). */
export const STUDIO_MAIN_BACKGROUND_LINE =
  'The main background — behind every stage and every page, the cover included; a part’s own Background can still change just that part';

/**
 * 🌄 Look's ONE full-width bar — Background · Colours · Fonts · Music (sections =
 * one `ISegmented`, INTERACTION_RULES §8). A press opens that section's item —
 * the SAME Look editor Details draws (`LookPanel`), never a copy; opening
 * writes nothing. Background opens with the one line that says what it is.
 */
export function StudioLookBar({ item }: { item: LookSectionItemKey }) {
  const select = useContext(DetailsSelectContext);
  return (
    <div data-studio-look-bar={item} className="flex flex-col gap-2 pb-1">
      <ISegmented label="Look">
        {LOOK_SECTION_ITEM_KEYS.map((k) => (
          <ISeg key={k} on={k === item} data={k} onClick={() => k !== item && select?.(k)} className="!text-[13px]">
            {STUDIO_LOOK_LABEL[k]}
          </ISeg>
        ))}
      </ISegmented>
      {item === 'background' ? (
        <p data-studio-main-background-line="" className="text-[13px] leading-snug text-ink/70">
          <b className="font-semibold text-ink">The main background</b>
          {STUDIO_MAIN_BACKGROUND_LINE.slice('The main background'.length)}
        </p>
      ) : null}
    </div>
  );
}

/* ── ONE door for the lazy stand-in (`details-lazy.tsx` `StudioTool`) ────── */

/** ✍ What to bring — its own drafted column (`what_to_bring`), the Event Hub's Reminders box, in place. */
function StudioWhatToBring({ eventId, value }: { eventId: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-2 border-t border-ink/10 pt-4" data-studio-what-to-bring="">
      <TextPanel
        action={updateWhatToBring.bind(null, eventId)}
        eventId={eventId}
        rowKey="what-to-bring"
        name="note"
        label="What to bring"
        maxLength={600}
        placeholder="e.g. your invitation QR, a jacket for the garden"
        defaultValue={value ?? ''}
        previewKey="w:what_to_bring"
      />
    </div>
  );
}

export type StudioToolProps =
  | ({ part: 'hub' } & Parameters<typeof StudioHubSettings>[0])
  | ({ part: 'fact' } & Parameters<typeof StudioReadOnlyFact>[0])
  | ({ part: 'qr' } & Parameters<typeof StudioQrActions>[0])
  | { part: 'quiet' }
  | ({ part: 'gifts' } & Parameters<typeof StudioEgifts>[0])
  | ({ part: 'look' } & Parameters<typeof StudioLookBar>[0])
  | ({ part: 'bring' } & Parameters<typeof StudioWhatToBring>[0]);

export function StudioTool(props: StudioToolProps) {
  switch (props.part) {
    case 'hub':
      return <StudioHubSettings {...props} />;
    case 'fact':
      return <StudioReadOnlyFact {...props} />;
    case 'qr':
      return <StudioQrActions {...props} />;
    case 'quiet':
      return <StudioQuietRows />;
    case 'gifts':
      return <StudioEgifts {...props} />;
    case 'look':
      return <StudioLookBar {...props} />;
    case 'bring':
      return <StudioWhatToBring {...props} />;
  }
}
