/**
 * Minimal ambient types for opentype.js (no @types package published).
 * Declares only the surface lib/glyph-path.ts uses: parse(), Font.getPath /
 * getAdvanceWidth, and Path.commands / toPathData / getBoundingBox.
 *
 * ⛔ THERE IS NO DEFAULT EXPORT, AND THIS FILE USED TO CLAIM THERE WAS.
 * opentype.js@2 ships `dist/opentype.mjs` with NAMED exports only, and that is
 * the build webpack picks for the server bundle via the package's `module`
 * field. The invented default export it used to declare made
 * `import opentype from 'opentype.js'` typecheck everywhere while evaluating to
 * UNDEFINED in every deployed lambda — and `tsx` hid it completely, because it
 * resolves the CJS `main` and synthesises a default from module.exports.
 *
 * 🔑 A HAND-WRITTEN AMBIENT TYPE IS A CLAIM ABOUT SOMEBODY ELSE'S RUNTIME, and
 * nothing checks it. This one cost the QR monogram a merged, deployed, green
 * release that served the bare code on every request, and it is why
 * lib/lockup-pdf.ts's lockup badge could never have drawn in production either.
 * Import the NAMED `parse`.
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
}

/**
 * The ESM build a bundler resolves via the package's `module` field — declared
 * only so lib/the-saved-code-carries-the-mark.test.ts can import the exact file
 * webpack uses and assert its REAL shape, rather than trusting the block above.
 */
declare module 'opentype.js/dist/opentype.mjs' {
  export function parse(buffer: ArrayBuffer): unknown;
}
