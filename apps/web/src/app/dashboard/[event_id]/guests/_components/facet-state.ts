/**
 * Facet state for the left rail. A user can be in exactly one facet view at a
 * time (sidebar selection), and orthogonally toggle multiple custom tags.
 */

import type { GroupCategory, RoleFamily, WeddingRole } from "@/lib/db/types";

export type FacetKey =
  | { kind: "all" }
  | { kind: "family"; value: RoleFamily }
  | { kind: "role"; value: WeddingRole }
  | { kind: "secondary_sponsors" }
  | { kind: "group"; value: GroupCategory }
  | { kind: "household"; value: string }
  | { kind: "block"; value: string };

export type FacetState = FacetKey;

export const DEFAULT_FACET: FacetState = { kind: "all" };
