/**
 * lib/emv-qr.ts — QR Ph (EMVCo) payload parsing and per-order re-minting.
 *
 * A QR Ph code is a flat TLV string — `<2-char id><2-char length><value>` —
 * with nested templates at tags 26–51 (merchant account info) and 62
 * (additional data). Tag 63 is a CRC16-CCITT-FALSE over everything up to and
 * including its own `6304` header, and must come last.
 *
 * We use this to take Setnayan's OWN static receiving QR (the image an admin
 * uploaded at /admin/settings/payment-methods) and mint a per-order variant
 * carrying that order's exact amount, so the couple never types a figure.
 * Nothing here talks to GCash or BDO — it rewrites a payload we already own.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WALLET BEHAVIOUR — established by live testing on 2026-07-31, not inferred.
 * Owner scanned every variant against real GCash and Maribank wallets:
 *
 *   • An amount (tag 54) is ONLY accepted when tag 01 = '12' (dynamic).
 *     GCash *parses* tag 54 and REJECTS the code outright when it sits on a
 *     static ('11') payload, because a static code declares "reusable, no
 *     amount". That rejection is how we know the amount is genuinely read.
 *   • GCash REJECTS the entire tag 62 template — every sub-tag tried (01 Bill
 *     Number, 05 Reference Label incl. numeric-only and 4-char, 07 Terminal
 *     Label, 08 Purpose). So NO order reference can ride inside the QR.
 *     Do not re-add tag 62; it breaks the code for every GCash payer.
 *   • Centavos survive intact: a ₱1.43 code pre-filled as ₱1.43, transferred
 *     as ₱1.43, and landed on the recipient ledger as +1.43.
 *   • Maribank accepts all variants including tag 62 — which is what proves
 *     these payloads are well-formed. GCash is simply the stricter reader, and
 *     it is the one that decides, so we emit the intersection.
 *
 * Therefore mintOrderQr() emits exactly: tag 01 = '12', tag 54 = amount, and
 * NO tag 62. See memory `project-setnayan-gcash-qr-amount-injection`.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type TlvField = { id: string; value: string };

// EMVCo counts BYTES, not characters — both for tag lengths and for the CRC.
// "JUAN PEÑA JR" is 12 characters but 13 bytes, and ñ is everywhere in
// Filipino names (Peña, Niño, Muñoz). A char-indexed parser desynchronises on
// the first one, and a UTF-16 CRC produces a checksum no scanner agrees with.
const enc = new TextEncoder();
const dec = new TextDecoder();

/** CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection, no final XOR). */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of enc.encode(input)) {
    crc ^= byte << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Parse a TLV string into an ordered field list. Throws on malformed input. */
export function parseTlv(payload: string): TlvField[] {
  const bytes = enc.encode(payload);
  const out: TlvField[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (i + 4 > bytes.length) throw new Error(`Truncated TLV header at byte ${i}`);
    const id = dec.decode(bytes.slice(i, i + 2));
    const lenRaw = dec.decode(bytes.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenRaw)) {
      throw new Error(`Malformed TLV at byte ${i}: "${id}${lenRaw}"`);
    }
    const len = Number(lenRaw);
    if (i + 4 + len > bytes.length) throw new Error(`Truncated value for tag ${id}`);
    out.push({ id, value: dec.decode(bytes.slice(i + 4, i + 4 + len)) });
    i += 4 + len;
  }
  return out;
}

/** Serialize an ordered field list back to a TLV string. */
export function buildTlv(fields: TlvField[]): string {
  return fields
    .map(({ id, value }) => {
      const len = enc.encode(value).length;
      if (len > 99) throw new Error(`Tag ${id} value too long (${len} bytes)`);
      return id + String(len).padStart(2, '0') + value;
    })
    .join('');
}

/** Check an existing payload's own CRC. */
export function verifyCrc(payload: string): {
  ok: boolean;
  found: string | null;
  expected: string | null;
} {
  const idx = payload.lastIndexOf('6304');
  if (idx === -1) return { ok: false, found: null, expected: null };
  const found = payload.slice(idx + 4, idx + 8).toUpperCase();
  const expected = crc16(payload.slice(0, idx + 4));
  return { ok: found === expected && found.length === 4, found, expected };
}

/**
 * Is this string a QR Ph payload we can safely re-mint?
 *
 * Deliberately strict: we are about to rewrite a code people send money
 * through, so anything we do not fully understand is rejected and the caller
 * falls back to showing the original uploaded image unchanged.
 */
export function isQrPhPayload(payload: string | null | undefined): payload is string {
  if (!payload || payload.length < 20 || payload.length > 512) return false;
  if (!verifyCrc(payload).ok) return false;
  let fields: TlvField[];
  try {
    fields = parseTlv(payload);
  } catch {
    return false;
  }
  const byId = new Map(fields.map((f) => [f.id, f.value]));
  // Payload format indicator must be present and standard.
  if (byId.get('00') !== '01') return false;
  // PHP only — we must never mint an amount onto a foreign-currency code.
  if (byId.get('53') !== '608') return false;
  // At least one merchant-account-information template (tags 26–51).
  return fields.some((f) => Number(f.id) >= 26 && Number(f.id) <= 51);
}

/** Insert or replace a top-level field, keeping tags in ascending order. */
function upsert(fields: TlvField[], id: string, value: string): TlvField[] {
  const next = fields.filter((f) => f.id !== id);
  const at = next.findIndex((f) => Number(f.id) > Number(id));
  const field: TlvField = { id, value };
  if (at === -1) next.push(field);
  else next.splice(at, 0, field);
  return next;
}

/**
 * Mint a per-order QR Ph payload carrying `amountPhp`.
 *
 * Returns null rather than throwing when the source is not a payload we
 * recognise, or the amount is out of range — the caller then shows the
 * original static QR, which always works. Failing soft matters here: a broken
 * QR on a checkout page costs a sale, and worse, an unnoticed wrong one costs
 * a reconciliation.
 */
export function mintOrderQr(
  sourcePayload: string | null | undefined,
  amountPhp: number,
): string | null {
  if (!isQrPhPayload(sourcePayload)) return null;
  if (!Number.isFinite(amountPhp) || amountPhp <= 0) return null;
  // EMVCo caps tag 54 at 13 characters; PH wallets cap transfers far below
  // this. Anything larger is a bug upstream, not a payment.
  if (amountPhp >= 1_000_000_000) return null;

  const amount = amountPhp.toFixed(2);
  if (amount.length > 13) return null;

  try {
    let fields = parseTlv(sourcePayload).filter((f) => f.id !== '63');
    // Dynamic — mandatory once an amount is present (see header note).
    fields = upsert(fields, '01', '12');
    fields = upsert(fields, '54', amount);
    // Tag 62 is deliberately NOT set: GCash rejects the template outright.
    const body = buildTlv(fields) + '6304';
    const minted = body + crc16(body);
    // Belt and braces — never hand back something that fails its own check.
    return verifyCrc(minted).ok ? minted : null;
  } catch {
    return null;
  }
}
