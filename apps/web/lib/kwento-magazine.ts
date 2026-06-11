/**
 * apps/web/lib/kwento-magazine.ts
 *
 * Kwento Magazine — Variant A (0012 § Kwento Magazine): the FREE,
 * couple-PRIVATE A4 keepsake. The couple's storyline is the FRAME (prologue +
 * Salamat), the wedding day's `captured_at` timeline is the SPINE
 * (gap-clustered chapters), and approved Kwentos render beside the exact
 * photo each guest wrote about — "the photos tell the story; the guests
 * narrate it," in print.
 *
 * Variant A privacy: couple-private masters, full attribution, no share
 * affordance (the shareable Variant B waits on the blur pipeline + the
 * consent-string amendment). Fonts: pdf-lib StandardFonts (WinAnsi — ñ, é,
 * curly quotes, em-dash all render; emoji are stripped gently since NO text
 * font renders them; Cormorant/fontkit is a flagged polish pass).
 *
 * Pure-logic pieces (bucketing, curation, WinAnsi sanitizer) are exported for
 * the unit suite (scripts/test-kwento-magazine.ts); the renderer takes
 * pre-fetched image bytes — the route owns ALL I/O (concept-pdf pattern).
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

// ── palette (Clean Editorial · matches concept-pdf) ─────────────────────────
const INK = rgb(0.118, 0.133, 0.161); // Deep Obsidian
const CREAM = rgb(0.984, 0.984, 0.98); // Warm Alabaster
const GOLD = rgb(0.773, 0.627, 0.349); // Royal Champagne Gold
const MULBERRY = rgb(0.361, 0.145, 0.259); // Rich Mulberry
const SOFT = rgb(0.45, 0.45, 0.47);

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 42;

// ── data shapes ──────────────────────────────────────────────────────────────

export interface MagazineCapture {
  /** 'papic_photos' | 'papic_guest_captures' */
  sourceTable: string;
  sourceId: string;
  capturedAtMs: number;
}

export interface MagazineKwento {
  sourceTable: string;
  sourceId: string;
  body: string;
  author: string;
}

export interface MagazineChapter {
  title: string;
  subtitle: string;
  startMs: number;
  endMs: number;
  captures: MagazineCapture[];
  /** Photos cut by the per-chapter cap (surfaced, never silent). */
  dropped: number;
}

export interface MagazineInput {
  coupleNames: string;
  eventDateIso: string | null;
  monogramInitials: string;
  /** composeCopy output — lede paragraphs for the prologue. */
  prologueParagraphs: string[];
  milestones: { label: string; detail: string }[];
  specialMessage: string | null;
  chapters: MagazineChapter[];
  kwentos: MagazineKwento[];
  /** sourceTable:sourceId → pre-fetched, pre-resized JPEG bytes. */
  images: Map<string, Uint8Array>;
  totals: { photos: number; kwentos: number; guests: number | null };
}

// ── pure logic (unit-tested) ─────────────────────────────────────────────────

/**
 * WinAnsi-safe text: KEEP accented Latin (ñ, é…), curly quotes, en/em dashes,
 * ellipsis; strip emoji + anything WinAnsi can't encode (no text font renders
 * emoji — stripping is the honest move, per the magazine design). Whitespace
 * collapses; never throws.
 */
export function winAnsiSafe(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’]/g, (c) => c) // keep curly singles (WinAnsi has them)
    .split('')
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code >= 0x20 && code <= 0x7e) return true; // ASCII
      if (code >= 0xa0 && code <= 0xff) return true; // Latin-1 (ñ é …)
      return [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026].includes(code);
    })
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** PH-wedding bilingual chapter vocabulary, applied by ordinal position. */
export const CHAPTER_VOCAB: { title: string; subtitle: string }[] = [
  { title: 'Ang Paghahanda', subtitle: 'Getting ready' },
  { title: 'Ang Seremonya', subtitle: 'The ceremony' },
  { title: 'Ang Pagdiriwang', subtitle: 'The reception' },
  { title: 'Ang Unang Sayaw', subtitle: 'The first dance' },
  { title: 'Ang Selebrasyon', subtitle: 'The celebration' },
  { title: 'Ang Paghahatid', subtitle: 'The send-off' },
];

