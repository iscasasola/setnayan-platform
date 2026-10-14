/**
 * lib/attire-figures.ts — THE ATTIRE FIGURES' ARTWORK, AND NOTHING ELSE.
 *
 * Owner 2026-10-14 (DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"): *"the sample person … that shows the palette for
 * that role is still a basic shape. need to improve the look"* — illustrated figures with colour slots, the garment
 * following Wear ▾, "Not said yet" a dotted silhouette.
 *
 * 🎨 THE ARTWORK IS A SEAM (controller 2026-10-14): the owner asked for more elegant, classy figures and a designer is
 * redrawing them. Everything that DRAWS a person — the Studio's Attire blocks and the guest's dress code, through ONE
 * component (`app/_components/role-figure.tsx` ← `lib/role-figure.ts`) — reaches the drawings only through this file's
 * three exports: `figureArt` (one person's markup), `FIGURE_BOX` (its box) and `GARMENT_FOR` (which garment a style is
 * drawn as, per person). The final drawings replace `figureArt`'s body; nothing else moves.
 *
 * TODAY'S DRAWINGS ARE PLACEHOLDERS: the approved prototype's `figSvg()` (`maker_effects_and_attire_2026-10-14_fable.html`),
 * ported line for line, with its four colour slots — `--main` (with a deeper and a lighter cut of it) · `--accent` ·
 * `--skin` · `--hair` — written as the slot's own colour into each fill, so an `<img>` of it is exact on every browser
 * (a CSS variable inside a presentation attribute is not trusted on every engine).
 *
 * Pure strings, no DOM, no React.
 */
import type { AttireStyle } from './role-dress-code';

/** Who a figure is: a woman, a man, a girl or a boy. */
export type FigureWho = 'f' | 'm' | 'girl' | 'boy';
/** What the figure wears. `unset` — the dotted silhouette ("Not said yet": no outfit is ever assumed). */
export type FigureGarment =
  | 'gown'
  | 'terno'
  | 'cocktail'
  | 'midi'
  | 'pantsuit'
  | 'barongf'
  | 'barong'
  | 'suit'
  | 'tux'
  | 'shirt'
  | 'dress'
  | 'barongb'
  | 'suitb'
  | 'unset';

/** The colour slots one figure wears. `accent` absent = the main lifted toward white. */
export type FigureSlots = { main: string; accent?: string | null; skin?: string; hair?: string };

export const FIGURE_SKIN = '#D8B48F';
export const FIGURE_HAIR = '#2A1C15';
const UNSET_STROKE = '#8E8880';

/** One figure's box, in its own units: an adult stands 300 tall, a child 240, both 120 wide. */
export const FIGURE_BOX = { w: 120, adult: 300, child: 240 } as const;
export const figureIsChild = (who: FigureWho) => who === 'boy' || who === 'girl';

/** Style × who → the garment drawn (the prototype's `GARMENT`). Every style is drawable for everyone. */
export const GARMENT_FOR: Readonly<Record<FigureWho, Readonly<Record<AttireStyle, FigureGarment>>>> = {
  f: { long_gown: 'gown', cocktail_dress: 'cocktail', filipiniana: 'terno', barong_tagalog: 'barongf', suit: 'pantsuit', formal: 'gown', smart_casual: 'midi' },
  m: { barong_tagalog: 'barong', suit: 'suit', formal: 'tux', smart_casual: 'shirt', long_gown: 'suit', cocktail_dress: 'suit', filipiniana: 'barong' },
  girl: { cocktail_dress: 'dress', filipiniana: 'dress', long_gown: 'dress', formal: 'dress', smart_casual: 'dress', suit: 'dress', barong_tagalog: 'dress' },
  boy: { barong_tagalog: 'barongb', suit: 'suitb', formal: 'suitb', smart_casual: 'suitb', filipiniana: 'barongb', long_gown: 'suitb', cocktail_dress: 'suitb' },
};

