// Shared grid templates for the /admin/pricing editor so each row aligns with
// its desktop column-header strip. Plain module (no 'use client') so both the
// server page (ColHeader) and the client row components can import it.

export const RETAIL_GRID =
  'md:grid md:grid-cols-[minmax(0,1fr)_7rem_8rem_4.5rem_3.5rem] md:items-center md:gap-3';
export const TWOCOL_GRID =
  'md:grid md:grid-cols-[minmax(0,1fr)_8rem_3.5rem] md:items-center md:gap-3';
