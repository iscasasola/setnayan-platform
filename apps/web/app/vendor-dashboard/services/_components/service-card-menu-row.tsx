'use client';

/**
 * 🃏 THE ONE MENU ROW UNDER A SERVICE CARD — Edit · Share · Go online (owner 10 Nov, DECISION_LOG "SHOP › SERVICES: THE
 * CARD, THEN ONE MENU ROW UNDER IT — EDIT · SHARE · GO ONLINE", verbatim: *"It is service card then a menu under to edit
 * share go online"*; Build 5 Lane C).
 *
 * The card shows FULL WIDTH; under it, ONE row of three equal-width ActionButtons (HOUSE_TEMPLATES T19, `EqualRow`).
 * It replaces what sat beside and under the card: the side copy icon (Duplicate now lives inside the Card Maker's
 * "Live · delete · copy" fold — "Start another from this"), the side Online/Offline switch, and the
 * "Edit · every field" row.
 *
 *   Edit       the Card Maker for this card — the same door the card face opens.
 *   Share      the card's own public address (`serviceCardAddress`, `?service=`) through the one share helper
 *              (`shareShopLink`: the phone's share sheet, else copy). WAITING while the card is offline — its link
 *              would land a couple on a shop page without the card — or while the shop has no address yet.
 *   Go online  the shipped `toggleVendorServiceActive` behind the SAME publish gate (`lib/service-publish-gate.ts`),
 *   Go offline saved in place (`StayForm`). A card the PLAN holds reads "On hold" and opens "Which services stay on"
 *              (the database refuses a held card live, so a working Go online there would be a lie).
 *
 * 🔁 THE REFUSAL GETS ITS OWN LINE UNDER THE ROW, never a fourth cell (the #7427 lesson: StayForm prints a refusal as
 * a SIBLING of its form, and a sibling inside a row crushes the row). So the form holds only its hidden fields and sits
 * AFTER the row; the Go online button reaches it with the `form` attribute, and StayForm's `[data-stay-error]` line
 * lands under the row. The refusal names EVERY missing thing at once (`publishRefusalFor`).
 *
 * 🔒 app/vendor-dashboard/services/the-card-menu-row-is-edit-share-go-online.test.ts
 */
import { useId, useState } from 'react';
import { Eye, EyeOff, Pause, Pencil, Share } from 'lucide-react';
import { ActionButton, EqualRow } from '@/components/action-button';
import { StayForm, type StaySave } from '@/app/_components/stay-form';
import { shareShopLink } from '@/lib/share-shop-link';
import { HOLD_WORDS } from '@/lib/service-plan-hold';

export type ServiceCardMenuRowProps = {
  vendorServiceId: string;
  /** The card's name, for the buttons' accessible names and the share sheet's title. */
  cardName: string;
  isActive: boolean;
  /** The PLAN holds this card (`readPlanHolds`) — no Go online; "On hold" opens "Which services stay on". */
  held: boolean;
  /** The Card Maker for this card. */
  editHref: string;
  /** The card's public path (`serviceCardAddress`), or null when the shop has no address yet. */
  sharePath: string | null;
  action: (fd: FormData) => unknown;
  /** The saver — `saveInPlace` itself, unless a lab hands in a stand-in. */
  save?: StaySave;
};

export function ServiceCardMenuRow({ vendorServiceId, cardName, isActive, held, editHref, sharePath, action, save }: ServiceCardMenuRowProps) {
  const formId = `card-online-${useId().replace(/:/g, '')}`;
  const [shareNote, setShareNote] = useState<string | null>(null);
  const shareWaits = !isActive || !sharePath;

  async function share() {
    if (!sharePath) return;
    setShareNote(null);
    const url = new URL(sharePath, window.location.origin).toString();
    const r = await shareShopLink(url, cardName);
    setShareNote(r === 'copied' ? 'Link copied.' : r === 'failed' ? 'Could not share the link. Try again.' : null);
  }

  return (
    <div className="space-y-2" data-card-menu={vendorServiceId}>
      {/* Edit is a link (40 px drawn) and the other two are buttons (44 px — the base `button` floor): one height for all
          three, so the row reads as one row of equal pills. */}
      <EqualRow data="card-menu" className="[&>.ab]:min-h-11">
        <ActionButton tone="neutral" icon={Pencil} label="Edit" name={`Edit ${cardName}`} href={editHref} data-card-edit={vendorServiceId} />
        <ActionButton
          tone="info"
          icon={Share}
          label="Share"
          name={shareWaits ? `Share ${cardName} — ${!sharePath ? 'your shop needs its address first' : 'go online first'}` : `Share ${cardName}`}
          waiting={shareWaits}
          onClick={share}
          data-card-share={vendorServiceId}
        />
        {held ? (
          <ActionButton
            tone="warn"
            icon={Pause}
            label={HOLD_WORDS.tag}
            name={`${HOLD_WORDS.tag} — ${HOLD_WORDS.door}`}
            href="#stay-on"
            data-plan-hold-tag=""
          />
        ) : (
          <ActionButton
            tone={isActive ? 'neutral' : 'ok'}
            main={!isActive}
            icon={isActive ? EyeOff : Eye}
            label={isActive ? 'Go offline' : 'Go online'}
            name={isActive ? `Go offline — hide ${cardName} from couples` : `Go online — show ${cardName} to couples`}
            type="submit"
            form={formId}
            data-card-online={isActive ? '1' : '0'}
          />
        )}
      </EqualRow>
      {held ? null : (
        <StayForm id={formId} door="svServices.toggleVendorServiceActive" action={action} save={save} className="hidden">
          <input type="hidden" name="vendor_service_id" value={vendorServiceId} />
          <input type="hidden" name="is_active" value={isActive ? 'false' : 'true'} />
        </StayForm>
      )}
      {shareNote ? (
        <p role="status" className="text-[12.5px] leading-snug text-ink/65" data-card-share-note="">
          {shareNote}
        </p>
      ) : null}
    </div>
  );
}
