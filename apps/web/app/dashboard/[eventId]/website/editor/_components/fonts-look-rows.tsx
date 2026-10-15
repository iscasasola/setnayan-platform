'use client';

/**
 * 🔤 STUDIO › LOOK › ELEMENTS › FONTS — Fonts ▾ and four rows: Names · Headings · Text · Labels & buttons.
 *
 * Owner, 2026-10-08, round 5 (DECISION_LOG "LOOK ROUNDS 4–5"; prototype frames B06 · B06b): *"i think there are more
 * than just 2 types of fonts to edit"*. Each row is ONE dropdown that opens its choices (the shipped `FontPick`:
 * every face named in its own face, Recently used · Most used · All fonts); **Fonts ▾** is the fast path — a shipped
 * pairing fills all four, and reads "Your own mix" once a row is changed alone.
 *
 * control → kind (`INTERACTION_RULES.md` § 9): each row → Form row (name left, the Dropdown right, ⓘ beside the
 * first name); the five ▾ → Dropdown. No pill row, no card, no Save button.
 *
 * ⚡ ONE PICK = ONE DRAFT WRITE, HELD (`makerRedrawSave`): no whole-Maker render; the sample screen wears the pick at
 * the tap (`tellLookSample`), and the hidden page redraws itself once, when it is next shown. Guests see nothing
 * until ✓ Apply. Opening a ▾ writes nothing. A refused save puts the rows AND the sample back, and says so.
 *
 * Loaded lazily with the Look panel (`pro-panels.tsx` draws it for the Studio's Font part) — never in the Maker's
 * first load.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  FONT_PAIRING_MIXED,
  FONT_ROWS,
  FONT_ROWS_INFO,
  FONT_ROW_LABEL,
  FONT_ROW_LEAD,
  fontChoiceOf,
  fontChoiceWrite,
  fontPairingOf,
  fontPairings,
  type FontChoice,
  type FontRow,
} from '@/lib/font-pairings';
import { sanitizeHubFontKey } from '@/lib/hub-fonts';
import type { InviteThemeId } from '@/lib/invite-themes';
import { readLookSampleInks, readLookSampleWorn, subscribeLookSampleInks, subscribeLookSampleWorn, tellLookSample, type LookSampleInks } from '@/lib/look-sample-store';
import { HUB_DRAFT_BAR_FIELD, makerRedrawSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { STUDIO_ROW_PICK } from '@/lib/studio-skin';
import { hubDraftAction } from '../../hub-draft-actions';
import { BgRow } from './background-cards';
import { FontPick } from './font-pick';
import { PickMenu } from './pick-menu';

const MIXED = 'mixed';

/**
 * 🔤 THE LINE EACH FACE IS SHOWN WITH IN ITS DROPDOWN (owner 2026-10-14, Maker test item 4: *"font needs to show
 * their look on their dropdown preview texts before showing on the preview screen"*): the words that row sets —
 * the couple's own names for Names (as the sample screen has them), a heading, a line of details, a label.
 */
export const FONT_ROW_SAMPLE: Readonly<Record<Exclude<FontRow, 'names'>, string>> = {
  heading: 'Our day',
  body: 'The ceremony begins at four',
  highlight: 'Reply · Directions',
};
const NAMES_SAMPLE = 'Your names';


