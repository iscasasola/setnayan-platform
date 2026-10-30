'use client';

/**
 * 🔗🖼 "WHICH OF YOUR SERVICES IS THIS?" — the ONE dropdown every supplier inspiration upload sheet carries (owner
 * 2026-10-30, DECISION_LOG "A SUPPLIER'S INSPIRATION PHOTO IS CONNECTED FOUR WAYS …" item 1: "every supplier inspiration
 * upload picks which of the supplier's service cards it belongs to (one dropdown, only cards whose Service links that
 * Part)"). Mounted by the library upload, the "From events you worked" import and the Mood Board suggestion sheet.
 *
 *   · the choices are worked out on the SERVER per part (`shopCardChoices`) — this file imports no taxonomy;
 *   · exactly one card fits → it is preselected (the parent seeds `value` with `preselectedCard`);
 *   · none fits → no dropdown, one quiet line: the photo goes to the shop (card-optional, owner 2026-10-29);
 *   · the cards could not be read (`null`) → said, never drawn as "none fits";
 *   · the pick posts as `vendorServiceId` — '' for the shop only. The server re-checks it against the shop's own cards.
 *
 * The shipped PickMenu (house rule: any set of choices is ONE dropdown, never a pill row or a native select).
 */
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { NO_CARD_LABEL, WHICH_CARD_QUESTION, type CardChoice } from '@/lib/inspiration-card-link';

const NONE = '__shop__';

export function InspirationCardPick({
  choices,
  value,
  onChange,
  dataAttr = 'data-inspiration-card-pick',
  withHiddenField = true,
}: {
  /** This part's fitting cards; `[]` = none fits; `null` = the cards could not be read; `undefined` = not offered. */
  choices: CardChoice[] | null | undefined;
  /** The picked card id, or '' for the shop only. */
  value: string;
  onChange: (id: string) => void;
  dataAttr?: string;
  /** Post the pick as a hidden `vendorServiceId` field of the surrounding form (the library form). */
  withHiddenField?: boolean;
}) {
  if (choices === undefined) return null;
  const hidden = withHiddenField ? <input type="hidden" name="vendorServiceId" value={choices ? value : ''} /> : null;
  if (choices === null) {
    return (
      <div className="space-y-1" data-inspiration-card-unread="">
        {hidden}
        <p className="text-[12px] text-ink/65">We couldn’t load your service cards just now — this photo will go to your shop only.</p>
      </div>
    );
  }
  if (choices.length === 0) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3" data-inspiration-card-none="">
        {hidden}
        <span className="shrink-0 text-sm text-ink/65">Service</span>
        <span className="text-[13px] text-ink/60">Just your shop — no card offers this part yet</span>
      </div>
    );
  }
  const options: PickOption[] = [
    ...choices.map((c) => ({ key: c.id, label: c.priceLabel ? `${c.label} · ${c.priceLabel}` : c.label })),
    { key: NONE, label: NO_CARD_LABEL },
  ];
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      {hidden}
      <span className="shrink-0 text-sm text-ink/65">Service</span>
      <PickMenu
        label={WHICH_CARD_QUESTION}
        value={value || NONE}
        options={options}
        onPick={(k) => onChange(k === NONE ? '' : k)}
        dataAttr={dataAttr}
        className="!min-h-11"
      />
    </div>
  );
}
