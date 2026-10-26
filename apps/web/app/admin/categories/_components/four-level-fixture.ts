/**
 * four-level-fixture.ts — a small slice of the live taxonomy for the four-level map's unit tests (labels as
 * prod holds them, 2026-10-26 export behind the approved prototype). Test data only: nothing ships it.
 * The two cards are LABELLED as fixtures — real data only in the product.
 */
import type { MapData } from './four-level-model';

export const FIXTURE: MapData = {
  groups: [
    { id: 'venue', label: 'Venues & churches', iconName: 'Building2', hidden: false },
    { id: 'look', label: 'Attire, hair & make-up', iconName: 'Shirt', hidden: false },
  ],
  categories: [
    { id: 'reception', groupId: 'venue', label: 'Reception', hidden: false, iconName: null, coarse: 'venue' },
    { id: 'ceremony', groupId: 'venue', label: 'Ceremony', hidden: false, iconName: null, coarse: 'church' },
    { id: 'grooms_attire', groupId: 'look', label: "Groom's Attire", hidden: false, iconName: null, coarse: 'attire' },
    { id: 'filipiniana_barongs', groupId: 'look', label: 'Filipiniana & Barongs', hidden: false, iconName: null, coarse: null },
  ],
  services: [
    { key: 'events_place', label: 'Events Place', tileId: 'reception', hidden: false, cards: 0 },
    { key: 'function_hall', label: 'Function Hall', tileId: 'reception', hidden: false, cards: 2 },
    { key: 'hotel_ballroom', label: 'Hotel Ballroom', tileId: 'reception', hidden: false, cards: 0 },
    { key: 'church', label: 'Church', tileId: 'ceremony', hidden: false, cards: 0 },
    { key: 'groom_suit_rental', label: 'Groom Suit Rental', tileId: 'grooms_attire', hidden: false, cards: 0 },
    { key: 'barong_tagalog_custom', label: 'Barong Tagalog (custom)', tileId: 'grooms_attire', hidden: false, cards: 0 },
  ],
  parts: [
    { key: 'overall', label: 'Venue & decor', home: 'reception', services: ['events_place', 'function_hall', 'hotel_ballroom', 'church'], hidden: false },
    { key: 'reception_venue', label: 'Reception venue', home: 'reception', services: ['events_place', 'function_hall', 'hotel_ballroom'], hidden: false },
    { key: 'groom', label: 'Groom’s attire', home: 'grooms_attire', services: ['groom_suit_rental', 'barong_tagalog_custom'], hidden: false },
    { key: 'entourage', label: 'Entourage attire', home: 'grooms_attire', services: [], hidden: true },
  ],
  cards: [
    { id: 'fx-1', title: '(fixture) Grand ballroom', price: 150000, active: true, service: 'function_hall', shopId: 'fx', shopName: 'Fixture shop', shopPublic: true, photoUrl: null },
    { id: 'fx-2', title: '(fixture) Garden hall', price: 85000, active: true, service: 'function_hall', shopId: 'fx2', shopName: 'Fixture shop 2', shopPublic: false, photoUrl: null },
  ],
  partsRead: true,
  cardsRead: true,
};