/**
 * Deterministic moment bucketing (no per-render AI — the SDE lock):
 * sort by captured_at, split where the gap exceeds
 * max(20 minutes, 1.5 × median inter-shot gap). Fewer than `collapseBelow`
 * photos collapses to a single "Ang Araw / The day" chapter.
 */
export function bucketMoments(
  captures: MagazineCapture[],
  opts: { collapseBelow?: number } = {},
): MagazineChapter[] {
  const collapseBelow = opts.collapseBelow ?? 12;
  if (captures.length === 0) return [];

  const sorted = [...captures].sort((a, b) => a.capturedAtMs - b.capturedAtMs);

  // Chapters carry their FULL groups; the per-chapter cap is applied by
  // prioritizeKwentoAnchors so a Kwento-anchored photo can rescue a slot the
  // raw chronological cap would have dropped.
  const single = (): MagazineChapter[] => [
    {
      title: 'Ang Araw',
      subtitle: 'The day',
      startMs: sorted[0]?.capturedAtMs ?? 0,
      endMs: sorted[sorted.length - 1]?.capturedAtMs ?? 0,
      captures: sorted,
      dropped: 0,
    },
  ];
  if (sorted.length < collapseBelow) return single();

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (a && b) gaps.push(b.capturedAtMs - a.capturedAtMs);
  }
  const median = [...gaps].sort((x, y) => x - y)[Math.floor(gaps.length / 2)] ?? 0;
  const threshold = Math.max(20 * 60_000, 1.5 * median);

  const groups: MagazineCapture[][] = [];
  let current: MagazineCapture[] = [sorted[0] as MagazineCapture];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const item = sorted[i];
    if (!prev || !item) continue;
    if (item.capturedAtMs - prev.capturedAtMs > threshold) {
      groups.push(current);
      current = [];
    }
    current.push(item);
  }
  groups.push(current);

  if (groups.length === 1) return single();

  return groups.map((group, i) => {
    const vocab =
      CHAPTER_VOCAB[Math.min(i, CHAPTER_VOCAB.length - 1)] ??
      ({ title: 'Ang Araw', subtitle: 'The day' } as const);
    return {
      title: vocab.title,
      subtitle: vocab.subtitle,
      startMs: group[0]?.capturedAtMs ?? 0,
      endMs: group[group.length - 1]?.capturedAtMs ?? 0,
      captures: group,
      dropped: 0,
    };
  });
}

/**
 * Curation rule: a Kwento earns its photo a slot. Within each chapter,
 * captures that carry an approved Kwento are kept ahead of silent ones
 * (chronological within each tier), under the same cap.
 */
export function prioritizeKwentoAnchors(
  chapter: MagazineChapter,
  kwentos: MagazineKwento[],
  cap = 8,
): MagazineCapture[] {
  const anchored = new Set(kwentos.map((k) => `${k.sourceTable}:${k.sourceId}`));
  const all = [...chapter.captures].sort((a, b) => a.capturedAtMs - b.capturedAtMs);
  const withK = all.filter((c) => anchored.has(`${c.sourceTable}:${c.sourceId}`));
  const without = all.filter((c) => !anchored.has(`${c.sourceTable}:${c.sourceId}`));
  return [...withK, ...without].slice(0, cap);
}

// ── renderer ────────────────────────────────────────────────────────────────

type Fonts = { serif: PDFFont; serifBold: PDFFont; serifItalic: PDFFont; sans: PDFFont };

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = winAnsiSafe(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(probe, size) <= maxWidth) {
      line = probe;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

class Cursor {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    private onNewPage: (page: PDFPage) => void,
  ) {
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.onNewPage(this.page);
    this.y = PAGE_H - MARGIN;
  }
  /** Whole-block placement: break the page when the block can't fit. */
  ensure(height: number): void {
    if (this.y - height < MARGIN + 24) {
      this.page = this.doc.addPage([PAGE_W, PAGE_H]);
      this.onNewPage(this.page);
      this.y = PAGE_H - MARGIN;
    }
  }
}