/** The style list as one Wear ▾ shows it to this person — the fitting ones first (the prototype's `ORDER`). ONE vocabulary. */
export const STYLE_ORDER: Readonly<Record<FigureWho, readonly AttireStyle[]>> = {
  f: ['long_gown', 'filipiniana', 'cocktail_dress', 'formal', 'smart_casual', 'suit', 'barong_tagalog'],
  m: ['barong_tagalog', 'suit', 'formal', 'smart_casual', 'filipiniana', 'long_gown', 'cocktail_dress'],
  girl: ['cocktail_dress', 'filipiniana', 'long_gown', 'formal', 'smart_casual', 'suit', 'barong_tagalog'],
  boy: ['barong_tagalog', 'suit', 'formal', 'smart_casual', 'filipiniana', 'long_gown', 'cocktail_dress'],
};

/** The garment a style is drawn as for this person — the silhouette when nothing is said. */
export function garmentFor(who: FigureWho, style: AttireStyle | null | undefined): FigureGarment {
  return style ? GARMENT_FOR[who][style] : 'unset';
}

const HEX = /^#[0-9a-fA-F]{6}$/;
function rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
function shadeBy(h: string, amt: number): string {
  const [r, g, b] = rgb(h);
  return hex(r + amt, g + amt, b + amt);
}
function mixTo(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/**
 * ONE PERSON'S MARKUP — everything inside an `<svg viewBox="0 0 120 {300|240}">`, standing on its own shadow, in the
 * slots' exact colours. The placeholder drawings: the prototype's `figSvg`, ported.
 */
export function figureArt(who: FigureWho, garment: FigureGarment, slots: FigureSlots): string {
  const main = HEX.test(slots.main) ? slots.main.toUpperCase() : '#9B9B9B';
  const d = shadeBy(main, -26);
  const l = shadeBy(main, 26);
  const acc = slots.accent && HEX.test(slots.accent) ? slots.accent.toUpperCase() : mixTo(main, '#FFFFFF', 0.35);
  const skin = slots.skin && HEX.test(slots.skin) ? slots.skin : FIGURE_SKIN;
  const hair = slots.hair && HEX.test(slots.hair) ? slots.hair : FIGURE_HAIR;
  const H = figureIsChild(who) ? FIGURE_BOX.child : FIGURE_BOX.adult;
  const parts: string[] = [];
  const floor=H-8;
  parts.push(`<ellipse cx="60" cy="${floor}" rx="${who==='boy'||who==='girl'?34:42}" ry="4" fill="rgba(0,0,0,.12)"/>`);
  if(garment==='unset'){
    const sil=who==='m'||who==='boy'?`M60 ${who==='boy'?18:18} m-13 16 a13 16 0 1 0 26 0 a13 16 0 1 0 -26 0 M34 66 C44 58 76 58 86 66 L90 152 L78 152 L80 ${floor-4} L62 ${floor-4} L60 200 L58 ${floor-4} L40 ${floor-4} L42 152 L30 152 Z`
      :`M60 18 m-13 16 a13 16 0 1 0 26 0 a13 16 0 1 0 -26 0 M43 66 C50 60 70 60 77 66 L79 104 C90 160 98 230 102 ${floor-2} L18 ${floor-2} C22 230 30 160 41 104 Z`;
    parts.push(`<path d="${sil}" fill="none" stroke="${UNSET_STROKE}" stroke-width="1.6" stroke-dasharray="4 4" opacity=".8"/>`);
    return parts.join('');
  }
  const female=who==='f'||who==='girl', child=who==='boy'||who==='girl';
  /* hair behind */
  if(female)parts.push(`<ellipse cx="${child?60:71}" cy="${child?30:46}" rx="${child?17:7}" ry="${child?16:6}" fill="${hair}"/>`);
  /* body by garment (drawn before the head, which sits on top) */
  
  if(female&&!child){
    parts.push(`<path d="M44 64 C36 90 34 118 38 150 C40 153 45 153 46 150 C44 118 46 94 52 70Z" fill="${skin}"/><path d="M76 64 C84 90 86 118 82 150 C80 153 75 153 74 150 C76 118 74 94 68 70Z" fill="${skin}"/>`);
    parts.push(`<path d="M44 62 C50 57 70 57 76 62 L77 86 L43 86Z" fill="${skin}"/>`);
  }
  if(garment==='gown'||garment==='terno'||garment==='cocktail'||garment==='midi'||garment==='barongf'){
    const skirt=({gown:`M41 104 C32 160 24 230 20 ${floor} L100 ${floor} C96 230 88 160 79 104 C70 110 50 110 41 104Z`,
      terno:`M41 104 C36 160 34 230 36 ${floor} L84 ${floor} C86 230 84 160 79 104 C70 110 50 110 41 104Z`,
      barongf:`M41 104 C37 160 35 230 36 ${floor} L84 ${floor} C85 230 83 160 79 104 C70 110 50 110 41 104Z`,
      cocktail:`M41 104 C36 140 31 170 29 192 L91 192 C89 170 84 140 79 104 C70 110 50 110 41 104Z`,
      midi:`M41 104 C36 150 32 200 31 232 L89 232 C88 200 84 150 79 104 C70 110 50 110 41 104Z`} as Record<string,string>)[garment]!;
    const hem=({gown:floor,terno:floor,barongf:floor,cocktail:192,midi:232} as Record<string,number>)[garment]!;
    if(hem<floor){/* legs + shoes */
      parts.push(`<path d="M46 ${hem-2} L44 ${floor-8} L54 ${floor-8} L58 ${hem+10} L62 ${floor-8} L72 ${floor-8} L74 ${hem-2}Z" fill="${skin}"/>`);
      parts.push(`<path d="M43 ${floor-9} L55 ${floor-9} L56 ${floor-2} L41 ${floor-2}Z M61 ${floor-9} L73 ${floor-9} L75 ${floor-2} L60 ${floor-2}Z" fill="${hair}"/>`);
    }
    const skirtFill=garment==='barongf'?'${d}':'${main}';
    parts.push(`<path d="${skirt}" fill="${skirtFill}"/>`);
    /* form: a shadow on the right, a highlight fold on the left */
    parts.push(`<path d="M60 106 C58 170 55 240 54 ${hem} L${garment==='gown'?100:garment==='cocktail'?91:garment==='midi'?89:84} ${hem} C${garment==='gown'?96:garment==='cocktail'?89:garment==='midi'?88:86} 230 88 160 79 104 C73 108 66 109 60 106Z" fill="rgba(0,0,0,.10)"/>`);
    parts.push(`<path d="M49 112 C45 170 41 235 39 ${hem-4}" stroke="rgba(255,255,255,.22)" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    /* bodice */
    if(garment==='terno'){
      parts.push(`<path d="M42 64 C50 60 70 60 78 64 L79 104 C70 110 50 110 41 104Z" fill="${main}"/><path d="M50 64 C55 76 65 76 70 64Z" fill="${skin}"/>`);
      parts.push(`<path d="M44 66 C30 54 24 72 33 84 C38 88 44 85 46 78Z" fill="${main}"/><path d="M76 66 C90 54 96 72 87 84 C82 88 76 85 74 78Z" fill="${main}"/>`);
      parts.push(`<path d="M44 68 C36 62 32 72 36 80 C39 83 43 80 44 76Z" fill="rgba(255,255,255,.2)"/><path d="M76 68 C84 62 88 72 84 80 C81 83 77 80 76 76Z" fill="rgba(255,255,255,.2)"/>`);
      parts.push(`<path d="M41 100 C50 106 70 106 79 100 L79 108 C70 114 50 114 41 108Z" fill="${acc}"/>`);
    }else if(garment==='barongf'){
      parts.push(`<path d="M42 64 C50 60 70 60 78 64 L79 112 C70 116 50 116 41 112Z" fill="#FBF8F2"/><path d="M42 64 C50 60 70 60 78 64 L79 112 C70 116 50 116 41 112Z" fill="${main}" opacity=".55"/>`);
      parts.push(`<path d="M53 62 L60 74 L67 62 L64 62 L60 68 L56 62Z" fill="#FBF8F2"/><path d="M56 76 V108 M60 76 V108 M64 76 V108" stroke="${acc}" stroke-width=".8" stroke-dasharray="2 2"/>`);
    }else if(garment==='midi'){
      parts.push(`<path d="M40 64 C50 59 70 59 80 64 L80 74 L40 74Z" fill="${main}"/><path d="M43 72 C48 68 56 72 60 74 C64 72 72 68 77 72 L79 104 C70 110 50 110 41 104Z" fill="${main}"/>`);
      parts.push(`<path d="M41 100 C50 106 70 106 79 100 L79 106 C70 112 50 112 41 106Z" fill="${acc}"/>`);
    }else{
      parts.push(`<path d="M43 78 C48 70 56 75 60 77 C64 75 72 70 77 78 L79 104 C70 110 50 110 41 104Z" fill="${main}"/>`);
      parts.push(`<path d="M41 100 C50 106 70 106 79 100 L79 108 C70 114 50 114 41 108Z" fill="${acc}"/>`);
    }
  }
  if(garment==='pantsuit'){
    parts.push(`<path d="M44 150 L41 ${floor-4} L57 ${floor-4} L60 200 L63 ${floor-4} L79 ${floor-4} L76 150Z" fill="${d}"/>`);
    parts.push(`<path d="M39 ${floor-5} L58 ${floor-5} L58 ${floor-1} L37 ${floor-1}Z M62 ${floor-5} L81 ${floor-5} L83 ${floor-1} L62 ${floor-1}Z" fill="#1A1816"/>`);
    parts.push(`<path d="M50 62 L60 108 L70 62Z" fill="#F7F3EC"/><path d="M38 66 C46 59 50 59 52 62 L60 108 L68 62 C70 59 74 59 82 66 L85 150 L35 150Z" fill="${main}"/>`);
    parts.push(`<path d="M52 62 L60 108 L56 100 L49 72Z M68 62 L60 108 L64 100 L71 72Z" fill="rgba(0,0,0,.16)"/><path d="M60 108 L68 62 C70 59 74 59 82 66 L85 150 L60 150Z" fill="rgba(0,0,0,.08)"/>`);
    parts.push(`<rect x="37" y="144" width="8" height="11" rx="4" fill="${skin}"/><rect x="75" y="144" width="8" height="11" rx="4" fill="${skin}"/>`);
    parts.push(`<path d="M44 62 C50 57 70 57 76 62 L76 72 L44 72Z" fill="${skin}"/>`);
  }
  if(garment==='suit'||garment==='tux'||garment==='shirt'||garment==='barong'){
    const trous=garment==='barong'?'#2A2622':garment==='shirt'?'#4A4138':'${d}';
    parts.push(`<path d="M42 150 L39 ${floor-4} L57 ${floor-4} L60 200 L63 ${floor-4} L81 ${floor-4} L78 150Z" fill="${trous}"/>`);
    parts.push(`<path d="M37 ${floor-5} L58 ${floor-5} L58 ${floor-1} L35 ${floor-1}Z M62 ${floor-5} L83 ${floor-5} L85 ${floor-1} L62 ${floor-1}Z" fill="#1A1816"/>`);
    if(garment==='barong'){
      parts.push(`<path d="M36 64 C46 58 74 58 84 64 L86 160 L34 160Z" fill="#FBF8F2"/><path d="M36 64 C46 58 74 58 84 64 L86 160 L34 160Z" fill="${main}" opacity=".82"/>`);
      parts.push(`<path d="M60 70 L86 160 L60 160Z" fill="rgba(0,0,0,.06)"/>`);
      parts.push(`<rect x="54" y="72" width="12" height="84" fill="rgba(255,255,255,.14)"/><path d="M56 76 V152 M60 76 V152 M64 76 V152" stroke="${acc}" stroke-width=".9" stroke-dasharray="2.5 2" opacity=".95"/>`);
      parts.push(`<circle cx="60" cy="84" r="1.4" fill="${acc}"/><circle cx="60" cy="100" r="1.4" fill="${acc}"/><circle cx="60" cy="116" r="1.4" fill="${acc}"/><circle cx="60" cy="132" r="1.4" fill="${acc}"/>`);
      parts.push(`<path d="M53 60 L60 72 L67 60 L64 60 L60 66 L56 60Z" fill="#FBF8F2"/>`);
      parts.push(`<rect x="36" y="152" width="9" height="12" rx="4" fill="${skin}"/><rect x="75" y="152" width="9" height="12" rx="4" fill="${skin}"/>`);
    }else if(garment==='shirt'){
      parts.push(`<path d="M36 64 C46 58 74 58 84 64 L86 150 L34 150Z" fill="${main}"/><path d="M60 68 L86 150 L60 150Z" fill="rgba(0,0,0,.08)"/>`);
      parts.push(`<path d="M52 58 L60 72 L68 58 L72 62 L60 78 L48 62Z" fill="${l}"/><path d="M55 60 L60 70 L65 60Z" fill="${skin}"/>`);
      parts.push(`<path d="M60 78 V146" stroke="rgba(0,0,0,.14)" stroke-width="1"/><rect x="36" y="142" width="9" height="12" rx="4" fill="${skin}"/><rect x="75" y="142" width="9" height="12" rx="4" fill="${skin}"/>`);
    }else{
      parts.push(`<path d="M48 60 L60 112 L72 60Z" fill="#F7F3EC"/>`);
      parts.push(`<path d="M32 66 C42 58 50 58 52 60 L60 112 L68 60 C70 58 78 58 88 66 L90 150 L30 150Z" fill="${main}"/>`);
      parts.push(`<path d="M60 112 L68 60 C70 58 78 58 88 66 L90 150 L60 150Z" fill="rgba(0,0,0,.08)"/>`);
      if(garment==='tux'){
        parts.push(`<path d="M52 60 L60 112 L55 100 L46 68 Z M68 60 L60 112 L65 100 L74 68Z" fill="${l}" opacity=".9"/>`);
        parts.push(`<path d="M54 64 L60 67 L66 64 L66 70 L60 67 L54 70Z" fill="${acc}"/><rect x="58.5" y="64" width="3" height="6" rx="1" fill="${acc}"/>`);
      }else{
        parts.push(`<path d="M52 60 L60 112 L56 104 L49 70Z M68 60 L60 112 L64 104 L71 70Z" fill="rgba(0,0,0,.18)"/>`);
        parts.push(`<path d="M57 66 L63 66 L64 108 L60 114 L56 108Z" fill="${acc}"/><rect x="57" y="62" width="6" height="5" rx="1" fill="${acc}"/>`);
        parts.push(`<rect x="77" y="80" width="7" height="3" fill="${acc}"/>`);
      }
      parts.push(`<path d="M52 58 L60 66 L68 58 L66 63 L60 71 L54 63Z" fill="#F7F3EC"/>`);
      parts.push(`<rect x="33" y="144" width="9" height="12" rx="4" fill="${skin}"/><rect x="78" y="144" width="9" height="12" rx="4" fill="${skin}"/>`);
    }
    parts.push(`<path d="M53 48 L67 48 L68 62 L52 62Z" fill="${skin}"/>`);
  }
  if(garment==='dress'){/* flower girl */
    parts.push(`<path d="M47 168 L45 ${floor-8} L55 ${floor-8} L58 180 L61 ${floor-8} L71 ${floor-8} L69 168Z" fill="${skin}"/>`);
    parts.push(`<path d="M44 ${floor-9} L56 ${floor-9} L57 ${floor-3} L42 ${floor-3}Z M60 ${floor-9} L72 ${floor-9} L74 ${floor-3} L59 ${floor-3}Z" fill="${hair}"/>`);
    parts.push(`<path d="M42 64 C34 80 32 100 36 118 L40 118 C38 100 40 84 46 70Z" fill="${skin}"/><path d="M78 64 C86 80 88 100 84 118 L80 118 C82 100 80 84 74 70Z" fill="${skin}"/>`);
    parts.push(`<path d="M40 100 C28 128 24 158 24 170 L96 170 C96 158 92 128 80 100Z" fill="${main}"/><path d="M60 102 C58 130 56 160 56 170 L96 170 C96 158 92 128 80 100Z" fill="rgba(0,0,0,.09)"/>`);
    parts.push(`<path d="M42 62 C50 58 70 58 78 62 L80 102 L40 102Z" fill="${main}"/><path d="M52 62 C55 70 65 70 68 62Z" fill="${skin}"/>`);
    parts.push(`<path d="M40 98 L80 98 L80 106 L40 106Z" fill="${acc}"/><circle cx="60" cy="102" r="4" fill="${acc}" stroke="rgba(0,0,0,.12)"/>`);
    parts.push(`<path d="M54 48 L66 48 L67 62 L53 62Z" fill="${skin}"/>`);
  }
  if(garment==='barongb'||garment==='suitb'){/* ring bearer */
    const trous=garment==='barongb'?'#2A2622':'${d}';
    parts.push(`<path d="M44 128 L42 ${floor-6} L57 ${floor-6} L60 170 L63 ${floor-6} L78 ${floor-6} L76 128Z" fill="${trous}"/>`);
    parts.push(`<path d="M40 ${floor-7} L58 ${floor-7} L58 ${floor-2} L38 ${floor-2}Z M62 ${floor-7} L80 ${floor-7} L82 ${floor-2} L62 ${floor-2}Z" fill="#1A1816"/>`);
    if(garment==='barongb'){
      parts.push(`<path d="M38 62 C48 58 72 58 82 62 L84 134 L36 134Z" fill="#FBF8F2"/><path d="M38 62 C48 58 72 58 82 62 L84 134 L36 134Z" fill="${main}" opacity=".82"/>`);
      parts.push(`<rect x="55" y="68" width="10" height="62" fill="rgba(255,255,255,.14)"/><path d="M57 72 V126 M60 72 V126 M63 72 V126" stroke="${acc}" stroke-width=".8" stroke-dasharray="2 2"/><path d="M54 60 L60 70 L66 60 L64 60 L60 65 L56 60Z" fill="#FBF8F2"/>`);
    }else{
      parts.push(`<path d="M50 60 L60 100 L70 60Z" fill="#F7F3EC"/><path d="M36 64 C46 58 52 58 52 60 L60 100 L68 60 C68 58 74 58 84 64 L86 134 L34 134Z" fill="${main}"/><path d="M57 64 L63 64 L63 92 L60 98 L57 92Z" fill="${acc}"/>`);
    }
    parts.push(`<rect x="36" y="128" width="8" height="10" rx="4" fill="${skin}"/><rect x="76" y="128" width="8" height="10" rx="4" fill="${skin}"/>`);
    parts.push(`<path d="M54 46 L66 46 L67 60 L53 60Z" fill="${skin}"/>`);
  }
  /* neck (adult women) and head */
  if(female&&!child)parts.push(`<path d="M54 46 L66 46 L67 62 L53 62Z" fill="${skin}"/><path d="M54 46 Q60 53 66 46 L66 51 Q60 57 54 51Z" fill="rgba(0,0,0,.08)"/>`);
  else parts.push(`<path d="M54 46 Q60 52 66 46 L66 50 Q60 55 54 50Z" fill="rgba(0,0,0,.08)"/>`);
  const hr=child?15:13,hy=child?17:16;
  parts.push(`<ellipse cx="60" cy="${child?32:34}" rx="${hr}" ry="${hy}" fill="${skin}"/>`);
  if(female)parts.push(child?`<path d="M45 30 C45 12 75 12 75 30 C70 22 50 22 45 30Z" fill="${hair}"/>`:`<path d="M47 32 C48 17 72 17 73 32 C69 25 63 23 60 23 C57 23 51 25 47 32Z" fill="${hair}"/>`);
  else parts.push(child?`<path d="M45 32 C45 14 75 14 75 32 C75 26 68 20 60 20 C52 20 45 26 45 32Z" fill="${hair}"/>`:`<path d="M47 33 C47 16 73 16 73 33 C73 27 66 22 60 22 C54 22 47 27 47 33Z" fill="${hair}"/>`);

  return parts.join('');
}
