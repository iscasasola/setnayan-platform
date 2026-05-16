import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { centavosToPesoString } from './atc-mapper';
import type { MonthlyAtcRow, VendorFilingInput } from './filings';

/**
 * BIR Form 2307 (January 2018 ENCS) PDF generator.
 *
 * Strategy A — TEMPLATE MODE.
 *   Load `apps/web/public/bir-forms/2307-2018-ENCS.pdf` (the official BIR
 *   PDF). If the file has AcroForm fields, fill them by name and flatten.
 *   If the file has no AcroForm fields, draw the values onto the existing
 *   page using known x/y coordinates so the rendered page mirrors the
 *   BIR template visually. The template file is OWNER ACTION — download
 *   from https://www.bir.gov.ph/index.php/bir-forms/certificates.html
 *   and check into the repo.
 *
 * Strategy B — FALLBACK MODE.
 *   No template file → draw the form layout from scratch with pdf-lib.
 *   The fallback is a single-page A4 portrait page with the form's
 *   essential sections — period header, Part I (Payee), Part II (Payor),
 *   Part III monthly breakdown table, totals, signature line. Not a
 *   pixel-perfect facsimile of the BIR PDF, but contains every BIR-
 *   required data point so a tax accountant can transcribe it into
 *   eFPS if needed.
 *
 * Output: a `Uint8Array` of PDF bytes. The caller uploads to R2 /
 * Supabase Storage via `lib/bir/storage.ts` and writes the resulting
 * public URL into `vendor_2307_filings.pdf_public_url`.
 */

export type GeneratorPayorInfo = {
  /** BIR Part II Field 6: payor TIN. */
  tin: string | null;
  /** BIR Part II Field 7: payor registered name. */
  name: string | null;
  /** BIR Part II Field 8: payor registered address. */
  address: string | null;
  /** BIR Part II Field 8A: payor zip code. */
  zip: string | null;
  /** Signatory name printed on the signature line. */
  authorized_rep_name: string | null;
  /** Signatory TIN. */
  authorized_rep_tin: string | null;
  /** Signatory title (e.g. 'President', 'CFO'). */
  authorized_rep_title: string | null;
};

export type Generate2307Args = {
  filing: VendorFilingInput;
  period: {
    tax_year: number;
    tax_quarter: number;
    period_from: string; // YYYY-MM-DD
    period_to: string; // YYYY-MM-DD
  };
  payor: GeneratorPayorInfo;
  /**
   * Absolute path to the BIR-published template. Defaults to the in-repo
   * `apps/web/public/bir-forms/2307-2018-ENCS.pdf`. Pass `null` to force
   * fallback mode (useful for tests).
   */
  templatePath?: string | null;
};

/** Public entry point. */
export async function generate2307PDF(
  args: Generate2307Args,
): Promise<Uint8Array> {
  const templatePath = args.templatePath === undefined
    ? defaultTemplatePath()
    : args.templatePath;
  const template = templatePath ? await tryReadTemplate(templatePath) : null;

  if (template) {
    return drawOnTemplate(template, args);
  }
  return drawFromScratch(args);
}

function defaultTemplatePath(): string {
  // app root: apps/web; public dir: apps/web/public; template: bir-forms/...
  return path.join(
    process.cwd(),
    'apps',
    'web',
    'public',
    'bir-forms',
    '2307-2018-ENCS.pdf',
  );
}

async function tryReadTemplate(p: string): Promise<Buffer | null> {
  try {
    return await readFile(p);
  } catch {
    // Many possible reasons (file not present, wrong cwd at runtime).
    // Don't blow up — log + fall back.
    console.warn(
      `[bir/2307-pdf] Template not found at ${p}; falling back to drawn layout.`,
    );
    return null;
  }
}

// ----------------------------------------------------------------------------
// Strategy A — fill / overlay the BIR-published template
// ----------------------------------------------------------------------------

async function drawOnTemplate(
  templateBytes: Buffer | Uint8Array,
  args: Generate2307Args,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();
  const fields = form.getFields();

  if (fields.length > 0) {
    // AcroForm path — fill named fields, then flatten so eFPS can read.
    fillAcroForm(form, args);
    try {
      form.flatten();
    } catch {
      // Some BIR PDFs have non-flattenable widgets; ignore.
    }
    return pdf.save();
  }

  // No-AcroForm path — overlay text on top of the existing page using
  // coordinates calibrated for the 2018 ENCS layout. The coordinates
  // below are conservative best-effort; the owner can hand-tune.
  await drawOverlay(pdf, args);
  return pdf.save();
}