export function FontsLookRows({
  eventId,
  themeId,
  fontKey,
  roles,
  draftAction = hubDraftAction,
}: {
  eventId: string;
  /** The theme the page wears — its own pairing is "nothing chosen". */
  themeId: InviteThemeId;
  /** `events.site_font_key`, the draft over live — the Names font. */
  fontKey: string | null;
  /** `events.site_roles`, the draft over live — the other three. */
  roles: unknown;
  /** The draft door — the dev lab hands its own stand-in so no write leaves it. */
  draftAction?: typeof hubDraftAction;
}) {
  const fromProps = (): FontChoice => fontChoiceOf(sanitizeHubFontKey(fontKey), roles);
  const [choice, setChoice] = useState<FontChoice>(fromProps);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef<FontChoice>(choice);
  const rolesKey = JSON.stringify(roles ?? null);
  /* A Maker refresh (Undo, Restore, another save) hands in what the draft now holds — follow it. Reading writes nothing. */
  useEffect(() => {
    const next = fromProps();
    saved.current = next;
    setChoice(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `rolesKey` is the roles by content
  }, [fontKey, rolesKey]);

  /** 🪟 The sample screen wears it at the tap — drawn in the browser, no request. */
  const show = (c: FontChoice) => {
    const w = fontChoiceWrite(c);
    tellLookSample(eventId, { fontKey: w.site_font_key, roles: w.site_roles });
  };
  const lastTap = useRef(0);
  const commit = (next: FontChoice) => {
    const write = fontChoiceWrite(next);
    if (JSON.stringify(write) === JSON.stringify(fontChoiceWrite(choice))) return;
    const tap = ++lastTap.current;
    setChoice(next);
    setError(null);
    show(next);
    void (async () => {
      let ok = false;
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: write }));
        fd.set(HUB_DRAFT_BAR_FIELD, '1');
        const r = await makerRedrawSave(() => draftAction(eventId, fd), requestMakerRefresh);
        ok = r.ok === true;
      } catch {
        ok = false;
      }
      if (ok) {
        saved.current = next;
        return;
      }
      if (tap !== lastTap.current) return; // a newer pick took over
      setChoice(saved.current);
      show(saved.current);
      setError('Your font was not saved. Please try again.');
    })();
  };

  const pairings = fontPairings(themeId);
  const pairing = fontPairingOf(themeId, choice);
  /* The couple's names as the sample screen draws them (`look-sample.tsx` says them once it is up) — never sample words. */
  const names = useSyncExternalStore(subscribeLookSampleWorn, () => readLookSampleWorn(eventId)?.names ?? null, () => null);
  const sampleOf = (row: FontRow) => (row === 'names' ? (names?.trim() || NAMES_SAMPLE) : FONT_ROW_SAMPLE[row]);
  /* 🎨 The colour each type is drawn in, as the sample screen draws it — beside its name (owner 2026-10-14). */
  const inks = useSyncExternalStore(subscribeLookSampleInks, () => readLookSampleInks(eventId), () => null);
  return (
    <div data-fonts-look="" className="flex flex-col">
      {/* THE FAST PATH — a shipped pairing fills all four rows; "Your own mix" once a row was changed alone. */}
      <BgRow label="Fonts" data="fonts-pairing" info={FONT_ROWS_INFO}>
        <PickMenu
          label="Font pairing"
          dataAttr="data-fonts-pairing-pick"
          className={STUDIO_ROW_PICK}
          value={pairing ?? MIXED}
          options={[
            ...(pairing ? [] : [{ key: MIXED, label: FONT_PAIRING_MIXED, disabledNote: 'what you have now' }]),
            /* 🔤 Each pairing drawn in its own Names face (`FontPairing.face`) — its look before it is picked. */
            ...pairings.map((p) => ({ key: p.id, label: p.name, hint: p.faces, ...(p.face ? { fontFamily: p.face } : {}) })),
          ]}
          onPick={(k) => {
            const picked = pairings.find((p) => p.id === k);
            if (picked) commit(picked.choice);
          }}
        />
      </BgRow>
      {FONT_ROWS.map((row: FontRow) => (
        <BgRow key={row} label={FONT_ROW_LABEL[row]} data={`font-${row}`} mark={<TypeColour row={row} inks={inks} />}>
          <FontPick
            eventId={eventId}
            label={`${FONT_ROW_LABEL[row]} font`}
            dataAttr={`data-font-row-${row}`}
            value={choice[row]}
            lead={FONT_ROW_LEAD[row]}
            sample={sampleOf(row)}
            className={STUDIO_ROW_PICK}
            onPick={(key) => commit({ ...choice, [row]: key })}
          />
        </BgRow>
      ))}
      {error ? (
        <p role="alert" data-fonts-error="" className="pt-2 text-[12.5px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 🎨 THE TYPE'S COLOUR, BESIDE ITS NAME (owner 2026-10-14, Maker test item 4: *"return the type name to show color as
 * well"* — the approved role rows drew each type's swatch beside its name, `look-restudy-built-2026-10-08/09-el`). The
 * colour is the one the sample screen's words of that type are drawn in (`LookSampleInks`), so it moves with every
 * pick of the five, a picture's tint and a dark shade. Nothing is drawn until the sample has said it — never a guess.
 */
export function TypeColour({ row, inks }: { row: FontRow; inks: LookSampleInks | null }) {
  const hex = inks?.[row] ?? null;
  if (!hex) return null;
  return (
    <span
      data-font-row-colour={row}
      data-colour={hex}
      role="img"
      aria-label={`${FONT_ROW_LABEL[row]} colour ${hex}`}
      className="h-4 w-4 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
      style={{ backgroundColor: hex }}
    />
  );
}
