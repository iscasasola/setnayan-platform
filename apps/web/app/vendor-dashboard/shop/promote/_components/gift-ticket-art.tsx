/**
 * 🎟 A GIFT'S TICKET — the SHIPPED reward-ticket picture (`app/_components/award/ticket-svg.ts`, #7752, the approved
 * `badge-milestones_v86` voucher) drawn for a gift on sale, so Your gifts, its sheet and the store print the same ticket
 * the badge rewards do (prototype `gifts-interactive` v16 uses that art).
 *
 * Which ticket: an unlock by its kind (Event Plus · Pro · Ultra); a Papic pack by the credits its catalogue row carries
 * (150 · 1000 · 3000) — a pack size added later prints the Papic ticket with its own number, never a wrong one.
 * PURE + presentational. No request.
 */
import { TICKET_H, TICKET_SPECS, TICKET_W, ticketDataUri, type TicketSpec } from '@/app/_components/award/ticket-svg';
import type { ShopGiftPack } from '@/lib/shop-gifts';

export function giftTicket(pack: Pick<ShopGiftPack, 'kind' | 'credits'>): { id: string; spec: TicketSpec } {
  if (pack.kind === 'event_plus') return { id: 'eplus', spec: TICKET_SPECS.eplus };
  if (pack.kind === 'event_pro') return { id: 'epro', spec: TICKET_SPECS.epro };
  if (pack.kind === 'event_ultra') return { id: 'eultra', spec: TICKET_SPECS.eultra };
  const n = String(pack.credits);
  const known = (Object.entries(TICKET_SPECS) as Array<[string, TicketSpec]>).find(([, s]) => s.w === 'PAPIC' && s.n === n);
  return known ? { id: known[0], spec: known[1] } : { id: `papic${n}`, spec: { ...TICKET_SPECS.papic1000, n } };
}

export function GiftTicketArt({
  pack,
  className,
  width,
}: {
  pack: Pick<ShopGiftPack, 'kind' | 'credits'>;
  className?: string;
  width?: number;
}) {
  const t = giftTicket(pack);
  return (
    // a generated data: URI drawn on the device — next/image has nothing to optimise here
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ticketDataUri(t.id, t.spec)}
      alt=""
      width={width ?? TICKET_W}
      height={width ? Math.round((width * TICKET_H) / TICKET_W) : TICKET_H}
      decoding="async"
      draggable={false}
      className={className}
    />
  );
}

/**
 * The "10 + 1" pile (prototype `pile`): ten tickets fanned behind, the eleventh on top marked FREE. Purely a drawing —
 * the count it means is the bundle's own (`bundle_quantity`), said in words beside it.
 */
export function GiftTicketPile({
  pack,
  label,
  width = 96,
}: {
  pack: Pick<ShopGiftPack, 'kind' | 'credits'>;
  /** The bundle's shape in words (`bundleShape(b).label`, e.g. "10 + 1") — never typed here. */
  label: string;
  width?: number;
}) {
  const h = Math.round((width * TICKET_H) / TICKET_W);
  return (
    <span className="relative block flex-none" style={{ width, height: h + 14 }} aria-hidden data-gift-pile="">
      {[3, 2, 1].map((i) => (
        <span key={i} className="absolute left-0 top-0" style={{ transform: `translate(${i * 3}px, ${i * 3}px)`, opacity: 0.55 + (3 - i) * 0.12 }}>
          <GiftTicketArt pack={pack} width={width} />
        </span>
      ))}
      <span className="absolute left-0 top-0">
        <GiftTicketArt pack={pack} width={width} />
      </span>
      <b className="absolute -right-1 -top-1 rounded-full bg-success-700 px-1.5 py-0.5 text-[9.5px] font-extrabold leading-none tracking-wide text-white">
        FREE
      </b>
      <em className="absolute bottom-0 left-0 right-0 text-center text-[10.5px] font-bold not-italic text-ink/70">{label}</em>
    </span>
  );
}