/**
 * Map our payload to the AcroForm field names BIR ships on the template.
 * BIR's field names are not always stable across template revisions —
 * we set a couple of common variants for each slot so a refresh of
 * the template doesn't silently drop a value.
 *
 * The form is also wide open: every set() call is wrapped in a
 * try/catch so missing fields don't crash the render.
 */
function fillAcroForm(
  form: ReturnType<PDFDocument['getForm']>,
  args: Generate2307Args,
): void {
  const { filing, period, payor } = args;

  const setText = (names: string[], value: string | null | undefined): void => {
    if (!value) return;
    for (const name of names) {
      try {
        const field = form.getTextField(name);
        field.setText(value);
        return;
      } catch {
        // Field not present under that name — keep trying.
      }
    }
  };

  // For the period — most templates accept MM/DD/YYYY split into pieces.
  const [fromMM, fromDD, fromYYYY] = splitDateUS(period.period_from);
  const [toMM, toDD, toYYYY] = splitDateUS(period.period_to);
  setText(['Period_From', 'PeriodFrom', 'From'], `${fromMM}/${fromDD}/${fromYYYY}`);
  setText(['Period_To', 'PeriodTo', 'To'], `${toMM}/${toDD}/${toYYYY}`);

  // Part I — Payee = the vendor.
  setText(['Payee_TIN', 'TIN', 'Field2'], filing.tin_number ?? '');
  setText(
    ['Payee_Name', 'PayeeName', 'Field3'],
    filing.registered_business_name ?? filing.business_name,
  );
  setText(
    ['Payee_Address', 'RegisteredAddress', 'Field4'],
    filing.registered_address ?? '',
  );
  setText(['Payee_ZIP', 'ZIPCode', 'Field4A'], filing.registered_zip ?? '');

  // Part II — Payor = Setnayan.
  setText(['Payor_TIN', 'PayorTIN', 'Field6'], payor.tin ?? '');
  setText(['Payor_Name', 'PayorName', 'Field7'], payor.name ?? '');
  setText(['Payor_Address', 'PayorAddress', 'Field8'], payor.address ?? '');
  setText(['Payor_ZIP', 'PayorZIP', 'Field8A'], payor.zip ?? '');

  // Part III — Details of Monthly Income Payments and Taxes Withheld.
  // Up to 1 ATC row in V1 mapper, but the BIR PDF supports several.
  for (let i = 0; i < filing.totals.atc_rows.length; i++) {
    const row = filing.totals.atc_rows[i];
    if (!row) continue;
    const idx = i + 1; // 1-indexed in BIR's naming convention.

    setText(
      [`ATC_${idx}`, `ATC${idx}`, `Field_ATC_${idx}`],
      row.atc_code,
    );

    const m1 =
      filing.monthly_breakdown.find(
        (r) => r.atc_code === row.atc_code && r.month_index === 1,
      )?.gross_centavos ?? 0;
    const m2 =
      filing.monthly_breakdown.find(
        (r) => r.atc_code === row.atc_code && r.month_index === 2,
      )?.gross_centavos ?? 0;
    const m3 =
      filing.monthly_breakdown.find(
        (r) => r.atc_code === row.atc_code && r.month_index === 3,
      )?.gross_centavos ?? 0;

    setText([`M1_${idx}`, `Month1_${idx}`], centavosToPesoString(m1));
    setText([`M2_${idx}`, `Month2_${idx}`], centavosToPesoString(m2));
    setText([`M3_${idx}`, `Month3_${idx}`], centavosToPesoString(m3));
    setText(
      [`Total_${idx}`, `RowTotal_${idx}`],
      centavosToPesoString(row.gross_centavos),
    );
    setText(
      [`TaxWithheld_${idx}`, `EWT_${idx}`],
      centavosToPesoString(row.ewt_centavos),
    );
  }

  setText(
    ['TotalGross', 'Total_Gross', 'Grand_Total_Gross'],
    centavosToPesoString(filing.totals.gross_centavos),
  );
  setText(
    ['TotalEWT', 'Total_EWT', 'Grand_Total_EWT'],
    centavosToPesoString(filing.totals.ewt_centavos),
  );

  // Signatory line.
  setText(
    ['Signatory_Name', 'AuthorizedRep'],
    payor.authorized_rep_name ?? '',
  );
  setText(['Signatory_TIN', 'AuthorizedRepTIN'], payor.authorized_rep_tin ?? '');
  setText(
    ['Signatory_Title', 'AuthorizedRepTitle'],
    payor.authorized_rep_title ?? '',
  );
}

/**
 * Overlay text on top of a template that has no AcroForm fields.
 * Coordinates are conservative best-effort and may need a manual tune
 * pass once the owner has uploaded the BIR template — adjust the
 * constants below if a field lands in the wrong spot.
 */
