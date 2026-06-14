/**
 * Minimal ambient types for opentype.js (no @types package published).
 * Declares only the surface lib/lockup-pdf.ts uses: parse(), Font.getPath /
 * getAdvanceWidth, and Path.commands / toPathData / getBoundingBox.
 */
declare module 'opentype.js' {
  export interface PathCommand {
    type: 'M' | 'L' | 'C' | 'Q' | 'Z';
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }

  export interface Path {
    commands: PathCommand[];
    toPathData(decimalPlaces?: number): string;
    getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
  }

  export interface Font {
    unitsPerEm: number;
    getPath(text: string, x: number, y: number, fontSize: number): Path;
    getAdvanceWidth(text: string, fontSize: number): number;
  }

  export function parse(buffer: ArrayBuffer): Font;

  const _default: { parse: typeof parse };
  export default _default;
}
