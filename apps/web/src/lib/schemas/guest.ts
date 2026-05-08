/**
 * Zod schemas for guest CRUD. Used both client-side (form validation in
 * add-guest dialog and CSV import) and server-side (server actions).
 *
 * Per work order 0001: validation must happen on both sides.
 */

import { z } from "zod";
import {
  GROUP_CATEGORIES,
  MEAL_PREFERENCES,
  RSVP_STATUSES,
  SCHEDULE_BLOCKS,
  WEDDING_ROLES,
  WEDDING_SIDES,
} from "@/lib/db/types";

// Reusable atoms
const nameField = z
  .string()
  .trim()
  .min(1, "Required")
  .max(80, "Too long");

const optionalString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalLongString = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const emailField = z
  .string()
  .trim()
  .email("Invalid email")
  .optional()
  .or(z.literal("").transform(() => undefined));

const phoneField = z
  .string()
  .trim()
  .regex(/^[+\d\s().-]{0,30}$/u, "Invalid phone")
  .optional()
  .or(z.literal("").transform(() => undefined));

const tagsField = z
  .array(z.string().trim().min(1).max(40))
  .max(20, "Max 20 tags")
  .default([]);

// Guest base schema — shared by add + edit. Server-side fills event_id.
export const guestInputSchema = z.object({
  first_name: nameField,
  last_name: nameField,
  display_name: optionalString,
  side: z.enum(WEDDING_SIDES),
  group_category: z.enum(GROUP_CATEGORIES),
  role: z.enum(WEDDING_ROLES).default("guest"),
  plus_one_allowed: z.boolean().default(false),
  plus_one_name: optionalString,
  email: emailField,
  mobile: phoneField,
  meal_preference: z.enum(MEAL_PREFERENCES).optional(),
  dietary_restrictions: optionalLongString,
  photo_consent: z.boolean().default(true),
  invited_to_blocks: z
    .array(z.enum(SCHEDULE_BLOCKS))
    .min(1, "Invite to at least one block")
    .default(["ceremony", "reception"]),
  custom_tags: tagsField,
  household_id: z.string().uuid().nullable().optional(),
  notes: optionalLongString,
  rsvp_status: z.enum(RSVP_STATUSES).default("pending"),
});

export type GuestInput = z.infer<typeof guestInputSchema>;

// Add-guest form: same as input.
export const addGuestSchema = guestInputSchema;

// Edit-guest form: all optional except guest_id.
export const editGuestSchema = guestInputSchema.partial().extend({
  guest_id: z.string().uuid(),
});

export type EditGuestInput = z.infer<typeof editGuestSchema>;

// CSV row schema — minimum required columns. Forgiving on optional fields.
export const csvRowSchema = z.object({
  first_name: nameField,
  last_name: nameField,
  side: z.enum(WEDDING_SIDES),
  group_category: z.enum(GROUP_CATEGORIES),
  role: z.enum(WEDDING_ROLES).default("guest"),
  household: optionalString,
  plus_one_allowed: z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === "boolean") return v;
      const s = v.trim().toLowerCase();
      return s === "true" || s === "yes" || s === "y" || s === "1";
    })
    .default(false),
  email: emailField,
  mobile: phoneField,
});

export type CsvRow = z.infer<typeof csvRowSchema>;
