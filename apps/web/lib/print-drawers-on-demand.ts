/**
 * lib/print-drawers-on-demand.ts — THE HEAVY PRINT DRAWERS, LOADED WHEN A FILE ASKS FOR THEM.
 *
 * ⚡ Speed pass 2026-11-18: a cold `/api/hub-print/invitation` took 5.2 s on live c1f9e2f. The Maker's previews are SVG
 * (`renderPrintSvg`, light), yet the route imported the PDF writer (`lib/print-render-pdf.ts` → pdf-lib) and the JPEG
 * rasteriser (`lib/print-sample-raster.ts` → sharp) at module load — evaluated on every cold start, for every preview.
 *
 * Each export here is the SAME function, with the same signature, the same bytes and the same errors; it only imports its
 * module the first time it is called (then Node's module cache holds it). Nothing is drawn differently.
 *
 * 🔒 Fenced by `lib/hub-print-loads-heavy-drawers-on-demand.test.ts`: the route may not import either module statically.
 */
import 'server-only';

type Pdf = typeof import('@/lib/print-render-pdf');
type Raster = typeof import('@/lib/print-sample-raster');

const pdf = (): Promise<Pdf> => import('@/lib/print-render-pdf');
const raster = (): Promise<Raster> => import('@/lib/print-sample-raster');

export const renderPrintPdf: Pdf['renderPrintPdf'] = async (...args) => (await pdf()).renderPrintPdf(...args);
export const renderImposedPdf: Pdf['renderImposedPdf'] = async (...args) => (await pdf()).renderImposedPdf(...args);
export const renderPrintBook: Pdf['renderPrintBook'] = async (...args) => (await pdf()).renderPrintBook(...args);
export const renderSampleJpeg: Raster['renderSampleJpeg'] = async (...args) => (await raster()).renderSampleJpeg(...args);
export const renderSampleSheetJpeg: Raster['renderSampleSheetJpeg'] = async (...args) => (await raster()).renderSampleSheetJpeg(...args);