async function drawOverlay(
  pdf: PDFDocument,
  args: Generate2307Args,
): Promise<void> {
  const [page] = pdf.getPages();
  if (!page) return;

  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0, 0, 0);
  const size = 8;

  // BIR PDF is typically Letter (612x792). Y grows upward from the
  // bottom in PDF coordinates. Overlay coordinates below are
  // approximate — tune if needed against the official template.
  const w = (s: string, font = helv): number =>
    font.widthOfTextAtSize(s, size);

  const { filing, period, payor } = args;

  const [fromMM, fromDD, fromYYYY] = splitDateUS(period.period_from);
  const [toMM, toDD, toYYYY] = splitDateUS(period.period_to);
  // Period row.
  page.drawText(`${fromMM}/${fromDD}/${fromYYYY}`, {
    x: 280,
    y: 720,
    size,
    font: helv,
    color: ink,
  });
  page.drawText(`${toMM}/${toDD}/${toYYYY}`, {
    x: 410,
    y: 720,
    size,
    font: helv,
    color: ink,
  });

  // Part I — Payee.
  page.drawText(filing.tin_number ?? '', { x: 110, y: 678, size, font: helv, color: ink });
  page.drawText(
    filing.registered_business_name ?? filing.business_name,
    { x: 110, y: 656, size, font: helv, color: ink },
  );
  page.drawText(filing.registered_address ?? '', {
    x: 110,
    y: 634,
    size,
    font: helv,
    color: ink,
  });
  page.drawText(filing.registered_zip ?? '', {
    x: 460,
    y: 634,
    size,
    font: helv,
    color: ink,
  });

  // Part II — Payor.
  page.drawText(payor.tin ?? '', { x: 110, y: 580, size, font: helv, color: ink });
  page.drawText(payor.name ?? '', { x: 110, y: 558, size, font: helv, color: ink });
  page.drawText(payor.address ?? '', { x: 110, y: 536, size, font: helv, color: ink });
  page.drawText(payor.zip ?? '', { x: 460, y: 536, size, font: helv, color: ink });

  // Part III — ATC rows (single row in V1).
  const row = filing.totals.atc_rows[0];
  if (row) {
    const yBase = 460;
    page.drawText(row.atc_code, { x: 80, y: yBase, size, font: helvBold, color: ink });
    const m1 =
      filing.monthly_breakdown.find((r) => r.month_index === 1)?.gross_centavos ?? 0;
    const m2 =
      filing.monthly_breakdown.find((r) => r.month_index === 2)?.gross_centavos ?? 0;
    const m3 =
      filing.monthly_breakdown.find((r) => r.month_index === 3)?.gross_centavos ?? 0;
    page.drawText(centavosToPesoString(m1), { x: 200, y: yBase, size, font: helv, color: ink });
    page.drawText(centavosToPesoString(m2), { x: 300, y: yBase, size, font: helv, color: ink });
    page.drawText(centavosToPesoString(m3), { x: 400, y: yBase, size, font: helv, color: ink });
    page.drawText(centavosToPesoString(row.gross_centavos), {
      x: 470,
      y: yBase,
      size,
      font: helvBold,
      color: ink,
    });
    page.drawText(centavosToPesoString(row.ewt_centavos), {
      x: 540,
      y: yBase,
      size,
      font: helvBold,
      color: ink,
    });
  }

  // Grand totals.
  page.drawText(centavosToPesoString(filing.totals.gross_centavos), {
    x: 470,
    y: 400,
    size,
    font: helvBold,
    color: ink,
  });
  page.drawText(centavosToPesoString(filing.totals.ewt_centavos), {
    x: 540,
    y: 400,
    size,
    font: helvBold,
    color: ink,
  });
  // Avoid unused-var lint when overlay text is widened later.
  void w;

  // Signatory.
  if (payor.authorized_rep_name) {
    page.drawText(payor.authorized_rep_name, {
      x: 110,
      y: 130,
      size,
      font: helvBold,
      color: ink,
    });
  }
  if (payor.authorized_rep_title) {
    page.drawText(payor.authorized_rep_title, {
      x: 110,
      y: 116,
      size,
      font: helv,
      color: ink,
    });
  }
  if (payor.authorized_rep_tin) {
    page.drawText(payor.authorized_rep_tin, {
      x: 110,
      y: 102,
      size,
      font: helv,
      color: ink,
    });
  }
}

// ----------------------------------------------------------------------------
// Strategy B — draw from scratch (no BIR template available)
// ----------------------------------------------------------------------------

