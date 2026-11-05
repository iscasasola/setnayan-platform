/**
 * lib/supplier-card.ts — THE SUPPLIER'S DIGITAL CARD, laid out once.
 *
 * DECISION_LOG 2026-10-30 ("THE INVITE TEXTS — GUEST AND SELF-ADDED SUPPLIER — APPROVED; A SELF-ADDED SUPPLIER GETS A
 * SHARE BUTTON, AN AUTOMATIC CLAIM LINK AND A DIGITAL CARD"). Owner, verbatim: *"show me the digital card for supplier
 * import"* · *"a universal design for setnayan. Telling them about their shop name, contact person, service covered,
 * and the qr code"* · *"4:3 portrait"* · *"add the invited by: host inviting them, event, date"*.
 *
 * 📐 THE CONTRACT IS THE APPROVED PROTOTYPE, `prototypes/build-contracts-2026-10-30/supplier-digital-card/index.html`
 * (corpus). It is designed at 1080 × 1440 with every size in `cqw` (1 cqw = 10.8 px); each number below is that
 * prototype's, converted — `CQ(8.6)` is its `8.6cqw`. Nothing is re-drawn: SETNAYAN's paper, gold ring and type, the
 * shop name biggest, Contact · Covers, then Invited by · Event · Date, the QR on white, "Scan to join our event", and
 * the foot. A missing fact is LEFT OFF (never "TBA"); a long name steps down a size and wraps; services wrap as chips.
 *
 * ♻ DRAWN BY THE GUEST TICKET'S OWN ENGINE (RULE 0). The guest's Digital ticket is a `PrintDoc` (lib/print-layout.ts)
 * flattened to a 1080 × 1440 PNG by `renderPassCardPng` (lib/pass-card-render.ts). This card is a `PrintDoc` in the
 * same vocabulary, type drawn as outlines from the repo's own TrueType files (`drawText`), and flattened by that same
 * function — so no host font, no second rasteriser.
 *
 * 🔤 THE FACES: the prototype's Cormorant Garamond and Jost are both Event Hub faces with outline files in the repo
 * (`hub-cormorant`, `hub-jost` — public/logo-fonts). Each file holds ONE weight, so the prototype's 500/600 weights
 * draw at that weight.
 *
 * Pure (fonts are read with node:fs, which the test runner can do).
 */
import { drawText, measure, wrap, type PrintDoc, type PrintOp } from '@/lib/print-layout';
import type { PrintFontKey } from '@/lib/print-pieces';

/** The picture's size — the guest ticket's, 3 : 4 portrait. */
export const SUPPLIER_CARD_PX = { w: 1080, h: 1440 } as const;

/** What the card says. Every line but the shop's name may be absent, and is then left off. */
export type SupplierCardFacts = {
  shopName: string;
  contactPerson?: string | null;
  /** The row they were added under first, then the rows they also cover — each one chip. */
  services: string[];
  /** The hosts — `events.display_name`. */
  invitedBy?: string | null;
  /** "Wedding" — the event type's word, as a label. */
  eventLabel?: string | null;
  /** Already formatted ("Fri, Dec 18, 2026"), or null when the event has no day yet. */
  dateLabel?: string | null;
};

// ─── The prototype's tokens ────────────────────────────────────────────────
const PAPER = '#FBF7EF';
const INK = '#2C2A29';
const MUTE = '#857C70';
const GOLD = '#A9834B';
const LINE = '#E6DCCB';
const DISPLAY: PrintFontKey = 'hub-cormorant';
const BODY: PrintFontKey = 'hub-jost';

const W = SUPPLIER_CARD_PX.w;
const H = SUPPLIER_CARD_PX.h;
/** `n cqw` of the prototype, in this card's pixels. */
const CQ = (n: number) => (n * W) / 100;

