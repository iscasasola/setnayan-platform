import { Gift, Plus, Lock, ImageIcon, CheckCircle2 } from 'lucide-react';
import { ServiceFace } from '@/app/_components/service-face';
import { php, type Snapshot } from '@/lib/service-card-snapshot';
import { SetnayanGiftLine } from '@/app/_components/setnayan-gift-line';
import { FramedImg } from '@/app/_components/framed-img';

/**
 * service-card-face.tsx — the card a couple sees, drawn from a `Snapshot`.
 *
 * ── WHY IT IS ITS OWN COMPONENT (owner, 2026-09-08) ────────────────────────
 * *"we want to show the actual service cards."* This markup used to live inside
 * `ServiceCardLivePreview`, which reads a live `<form>` — so the only place a
 * vendor could see their real card was INSIDE the collapsed "Edit details"
 * editor. The list showed a grey wrench glyph and one line of text.
 *
 * Splitting the drawing from the reading lets the LIST render the same card
 * from stored values while the EDITOR keeps mirroring the form as you type.
 * Two renderers would have been the obvious move and the wrong one: the card is
 * a promise about what a couple sees, and two of them drift.
 *
 * Purely presentational — no state, no effects, no form access. It renders no
 * inputs, so mounting it inside a form adds nothing to the submitted payload.
 *
 * ── 2026-09-09 · IT ALSO DRAWS THE CARD OFFERED INSIDE A CONVERSATION ──────
 * When a supplier offers a service in chat the couple now receives THIS card,
 * not a word in a chip row (`chat-offered-service-card.tsx`). Same reasoning as
 * the split above and it is the reason `footer` exists: the preview's
 * "Request a quote" chip is a DRAWING of a button, and a drawing of a button
 * inside a real conversation is a control a couple will press and that does
 * nothing. The thread passes its own footer; every other caller omits the prop
 * and keeps the preview chip exactly as it was.
 */
export function ServiceCardFace({
  snap,
  leafPathLabel,
  addonsFromPhp,
  coverUrl,
  footer,
  packLine = null,
}: {
  snap: Snapshot;
  /** "Leaf · Parent" context line under the name (server-resolved). */
  leafPathLabel: string;
  /** Cheapest PAID add-on (server-known; the AddonsEditor manages its own forms). */
  addonsFromPhp?: number | null;
  /** Presigned/public URL of the current cover, when there is one. */
  coverUrl?: string | null;
  /**
   * Replaces the preview's mock "Request a quote" chip. OMIT it (undefined) to
   * keep that chip — `null` is a real value here and renders no footer at all,
   * which is what a surface with no action to offer passes.
   */
  footer?: React.ReactNode;
  /**
   * 🎁 One of the shop's OWN gift packs on this card, as the couple reads it ("Gift from … 🎁 · Event Plus",
   * `coupleCardPackLine`) — drawn where the Setnayan gift line is, never beside it (a card gives one gift).
   */
  packLine?: string | null;
}) {
  // THE ONE FACE (`app/_components/service-face.tsx`, owner 12 Nov "ONE SERVICE CARD, EVERYWHERE"). This file only
  // maps the maker's Snapshot in; it draws nothing of its own.
  const cover = coverUrl ? (
    // The 80×112 cover (5:7), derived from the photo's saved framing (Photo Frame Template).
    <FramedImg src={coverUrl} aspect={80 / 112} />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-[var(--m-orange-4)] text-[var(--m-orange-deep)]">
      {snap.hasCover ? (
        <CheckCircle2 aria-hidden className="h-6 w-6" strokeWidth={1.5} />
      ) : (
        <ImageIcon aria-hidden className="h-6 w-6" strokeWidth={1.5} />
      )}
    </span>
  );
  /*
    ⚖ TWO PROMISES, NEVER MERGED INTO ONE LINE.

    `givesSetnayanGift` is the yes/no the supplier answers about the
    SETNAYAN gift — Papic credits, sized at 40% of the booking fee and
    charged to them (owner 2026-09-09). `hasExclusive` is the retired
    free-text field, which two live cards still promise through: "Free
    1-hour extension for Setnayan couples" and "FREE". Those are the
    SUPPLIER'S own words about their OWN service and cost Setnayan nothing.

    Rendering one line for both would either bill two suppliers for a gift
    they never chose, or print the supplier's private wording as if we sized
    it. They stay two branches, and the gift wins when a card somehow has
    both, because it is the one Setnayan stands behind.

    🔒 NO NUMBER HERE, EVER. The photo count is a function of the agreed
    price, which does not exist while a card is being advertised — a figure
    printed here could be broken by a lower quote and honouring it would
    breach the 40% ceiling. The count belongs on the QUOTE (owner: "papic
    credits will be auto computed based on what they pay"). Any future edit
    that puts a quantity on this line is a bug, not an improvement.
  */
  const gift = snap.givesSetnayanGift ? (
    <SetnayanGiftLine
      className="flex items-center gap-1 text-[10.5px]"
      style={{ color: 'var(--m-orange-2)' }}
    />
  ) : packLine ? (
    <p className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--m-orange-2)' }} data-card-gift-pack="">
      <Gift aria-hidden className="h-3 w-3 shrink-0" strokeWidth={1.75} />
      <span>{packLine}</span>
    </p>
  ) : snap.hasExclusive ? (
    <p className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--m-orange-2)' }}>
      <Lock aria-hidden className="h-3 w-3" strokeWidth={1.75} />
      Setnayan Exclusive inside · opens in chat
    </p>
  ) : null;
  return (
    <ServiceFace
      name={snap.name}
      cover={cover}
      discount={snap.discountBadge}
      path={leafPathLabel || null}
      price={snap.priceText}
      includes={snap.includesLine}
      extra={
        addonsFromPhp != null ? (
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
            <Plus aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Add-ons from +{php(addonsFromPhp)}
          </span>
        ) : null
      }
      notIncluded={snap.notIncluded}
      gift={gift}
      footer={
        footer === undefined ? (
          <p className="flex items-center gap-2">
            <span
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium"
              style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
            >
              Request a quote
            </span>
            <span className="text-[10px]" style={{ color: 'var(--m-slate-3)' }}>
              final price by quote
            </span>
          </p>
        ) : (
          footer
        )
      }
    />
  );
}