async function drawFromScratch(args: Generate2307Args): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter portrait — matches BIR.
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0, 0, 0);
  const muted = rgb(0.3, 0.3, 0.3);

  let y = 760;
  // Title block.
  page.drawText('Republic of the Philippines · Department of Finance', {
    x: 36,
    y,
    size: 8,
    font: helv,
    color: muted,
  });
  y -= 12;
  page.drawText('BUREAU OF INTERNAL REVENUE', {
    x: 36,
    y,
    size: 9,
    font: helvBold,
    color: ink,
  });

  // Form metadata pill (top-right).
  page.drawText('BIR Form 2307', {
    x: 470,
    y: 760,
    size: 9,
    font: helvBold,
    color: ink,
  });
  page.drawText('January 2018 (ENCS)', {
    x: 470,
    y: 748,
    size: 7,
    font: helv,
    color: muted,
  });

  y = 730;
  page.drawText('CERTIFICATE OF CREDITABLE TAX WITHHELD AT SOURCE', {
    x: 36,
    y,
    size: 12,
    font: helvBold,
    color: ink,
  });

  // Period row.
  y -= 24;
  const [fromMM, fromDD, fromYYYY] = splitDateUS(args.period.period_from);
  const [toMM, toDD, toYYYY] = splitDateUS(args.period.period_to);
  page.drawText('1  For the Period:', {
    x: 36,
    y,
    size: 9,
    font: helvBold,
    color: ink,
  });
  page.drawText(`From  ${fromMM}/${fromDD}/${fromYYYY}`, {
    x: 180,
    y,
    size: 9,
    font: helv,
    color: ink,
  });
  page.drawText(`To  ${toMM}/${toDD}/${toYYYY}`, {
    x: 340,
    y,
    size: 9,
    font: helv,
    color: ink,
  });

  // Part I — Payee (vendor).
  y -= 22;
  drawSectionHeader(page, 36, y, 'Part I — Payee Information', helvBold, ink);
  y -= 14;
  drawLabeledRow(page, 36, y, '2  TIN', args.filing.tin_number ?? '', helv, helvBold, ink);
  y -= 14;
  drawLabeledRow(
    page,
    36,
    y,
    "3  Payee's Name",
    args.filing.registered_business_name ?? args.filing.business_name,
    helv,
    helvBold,
    ink,
  );
  y -= 14;
  drawLabeledRow(
    page,
    36,
    y,
    '4  Registered Address',
    args.filing.registered_address ?? '',
    helv,
    helvBold,
    ink,
  );
  page.drawText(`4A  ZIP  ${args.filing.registered_zip ?? ''}`, {
    x: 420,
    y,
    size: 9,
    font: helv,
    color: ink,
  });

  // Part II — Payor (Setnayan).
  y -= 22;
  drawSectionHeader(page, 36, y, 'Part II — Payor Information', helvBold, ink);
  y -= 14;
  drawLabeledRow(page, 36, y, '6  TIN', args.payor.tin ?? '', helv, helvBold, ink);
  y -= 14;
  drawLabeledRow(
    page,
    36,
    y,
    "7  Payor's Name",
    args.payor.name ?? '',
    helv,
    helvBold,
    ink,
  );
  y -= 14;
  drawLabeledRow(
    page,
    36,
    y,
    '8  Registered Address',
    args.payor.address ?? '',
    helv,
    helvBold,
    ink,
  );
  page.drawText(`8A  ZIP  ${args.payor.zip ?? ''}`, {
    x: 420,
    y,
    size: 9,
    font: helv,
    color: ink,
  });

  // Part III — table.
  y -= 22;
  drawSectionHeader(
    page,
    36,
    y,
    'Part III — Details of Monthly Income Payments and Taxes Withheld',
    helvBold,
    ink,
  );

  y -= 18;
  // Table column positions — named so we don't index into a tuple twice.
  const colAtc = 36;
  const colM1 = 100;
  const colM2 = 184;
  const colM3 = 268;
  const colTotal = 352;
  const colEwt = 446;
  page.drawRectangle({ x: 36, y: y - 4, width: 520, height: 16, color: rgb(0.92, 0.92, 0.92) });
  for (const [x, label] of [
    [colAtc, 'ATC'],
    [colM1, '1st Month'],
    [colM2, '2nd Month'],
    [colM3, '3rd Month'],
    [colTotal, 'Total'],
    [colEwt, 'Tax Withheld'],
  ] as Array<[number, string]>) {
    page.drawText(label, {
      x: x + 2,
      y: y + 2,
      size: 8,
      font: helvBold,
      color: ink,
    });
  }
  y -= 14;

  for (const row of args.filing.totals.atc_rows) {
    const m1 = monthSum(args.filing.monthly_breakdown, row.atc_code, 1);
    const m2 = monthSum(args.filing.monthly_breakdown, row.atc_code, 2);
    const m3 = monthSum(args.filing.monthly_breakdown, row.atc_code, 3);
    page.drawText(row.atc_code, { x: colAtc + 2, y, size: 9, font: helvBold, color: ink });
    page.drawText(centavosToPesoString(m1), { x: colM1 + 2, y, size: 9, font: helv, color: ink });
    page.drawText(centavosToPesoString(m2), { x: colM2 + 2, y, size: 9, font: helv, color: ink });
    page.drawText(centavosToPesoString(m3), { x: colM3 + 2, y, size: 9, font: helv, color: ink });
    page.drawText(centavosToPesoString(row.gross_centavos), {
      x: colTotal + 2,
      y,
      size: 9,
      font: helvBold,
      color: ink,
    });
    page.drawText(centavosToPesoString(row.ewt_centavos), {
      x: colEwt + 2,
      y,
      size: 9,
      font: helvBold,
      color: ink,
    });
    y -= 14;
  }
  if (args.filing.totals.atc_rows.length === 0) {
    page.drawText('—  No EWT-bearing payouts in this quarter  —', {
      x: 36,
      y,
      size: 9,
      font: helv,
      color: muted,
    });
    y -= 14;
  }

  // Grand totals row.
  y -= 6;
  page.drawLine({ start: { x: 36, y: y + 6 }, end: { x: 556, y: y + 6 }, thickness: 0.5, color: muted });
  page.drawText('Grand Total', { x: 36, y, size: 9, font: helvBold, color: ink });
  page.drawText(centavosToPesoString(args.filing.totals.gross_centavos), {
    x: colTotal + 2,
    y,
    size: 9,
    font: helvBold,
    color: ink,
  });
  page.drawText(centavosToPesoString(args.filing.totals.ewt_centavos), {
    x: colEwt + 2,
    y,
    size: 9,
    font: helvBold,
    color: ink,
  });

  // Signature block.
  y -= 48;
  page.drawText('Signatory (Setnayan authorized representative)', {
    x: 36,
    y,
    size: 9,
    font: helvBold,
    color: ink,
  });
  y -= 14;
  drawLabeledRow(
    page,
    36,
    y,
    'Name',
    args.payor.authorized_rep_name ?? '',
    helv,
    helvBold,
    ink,
  );
  y -= 14;
  drawLabeledRow(
    page,
    36,
    y,
    'Title',
    args.payor.authorized_rep_title ?? '',
    helv,
    helvBold,
    ink,
  );
  y -= 14;
  drawLabeledRow(
    page,
    36,
    y,
    'TIN',
    args.payor.authorized_rep_tin ?? '',
    helv,
    helvBold,
    ink,
  );

  // Footer disclaimer.
  page.drawText(
    'Auto-generated by Setnayan Computerized Accounting System. ' +
      'Pending BIR-published template overlay — owner action: download ' +
      'the official 2307 (Jan 2018 ENCS) PDF and place at ' +
      'apps/web/public/bir-forms/2307-2018-ENCS.pdf.',
    { x: 36, y: 36, size: 7, font: helv, color: muted, maxWidth: 540 },
  );

  return pdf.save();
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function drawSectionHeader(
  page: ReturnType<PDFDocument['addPage']>,
  x: number,
  y: number,
  text: string,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  color: ReturnType<typeof rgb>,
): void {
  page.drawRectangle({
    x,
    y: y - 2,
    width: 520,
    height: 14,
    color: rgb(0.95, 0.93, 0.9),
  });
  page.drawText(text, { x: x + 4, y: y + 1, size: 9, font, color });
}

function drawLabeledRow(
  page: ReturnType<PDFDocument['addPage']>,
  x: number,
  y: number,
  label: string,
  value: string,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>,
  color: ReturnType<typeof rgb>,
): void {
  page.drawText(label, { x, y, size: 8, font: bold, color });
  page.drawText(value, { x: x + 110, y, size: 9, font, color });
}

function splitDateUS(iso: string): [string, string, string] {
  const [y, m, d] = iso.split('-');
  return [m ?? '01', d ?? '01', y ?? '1970'];
}

function monthSum(
  breakdown: MonthlyAtcRow[],
  atc: string,
  month: 1 | 2 | 3,
): number {
  let sum = 0;
  for (const row of breakdown) {
    if (row.atc_code === atc && row.month_index === month) sum += row.gross_centavos;
  }
  return sum;
}