/** The file a phone keeps it as — "bloom-ribbon-styling-setnayan-card.png" (the prototype's "Saved name"). */
export function supplierCardFileName(shopName: string): string {
  const slug = (shopName ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'supplier'}-setnayan-card.png`;
}

/** "Fri, Dec 18, 2026" — the prototype's card date (always with its year: a card is kept). A day only. */
export function supplierCardDate(raw: string | null | undefined, precision?: string | null): string | null {
  if (!raw) return null;
  if (precision && precision !== 'day') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** "wedding" → "Wedding". */
export function supplierCardEventLabel(eventWord: string | null | undefined): string | null {
  const w = (eventWord ?? '').trim();
  return w ? w[0]!.toUpperCase() + w.slice(1) : null;
}

/**
 * Where a line of type sits: its baseline inside a CSS line box of `lh` that starts at `top` — the half-leading
 * the browser gives it, from the face's own ascent and descent (Jost ≈ 1.07 / 0.37 em, Cormorant ≈ 0.92 / 0.29 em).
 */
function baseline(top: number, size: number, lh: number, font: PrintFontKey): number {
  const [asc, desc] = font === DISPLAY ? [0.924, 0.287] : [1.07, 0.375];
  return top + (lh - (asc + desc) * size) / 2 + asc * size;
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const k = 0.5523 * r;
  return [
    `M${x + r} ${y}`,
    `L${x + w - r} ${y}`,
    `C${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r}`,
    `L${x + w} ${y + h - r}`,
    `C${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h}`,
    `L${x + r} ${y + h}`,
    `C${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r}`,
    `L${x} ${y + r}`,
    `C${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

/** The ref the QR picture is handed to the renderer under. */
export const SUPPLIER_CARD_QR_REF = 'supplier-qr';

/**
 * The card as drawing operations. The QR is the image `SUPPLIER_CARD_QR_REF` — the claim link, black on white (the
 * prototype's "Code always black on white · so it scans").
 */
export function layoutSupplierCard(facts: SupplierCardFacts): PrintDoc {
  const ops: PrintOp[] = [];
  const left = CQ(7.2);
  const right = W - CQ(7.2);
  const inner = right - left;
  // .card — the paper, its corners cut (2.4cqw).
  const diePath = roundedRect(0, 0, W, H, CQ(2.4));
  ops.push({ t: 'rect', x: 0, y: 0, w: W, h: H, fill: PAPER });
  // .cin::before — the hairline frame, 2.6cqw in.
  const fi = CQ(2.6);
  ops.push({ t: 'path', d: roundedRect(fi, fi, W - 2 * fi, H - 2 * fi, CQ(1.4)), stroke: LINE, sw: CQ(0.28) });

  // ── .brand — the gold ring, SETNAYAN, "Supplier card" ──
  let y = CQ(6.4);
  const ring = CQ(7.4);
  const rcx = left + ring / 2;
  const rcy = y + ring / 2;
  ops.push({ t: 'circle', cx: rcx, cy: rcy, r: ring / 2 - CQ(0.6) / 2, stroke: GOLD, sw: CQ(0.6) });
  ops.push({ t: 'circle', cx: rcx, cy: rcy, r: ring / 2 - CQ(1.9), fill: GOLD });
  const wordSize = CQ(3.1);
  drawText(ops, 'SETNAYAN', left + ring + CQ(2.4), baseline(rcy - (wordSize * 1.5) / 2, wordSize, wordSize * 1.5, BODY), {
    font: BODY,
    size: wordSize,
    color: INK,
    tracking: 0.32,
  });
  const kindSize = CQ(2.3);
  drawText(ops, 'Supplier card', right, baseline(rcy - (kindSize * 1.5) / 2, kindSize, kindSize * 1.5, BODY), {
    font: BODY,
    size: kindSize,
    color: MUTE,
    tracking: 0.22,
    caps: true,
    align: 'right',
  });
  y += ring;

  // ── .shop — the biggest thing; one that does not fit one line steps down to 7cqw (`.shop.long`) and wraps ──
  y += CQ(4.6);
  let shopSize = CQ(8.6);
  let lines = wrap(facts.shopName, DISPLAY, shopSize, inner);
  if (lines.length > 1) {
    shopSize = CQ(7);
    lines = wrap(facts.shopName, DISPLAY, shopSize, inner);
  }
  const shopLh = shopSize * 1.02;
  for (const line of lines.slice(0, 4)) {
    drawText(ops, line, left, baseline(y, shopSize, shopLh, DISPLAY), { font: DISPLAY, size: shopSize, color: INK, maxWidth: inner });
    y += shopLh;
  }

  // ── .rows — label column 24cqw, gap 2cqw ──
  const valueX = left + CQ(24) + CQ(2);
  const valueW = right - valueX;
  const labelSize = CQ(2.3);
  const rowGap = CQ(1.5);
  /** One text row: the label and value share a baseline (align-items: baseline). Returns the row's height. */
  const textRow = (name: string, value: string, top: number, size: number): number => {
    const lh = size * 1.25;
    const vlines = wrap(value, BODY, size, valueW);
    const base = baseline(top, size, lh, BODY);
    drawText(ops, name, left, base, { font: BODY, size: labelSize, color: MUTE, tracking: 0.18, caps: true });
    vlines.forEach((l, i) => drawText(ops, l, valueX, base + i * lh, { font: BODY, size, color: INK, maxWidth: valueW }));
    return Math.max(1, vlines.length) * lh;
  };
  const block = (top: number, marginTop: number): number => {
    const ruleY = top + marginTop;
    ops.push({ t: 'rect', x: left, y: ruleY, w: inner, h: CQ(0.28), fill: LINE });
    return ruleY + CQ(0.28) + CQ(3);
  };

  const contact = (facts.contactPerson ?? '').trim();
  const services = facts.services.map((s) => s.trim()).filter(Boolean);
  if (contact || services.length) {
    y = block(y, CQ(3.4));
    let first = true;
    if (contact) {
      y += textRow('Contact', contact, y, CQ(3.5));
      first = false;
    }
    if (services.length) {
      if (!first) y += rowGap;
      // .svcs i — chips: 2.8cqw type, .6cqw / 2.2cqw padding, a hairline pill on white, 1.4cqw apart, wrapping.
      const cs = CQ(2.8);
      const padY = CQ(0.6);
      const padX = CQ(2.2);
      const bw = CQ(0.28);
      const chipH = cs * 1.5 + 2 * padY + 2 * bw;
      const gap = CQ(1.4);
      let cx = valueX;
      let cy = y;
      const firstChipBase = baseline(cy + bw + padY, cs, cs * 1.5, BODY);
      // The label sits on the first chip's baseline.
      drawText(ops, 'Covers', left, firstChipBase, { font: BODY, size: labelSize, color: MUTE, tracking: 0.18, caps: true });
      for (const s of services) {
        const tw = Math.min(measure(s, BODY, cs), valueW - 2 * padX - 2 * bw);
        const cw = tw + 2 * padX + 2 * bw;
        if (cx > valueX && cx + cw > right) {
          cx = valueX;
          cy += chipH + gap;
        }
        ops.push({ t: 'path', d: roundedRect(cx + bw / 2, cy + bw / 2, cw - bw, chipH - bw, (chipH - bw) / 2), fill: '#ffffff', stroke: LINE, sw: bw });
        drawText(ops, s, cx + bw + padX, baseline(cy + bw + padY, cs, cs * 1.5, BODY), { font: BODY, size: cs, color: INK, maxWidth: tw });
        cx += cw + gap;
      }
      y = cy + chipH;
    }
  }

  // ── .rows.inv — Invited by · Event · Date (3.3cqw values) ──
  const inv: Array<[string, string]> = [];
  if (facts.invitedBy?.trim()) inv.push(['Invited by', facts.invitedBy.trim()]);
  if (facts.eventLabel?.trim()) inv.push(['Event', facts.eventLabel.trim()]);
  if (facts.dateLabel?.trim()) inv.push(['Date', facts.dateLabel.trim()]);
  if (inv.length) {
    y = block(y, CQ(3));
    inv.forEach(([n, v], i) => {
      if (i > 0) y += rowGap;
      y += textRow(n, v, y, CQ(3.3));
    });
  }

  // ── .foot — setnayan.com · Set na 'yan, on the card's padding (5.6cqw from the bottom) ──
  const footSize = CQ(2.9);
  const footLh = footSize * 1.5;
  const footTop = H - CQ(5.6) - footLh;
  drawText(ops, 'setnayan.com', left, baseline(footTop, CQ(2.2), footLh, BODY), { font: BODY, size: CQ(2.2), color: MUTE, tracking: 0.06 });
  drawText(ops, "Set na 'yan", right, baseline(footTop, footSize, footLh, DISPLAY), { font: DISPLAY, size: footSize, color: GOLD, align: 'right' });

  // ── .qr — pushed to the bottom (margin: auto auto 0), above the foot ──
  const smallSize = CQ(2.3);
  const scanSize = CQ(3);
  const smallTop = footTop - CQ(3) - smallSize * 1.5;
  const scanTop = smallTop - CQ(0.6) - scanSize * 1.5;
  drawText(ops, 'Free for you · made just for this event', W / 2, baseline(smallTop, smallSize, smallSize * 1.5, BODY), {
    font: BODY,
    size: smallSize,
    color: MUTE,
    tracking: 0.04,
    align: 'center',
  });
  drawText(ops, 'Scan to join our event', W / 2, baseline(scanTop, scanSize, scanSize * 1.5, BODY), { font: BODY, size: scanSize, color: INK, align: 'center' });
  // The code's white square never meets what is above it: it gives way (down to the smallest a phone still reads
  // across a table) rather than overlap a long name.
  const room = scanTop - CQ(1.8) - (y + CQ(3));
  const box = Math.max(CQ(18), Math.min(CQ(26), room));
  const bx = (W - box) / 2;
  const by = scanTop - CQ(1.8) - box;
  ops.push({ t: 'path', d: roundedRect(bx, by, box, box, CQ(2.2)), fill: '#ffffff', stroke: LINE, sw: CQ(0.28) });
  const pad = (CQ(2) * box) / CQ(26);
  ops.push({ t: 'image', ref: SUPPLIER_CARD_QR_REF, x: bx + pad, y: by + pad, w: box - 2 * pad, h: box - 2 * pad });

  return { piece: 'pass', w: W, h: H, bleed: 0, die: 'rounded', diePath, ops };
}
