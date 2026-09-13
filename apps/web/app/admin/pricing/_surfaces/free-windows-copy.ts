/**
 * Flash copy for the free-window / vendor-deal creator, shared by the two
 * surfaces that post to `createFreeWindow`: the Catalog Studio tab
 * (/admin/pricing?tab=free-windows) and the Deals section of /admin/gifts.
 * Plain module (no 'use server') so both can import a constant.
 */
export const FREE_WINDOW_CREATE_ERROR_COPY: Record<string, string> = {
  title: 'Give the announcement a title.',
  skus: 'Pick at least one service to make free.',
  starts: 'Set a valid start date and time.',
  ends: 'Set a valid end date and time.',
  order: 'The end must be after the start.',
  event_date_order: 'The "through" event date must be on or after the "only for events dated" date.',
  tier: 'Pick which paid plan the vendors get for free.',
  audience: 'That audience is not built yet — pick all verified vendors, or the registers-and-verifies cohort.',
  length: 'Deal length must be a whole number of days, 1 to 365.',
  reason: 'Say why (at least 10 characters) — it is logged with the deal.',
  db: 'Could not save the free window. Please try again.',
};
