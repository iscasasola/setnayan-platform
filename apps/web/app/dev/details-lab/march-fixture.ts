/**
 * The Maker lab's Wedding March (DEV-ONLY, `/dev/maker-lab?tool=details&item=march`)
 * — maria-and-jose's couple (Maria Santos · Jose Dela Cruz, read-only from
 * production 2026-10-06: guest rows with role bride / groom and no walk yet)
 * with an entourage of the size and titles a real one has (the prototype's
 * names). Built by the REAL builder, so the lab draws exactly what the Maker
 * would: `buildEntourage(…, { march: true })` → `marchSections`. (The honour
 * pair here is a best_man; a best_woman stands in the same column and walks the
 * same way — `honour`'s sides in lib/entourage.ts.)
 */
import { buildEntourage, type EntourageGuestRow } from '@/lib/entourage';
import { marchSections, marchTray, printedSectionOrder } from '@/lib/march-sections';
import { ownerShapedMarch } from '@/lib/march-owner-shape.fixture';

type Row = [id: string, prefix: string | null, first: string, last: string, role: string, walk?: number, place?: number];

const ROWS: Row[] = [
  ['jose', null, 'Jose', 'Dela Cruz', 'groom'],
  ['maria', null, 'Maria', 'Santos', 'bride'],
  ['p1', 'Mr.', 'Peregrino', 'Dela Cruz', 'groom_parents', 0, 0],
  ['p2', 'Mrs.', 'Milagros', 'Dela Cruz', 'groom_parents', 0, 1],
  ['p3', 'Dr.', 'Eduardo', 'Santos', 'bride_parents', 30, 1],
  ['p4', 'Mrs.', 'Lourdes Reyes', 'Santos', 'bride_parents', 30, 0],
  ['p5', 'Mr.', 'Fidel', 'Santos', 'bride_immediate_family', 2, 0],
  ['p6', 'Ms.', 'Carmen', 'Reyes', 'bride_immediate_family', 2, 1],
  ['p7', 'Mr.', 'Noel', 'Dela Cruz', 'groom_immediate_family', 3, 0],
  ['p10', 'Ms.', 'Ana Reyes', 'Dela Cruz', 'maid_of_honor', 4, 1],
  ['p11', 'Mr.', 'Daniel', 'Ramos', 'best_man', 4, 0],
  ['p12', 'Hon.', 'Ricardo', 'Villahermosa', 'principal_sponsor_ninong', 5, 0],
  ['p13', 'Mrs.', 'Jessica', 'Villahermosa', 'principal_sponsor_ninang', 5, 1],
  ['p14', 'Atty.', 'Cesar', 'Lim', 'principal_sponsor_ninong', 6, 0],
  ['p15', 'Mrs.', 'Pilar', 'Lim', 'principal_sponsor_ninang', 6, 1],
  ['p16', 'USec.', 'Rolando', 'Mendoza', 'principal_sponsor_ninong', 7, 0],
  ['p17', 'Mrs.', 'Nora', 'Mendoza', 'principal_sponsor_ninang', 7, 1],
  ['p18', 'Dr.', 'Ben', 'Ocampo', 'principal_sponsor_ninong', 8, 0],
  ['p19', 'Dr.', 'Amy', 'Ocampo', 'principal_sponsor_ninang', 8, 1],
  ['p20', 'Engr.', 'Lito', 'Mendoza', 'principal_sponsor_ninong', 9, 0],
  ['p22', 'Hon.', 'Teodoro', 'Santos', 'principal_sponsor_ninong', 10, 0],
  ['p23', 'Atty.', 'Eufrocina', 'Magsaysay', 'principal_sponsor_ninang', 10, 1],
  ['p24', 'Mr.', 'Paolo', 'Tan', 'candle_sponsor', 11, 0],
  ['p25', 'Ms.', 'Ivy', 'Tan', 'candle_sponsor', 11, 1],
  ['p26', 'Mr.', 'Karl', 'Lim', 'veil_sponsor', 12, 0],
  ['p27', 'Ms.', 'Rina', 'Chua', 'veil_sponsor', 12, 1],
  ['p28', 'Mr.', 'Ryan', 'Gomez', 'cord_sponsor', 13, 0],
  ['p29', 'Ms.', 'Liza', 'Gomez', 'cord_sponsor', 13, 1],
  ['p36', 'Mr.', 'Dennis', 'Alvarez', 'groomsman', 14, 1],
  ['p37', 'Ms.', 'Joy', 'Alvarez', 'bridesmaid', 14, 0],
  ['p38', 'Mr.', 'Vince', 'Ong', 'groomsman', 15],
  ['p30', null, 'Joaquin', 'Dela Cruz', 'ring_bearer', 16],
  ['p31', null, 'Enzo', 'Santos', 'coin_bearer', 17],
  ['p32', null, 'Lucas', 'Reyes', 'bible_bearer', 18],
  ['p33', null, 'Sofia', 'Reyes', 'flower_girl', 19, 0],
  ['p34', null, 'Amara', 'Lim', 'flower_girl', 19, 1],
  ['p35', null, 'Isabel', 'Ocampo', 'flower_girl', 20],
];

/** 🚶 Not walking in the lab (the tray): a groomsman, a flower girl, a principal sponsor. */
const LAB_OUT = new Set(['p38', 'p35', 'p20']);
/** Their guest side, as a couple would have set it — the aisle side follows it (`walkSideOf`). */
const sideOf = (role: string): string => (role.startsWith('groom') ? 'groom' : role.startsWith('bride') ? 'bride' : 'both');

/**
 * `?march=owner` — a march the shape of the owner's own event (45 walks · 80
 * walking, `lib/march-owner-shape.fixture.ts`) with six people in the tray;
 * otherwise maria-and-jose's couple + entourage with three.
 */
export function labMarchSections(shape?: string | null) {
  const rows: EntourageGuestRow[] =
    shape === 'owner'
      ? ownerShapedMarch().map((r, i) => ({ ...r, side: sideOf(r.role ?? ''), ...(i % 13 === 7 ? { not_walking: true } : {}) }))
      : ROWS.map(([id, prefix, first, last, role, walk, place]) => ({
          guest_id: id,
          name_prefix: prefix,
          first_name: first,
          last_name: last,
          role,
          side: sideOf(role),
          extra_roles: [],
          march: typeof walk === 'number' && !LAB_OUT.has(id) ? { walk_no: walk, place_in_walk: place ?? 0 } : null,
          ...(LAB_OUT.has(id) ? { not_walking: true } : {}),
        }));
  const style = shape === 'owner' ? 'surname-first' : undefined;
  const walking = buildEntourage(rows.filter((r) => !r.not_walking), null, {}, style, { march: true });
  const out = buildEntourage(rows.filter((r) => r.not_walking), null, {}, style, { march: true });
  return { sections: marchSections(walking), printed: printedSectionOrder([...walking, ...out], null), out: marchTray(out) };
}
