/**
 * ADMIN HELP SLOT H8 — admin areas A18–A28 — Catalogue, Insights, the avatar menu. INTERNAL: for the Setnayan team, never the public.
 *
 * Owned by ONE answer-writing session (H8); no other session edits this file.
 * Covers: the catalogue (categories, pricing, price bands, add-ons, songs, hub music, colours, menus) · insights (funnels, growth, insights, intelligence, demand, app performance) · the avatar menu (settings, secrets, integrations, website, SEO).
 * Where those live: app/admin (categories, pricing, price-bands, addons, songs, hub-music, colours, menus, funnels, growth, insights, intelligence, demand, app-performance, settings, secrets, integrations, website, seo).
 *
 * ⛔ Behind the same wall as lib/help-admin.ts: only lib/help-admin.ts may import
 * this file, and only app/admin/** may import that
 * (lib/public-help-says-what-is-true.test.ts). Never import it from lib/help.ts.
 * Every slug is globally unique across lib/help/ and lib/help-admin/
 * (lib/help-slugs-are-unique.test.ts).
 */
import type { AdminHelpTopic } from '@/lib/help-admin';

export const ADMIN_2_TOPICS: AdminHelpTopic[] = [];