function drawParagraph(
  c: Cursor,
  fonts: Fonts,
  text: string,
  opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; leading?: number; maxWidth?: number } = {},
): void {
  const size = opts.size ?? 11;
  const font = opts.font ?? fonts.serif;
  const leading = opts.leading ?? size * 1.45;
  const maxWidth = opts.maxWidth ?? PAGE_W - MARGIN * 2;
  const lines = wrap(font, text, size, maxWidth);
  for (const line of lines) {
    c.ensure(leading);
    c.page.drawText(line, { x: MARGIN, y: c.y - size, size, font, color: opts.color ?? INK });
    c.y -= leading;
  }
}

function goldRule(c: Cursor, width = 64): void {
  c.ensure(18);
  c.page.drawRectangle({ x: MARGIN, y: c.y - 8, width, height: 1.4, color: GOLD });
  c.y -= 22;
}

/** Build the complete Variant-A magazine. Never throws on missing images. */
export async function buildKwentoMagazine(input: MagazineInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    sans: await doc.embedFont(StandardFonts.Helvetica),
  };

  const footer = (page: PDFPage) => {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
    page.drawText('PARA SA INYO LANG · FOR YOU ONLY', {
      x: MARGIN,
      y: 18,
      size: 6.5,
      font: fonts.sans,
      color: SOFT,
    });
    const brand = 'SETNAYAN · PAPIC · KWENTO';
    page.drawText(brand, {
      x: PAGE_W - MARGIN - fonts.sans.widthOfTextAtSize(brand, 6.5),
      y: 18,
      size: 6.5,
      font: fonts.sans,
      color: SOFT,
    });
  };

  const embedded = new Map<string, Awaited<ReturnType<PDFDocument['embedJpg']>>>();
  const embed = async (key: string) => {
    if (embedded.has(key)) return embedded.get(key) ?? null;
    const bytes = input.images.get(key);
    if (!bytes) return null;
    try {
      const img = await doc.embedJpg(bytes);
      embedded.set(key, img);
      return img;
    } catch {
      return null; // silent skip — the slot is dropped, never a crash
    }
  };

  const c = new Cursor(doc, footer);

  // ── P1 · Cover ──
  c.y = PAGE_H - 130;
  const initials = winAnsiSafe(input.monogramInitials) || '•';
  const iw = fonts.serifBold.widthOfTextAtSize(initials, 34);
  c.page.drawCircle({ x: PAGE_W / 2, y: c.y, size: 38, borderColor: GOLD, borderWidth: 1.4 });
  c.page.drawText(initials, {
    x: PAGE_W / 2 - iw / 2,
    y: c.y - 12,
    size: 34,
    font: fonts.serifBold,
    color: MULBERRY,
  });
  c.y -= 86;
  const title = winAnsiSafe(input.coupleNames);
  const tw = fonts.serifBold.widthOfTextAtSize(title, 30);
  c.page.drawText(title, { x: (PAGE_W - tw) / 2, y: c.y, size: 30, font: fonts.serifBold, color: INK });
  c.y -= 26;
  const kicker = 'ANG KWENTO NG AMING KASAL';
  const kw = fonts.sans.widthOfTextAtSize(kicker, 10);
  c.page.drawText(kicker, { x: (PAGE_W - kw) / 2, y: c.y, size: 10, font: fonts.sans, color: GOLD });
  c.y -= 20;
  if (input.eventDateIso) {
    const date = winAnsiSafe(
      new Date(input.eventDateIso).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    );
    const dw = fonts.serif.widthOfTextAtSize(date, 12);
    c.page.drawText(date, { x: (PAGE_W - dw) / 2, y: c.y, size: 12, font: fonts.serif, color: SOFT });
  }
  // Cover hero: the first capture with bytes.
  const heroKey = input.chapters
    .flatMap((ch) => ch.captures)
    .map((p) => `${p.sourceTable}:${p.sourceId}`)
    .find((k) => input.images.has(k));
  if (heroKey) {
    const hero = await embed(heroKey);
    if (hero) {
      const maxW = PAGE_W - MARGIN * 2;
      const maxH = 360;
      const scale = Math.min(maxW / hero.width, maxH / hero.height);
      const w = hero.width * scale;
      const h = hero.height * scale;
      const x = (PAGE_W - w) / 2;
      const y = 90;
      c.page.drawRectangle({ x: x - 4, y: y - 4, width: w + 8, height: h + 8, borderColor: GOLD, borderWidth: 1 });
      c.page.drawImage(hero, { x, y, width: w, height: h });
    }
  }

  // ── P2 · Prologue (the FRAME opens) ──
  c.page = doc.addPage([PAGE_W, PAGE_H]);
  footer(c.page);
  c.y = PAGE_H - MARGIN - 8;
  drawParagraph(c, fonts, 'Ang Simula', { size: 22, font: fonts.serifBold, color: MULBERRY });
  goldRule(c);
  for (const para of input.prologueParagraphs.slice(0, 4)) {
    drawParagraph(c, fonts, para, { size: 11.5 });
    c.y -= 6;
  }
  if (input.milestones.length > 0) {
    c.y -= 8;
    drawParagraph(c, fonts, 'Mga Milestone', { size: 12, font: fonts.serifBold, color: GOLD });
    c.y -= 2;
    for (const m of input.milestones.slice(0, 9)) {
      drawParagraph(c, fonts, `•  ${m.label}${m.detail ? ` — ${m.detail}` : ''}`, {
        size: 10.5,
        color: SOFT,
        leading: 16,
      });
    }
  }
  if (input.specialMessage) {
    c.y -= 12;
    drawParagraph(c, fonts, `"${input.specialMessage}"`, {
      size: 13,
      font: fonts.serifItalic,
      color: MULBERRY,
    });
  }
  // The hand-off beat: love-story axis → wedding-day axis.
  c.y -= 14;
  drawParagraph(
    c,
    fonts,
    'At pagkatapos ng lahat ng iyon — isang araw na lang ang kailangan para sabihin ang lahat.',
    { size: 11, font: fonts.serifItalic, color: SOFT },
  );

  // ── The SPINE · chapters ──
  const kwentoByAnchor = new Map<string, MagazineKwento[]>();
  for (const k of input.kwentos) {
    const key = `${k.sourceTable}:${k.sourceId}`;
    kwentoByAnchor.set(key, [...(kwentoByAnchor.get(key) ?? []), k]);
  }
  const placedKwentos = new Set<MagazineKwento>();

  for (const chapter of input.chapters) {
    const picks = prioritizeKwentoAnchors(chapter, input.kwentos);
    if (picks.length === 0) continue;

    c.page = doc.addPage([PAGE_W, PAGE_H]);
    footer(c.page);
    c.y = PAGE_H - MARGIN - 8;

    const when = new Date(chapter.startMs).toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
    });
    drawParagraph(c, fonts, chapter.title, { size: 20, font: fonts.serifBold, color: MULBERRY });
    drawParagraph(c, fonts, `${chapter.subtitle} · ${winAnsiSafe(when)}`, {
      size: 10,
      font: fonts.sans,
      color: SOFT,
      leading: 16,
    });
    goldRule(c);

    for (const pick of picks) {
      const key = `${pick.sourceTable}:${pick.sourceId}`;
      const img = await embed(key);
      const anchored = kwentoByAnchor.get(key) ?? [];

      if (img) {
        const maxW = PAGE_W - MARGIN * 2;
        const maxH = 250;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        c.ensure(h + 16);
        const x = (PAGE_W - w) / 2;
        c.page.drawRectangle({
          x: x - 3,
          y: c.y - h - 3,
          width: w + 6,
          height: h + 6,
          borderColor: GOLD,
          borderWidth: 0.8,
        });
        c.page.drawImage(img, { x, y: c.y - h, width: w, height: h });
        c.y -= h + 14;
      }
      for (const k of anchored) {
        placedKwentos.add(k);
        const quote = `"${k.body}"`;
        c.ensure(54);
        drawParagraph(c, fonts, quote, {
          size: 12.5,
          font: fonts.serifItalic,
          color: INK,
          maxWidth: PAGE_W - MARGIN * 2 - 24,
        });
        drawParagraph(c, fonts, `— ${k.author}`, {
          size: 10,
          font: fonts.sans,
          color: MULBERRY,
          leading: 18,
        });
        c.y -= 8;
      }
      c.y -= 6;
    }
    const droppedHere = chapter.captures.length - picks.length;
    if (droppedHere > 0) {
      drawParagraph(c, fonts, `+ ${droppedHere} more from this moment in your gallery`, {
        size: 9,
        font: fonts.sans,
        color: SOFT,
        leading: 14,
      });
    }
  }

  // ── Mga Boses · orphan kwentos (no guest's words are ever lost) ──
  const orphans = input.kwentos.filter((k) => !placedKwentos.has(k));
  if (orphans.length > 0) {
    c.page = doc.addPage([PAGE_W, PAGE_H]);
    footer(c.page);
    c.y = PAGE_H - MARGIN - 8;
    drawParagraph(c, fonts, 'Mga Boses', { size: 20, font: fonts.serifBold, color: MULBERRY });
    drawParagraph(c, fonts, 'The voices of your guests', {
      size: 10,
      font: fonts.sans,
      color: SOFT,
      leading: 16,
    });
    goldRule(c);
    for (const k of orphans.slice(0, 40)) {
      c.ensure(50);
      drawParagraph(c, fonts, `"${k.body}"`, { size: 12, font: fonts.serifItalic, color: INK });
      drawParagraph(c, fonts, `— ${k.author}`, { size: 10, font: fonts.sans, color: MULBERRY, leading: 18 });
      c.y -= 10;
    }
  }

  // ── Salamat (the FRAME closes) ──
  c.page = doc.addPage([PAGE_W, PAGE_H]);
  footer(c.page);
  c.y = PAGE_H - 200;
  const sal = 'Salamat';
  const sw = fonts.serifBold.widthOfTextAtSize(sal, 28);
  c.page.drawText(sal, { x: (PAGE_W - sw) / 2, y: c.y, size: 28, font: fonts.serifBold, color: MULBERRY });
  c.y -= 40;
  const statsBits = [
    `${input.totals.photos} ${input.totals.photos === 1 ? 'photo' : 'photos'}`,
    `${input.totals.kwentos} ${input.totals.kwentos === 1 ? 'kwento' : 'kwentos'}`,
    ...(input.totals.guests ? [`${input.totals.guests} guests`] : []),
    'one day',
  ];
  const stats = statsBits.join(' · ');
  const stw = fonts.serif.widthOfTextAtSize(stats, 12);
  c.page.drawText(winAnsiSafe(stats), {
    x: (PAGE_W - stw) / 2,
    y: c.y,
    size: 12,
    font: fonts.serif,
    color: SOFT,
  });
  c.y -= 34;
  const closing = 'Ang mga litratong ito ang nagkuwento. Ang mga bisita ninyo ang nagsalaysay.';
  const cw = fonts.serifItalic.widthOfTextAtSize(closing, 12);
  c.page.drawText(winAnsiSafe(closing), {
    x: (PAGE_W - cw) / 2,
    y: c.y,
    size: 12,
    font: fonts.serifItalic,
    color: INK,
  });
  c.y -= 60;
  const edition = 'UNANG EDISYON';
  const ew = fonts.sans.widthOfTextAtSize(edition, 8);
  c.page.drawText(edition, { x: (PAGE_W - ew) / 2, y: c.y, size: 8, font: fonts.sans, color: GOLD });

  return doc.save();
}
