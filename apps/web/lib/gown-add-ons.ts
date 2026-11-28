/**
 * 👗 gown-add-ons — the add-ons a bride may pick with her gown (DESIGN-REVIEW-v187 § D, owner 2026-11-27). A LEAF
 * module: it imports nothing, so lib/gown-config.ts (the bride's design, Builder A) and lib/gown-maker.ts (the shop's
 * price list, Builder B) can both read the one list without importing each other.
 *
 * Append-only: a stored design or price list must never name an id that is gone. No bows (owner: the v134 removal
 * stands). Each shop marks each one Priced · Included free · On request · Not offered (lib/gown-maker.ts).
 * 🔒 lib/gown-maker.test.ts
 */
export const GOWN_ADD_ONS = [
  { id: 'veil', label: 'Veil' },
  { id: 'cape', label: 'Cape or side cape' },
  { id: 'bolero', label: 'Bolero or shawl' },
  { id: 'detach_sleeves', label: 'Detachable sleeves' },
  { id: 'detach_overskirt', label: 'Detachable overskirt or train' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'petticoat', label: 'Petticoat' },
  { id: 'bustle', label: 'Bustle' },
  { id: 'headpiece', label: 'Headpiece or tiara' },
  { id: 'garter', label: 'Garter' },
  { id: 'bag', label: 'Bag, clutch or money-dance pouch' },
  { id: 'garment_bag', label: 'Garment bag and hanger' },
  { id: 'hanky', label: 'Hanky' },
  { id: 'robe', label: 'Robe' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'fittings', label: 'Fittings and alterations' },
] as const;
export type GownAddOnKey = (typeof GOWN_ADD_ONS)[number]['id'];
