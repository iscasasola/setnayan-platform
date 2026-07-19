/**
 * Per-type SPECIALTY CATALOG - the rich, culturally-grounded "signature fields"
 * each event type captures beyond the generic core (date/venue/pax/budget).
 *
 * Source of truth: the reconciled Filipino life-events culture catalog designed in
 * the event-specialty design workflow. This is the DATA layer for the rich per-type
 * onboarding (Track B) - it sits ABOVE the generic core and feeds the deterministic
 * engines (planner / save-the-date / reveal) + the Event Brief specialty layer
 * (persisted in events.signature_details, migration 20270728247263). Pure data +
 * pure loaders, no I/O, no LLM (Rule 1).
 *
 * Build-team rules baked in from the catalog cross-cutting notes:
 *  1. person_roster is load-bearing (principal sponsors / ninong-ninang / the 18s /
 *     court of honor) - NEVER hard-cap it; the renderer defaults to no limit.
 *  2. Person fields are substitution-tolerant (a father-FIGURE for the debut waltz);
 *     never validation-require a living/present parent.
 *  3. select/multiselect with an empty options[] = an open, user-authored set.
 *  4. terminology labels are customer-facing (Ninong/Ninang, Palabunutan, ...);
 *     the snake_case keys stay English + stable as the schema.
 *
 * This module is DATA ONLY - the renderer (multi-select / number / person_roster /
 * conditional kinds) and the persistence wiring are separate follow-on PRs. Landing
 * the catalog first gives every downstream PR one typed, validated source.
 */

/** The field-type vocabulary the renderer must support (superset of today's tiles). */
export type SpecialtyFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'number'
  | 'person_roster'
  | 'list';

export const SPECIALTY_FIELD_TYPES: readonly SpecialtyFieldType[] = [
  'text', 'textarea', 'date', 'select', 'multiselect', 'boolean', 'number', 'person_roster', 'list',
] as const;

/** A sub-field inside a person_roster / list repeatable row. */
export type SpecialtyItemField = {
  key: string;
  type: SpecialtyFieldType;
  options?: readonly string[];
  help?: string;
};

/** A single signature field on a type. options present for select/multiselect
 *  (empty = open set); item_fields present for person_roster / list. */
export type SpecialtyField = {
  key: string;
  label: string;
  type: SpecialtyFieldType;
  options?: readonly string[];
  help?: string;
  item_fields?: readonly SpecialtyItemField[];
  /** Conditional reveal (rite branching): show this field only when the field
   *  named `field` currently holds one of `equals` (a select string OR a value
   *  in a multiselect array). Absent = always shown. Honoured by the renderer +
   *  normaliser (a hidden field's value is not persisted). */
  show_when?: { field: string; equals: readonly string[] };
};

export type SpecialtySpec = {
  /** = event_type (1:1 with the Brief SPECIALTY_KIND_BY_TYPE). */
  type: string;
  label: string;
  /** Customer-facing terminology gloss (the "they get us" vocabulary). */
  terminology: string;
  /** The ONE detail that signals cultural fluency. */
  the_hook: string;
  /** Tone-deaf traps to avoid. */
  avoid: readonly string[];
  signature_fields: readonly SpecialtyField[];
};

/** The catalog, keyed by event_type. Concatenated from the per-type culture objects. */
export const SPECIALTY_CATALOG: Record<string, SpecialtySpec> = {
  "wedding": {
    "type": "wedding",
    "label": "Wedding (Kasal)",
    "terminology": "Ninong/Ninang = Principal Sponsors (lifelong patrons). Abay = entourage. Arrhae/arras = 13 unity coins. Yugal = cord. Pamamanhikan = family blessing visit.",
    "the_hook": "Uncapped Principal Sponsor (ninong/ninang) roster + a real love-story capture.",
    "avoid": [
      "Catholic-only assumption",
      "capping sponsors at 2",
      "calling sponsors mere witnesses",
      "assuming father-only walk"
    ],
    "signature_fields": [
      {
        "key": "partner_1_name",
        "label": "Partner 1",
        "type": "text"
      },
      {
        "key": "partner_2_name",
        "label": "Partner 2",
        "type": "text"
      },
      {
        "key": "love_story",
        "label": "Your love story",
        "type": "textarea",
        "help": "How you met — the story we build the whole experience around."
      },
      {
        "key": "how_we_met",
        "label": "How you met",
        "type": "text"
      },
      {
        "key": "proposal_story",
        "label": "The proposal",
        "type": "textarea"
      },
      {
        "key": "relationship_milestones",
        "label": "Milestones",
        "type": "list",
        "item_fields": [
          {
            "key": "milestone_date",
            "type": "date"
          },
          {
            "key": "milestone_label",
            "type": "text"
          }
        ],
        "help": "First date, engagement, etc."
      },
      {
        "key": "ceremony_rite",
        "label": "Ceremony rite",
        "type": "select",
        "options": [
          "catholic_mass",
          "christian",
          "civil",
          "muslim_nikah",
          "indigenous",
          "interfaith",
          "vow_renewal"
        ]
      },
      {
        "key": "officiant_and_church",
        "label": "Officiant / church or venue of rites",
        "type": "text"
      },
      {
        "key": "principal_sponsors",
        "label": "Principal Sponsors (Ninong & Ninang)",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "honorific",
            "type": "text",
            "help": "Atty., Dr., Hon., Sir/Ma'am"
          },
          {
            "key": "relationship",
            "type": "text"
          },
          {
            "key": "gender_role",
            "type": "select",
            "options": [
              "ninong",
              "ninang"
            ]
          }
        ],
        "help": "Add as many pairs as you have — no limit."
      },
      {
        "key": "secondary_sponsors",
        "label": "Secondary Sponsors",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "role",
            "type": "select",
            "options": [
              "candle",
              "veil",
              "cord_yugal"
            ]
          }
        ]
      },
      {
        "key": "principal_entourage",
        "label": "Principal entourage (Abay)",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "role",
            "type": "select",
            "options": [
              "best_man",
              "maid_of_honor",
              "matron_of_honor",
              "groomsman",
              "bridesmaid"
            ]
          }
        ]
      },
      {
        "key": "bearers_and_flower_children",
        "label": "Bearers & flower children",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "role",
            "type": "select",
            "options": [
              "ring_bearer",
              "arrhae_coin_bearer",
              "bible_bearer",
              "flower_girl",
              "banner_bearer"
            ]
          }
        ]
      },
      {
        "key": "unity_traditions",
        "label": "Traditions to include",
        "type": "multiselect",
        "options": [
          "arrhae_coins",
          "cord_yugal",
          "veil",
          "unity_candle",
          "money_dance",
          "dove_release",
          "wine_or_sand",
          "pamamanhikan"
        ]
      },
      {
        "key": "motif_colors",
        "label": "Motif / color palette",
        "type": "multiselect",
        "options": []
      },
      {
        "key": "wedding_theme_peg",
        "label": "Theme / peg",
        "type": "text"
      }
    ]
  },
  "debut": {
    "type": "debut",
    "label": "Debut (18th)",
    "terminology": "Debutante. 18 Roses (dances), 18 Candles (wishes), 18 Treasures (gifts). Cotillion = formal waltz. Motif = color peg.",
    "the_hook": "Father-daughter waltz partner with a father-figure substitution path + named 18 Roses/Candles/Treasures givers.",
    "avoid": [
      "framing as generic birthday",
      "requiring a present father",
      "assuming girls-only",
      "hard-locking to exactly 18"
    ],
    "signature_fields": [
      {
        "key": "debutante_name",
        "label": "Debutante",
        "type": "text"
      },
      {
        "key": "debut_variant",
        "label": "Debut style",
        "type": "select",
        "options": [
          "classic_18_female",
          "male_debut_18_shots",
          "intimate_9s",
          "21st_debut"
        ]
      },
      {
        "key": "motif_color",
        "label": "Motif / color peg",
        "type": "multiselect",
        "options": []
      },
      {
        "key": "theme_peg",
        "label": "Theme / peg",
        "type": "text",
        "help": "Enchanted garden, Parisian, Great Gatsby…"
      },
      {
        "key": "gown_designer",
        "label": "Gown / designer",
        "type": "text"
      },
      {
        "key": "eighteen_roses",
        "label": "18 Roses",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "relationship",
            "type": "text"
          },
          {
            "key": "dance_order",
            "type": "number"
          }
        ]
      },
      {
        "key": "eighteen_candles",
        "label": "18 Candles",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "relationship",
            "type": "text"
          },
          {
            "key": "message",
            "type": "textarea"
          }
        ]
      },
      {
        "key": "eighteen_treasures",
        "label": "18 Treasures",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "treasure_gift",
            "type": "text"
          }
        ]
      },
      {
        "key": "father_daughter_waltz",
        "label": "Father-daughter waltz partner",
        "type": "text",
        "help": "Father — or the father-figure who'll dance with you (lolo, tito, kuya)."
      },
      {
        "key": "cotillion",
        "label": "Cotillion / court of honor",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "pair_role",
            "type": "select",
            "options": [
              "escort",
              "lady",
              "muse"
            ]
          }
        ]
      },
      {
        "key": "grand_entrance_production",
        "label": "Grand entrance / production number",
        "type": "textarea"
      }
    ]
  },
  "christening": {
    "type": "christening",
    "label": "Christening (Binyag)",
    "terminology": "Binyag = baptism. Ninong/Ninang = godparents, Principal vs Secondary (padrino system). Kumpil = Confirmation. Handaan = the feast.",
    "the_hook": "Uncapped godparent roster with principal/secondary distinction — Filipino baptisms have dozens of ninong/ninang.",
    "avoid": [
      "capping godparents",
      "Catholic-only assumption",
      "skipping the handaan",
      "treating it as a generic baby event"
    ],
    "signature_fields": [
      {
        "key": "child_name",
        "label": "Child's name",
        "type": "text"
      },
      {
        "key": "child_birth_date",
        "label": "Date of birth",
        "type": "date"
      },
      {
        "key": "child_gender",
        "label": "Gender",
        "type": "select",
        "options": [
          "boy",
          "girl"
        ]
      },
      {
        "key": "rite_type",
        "label": "Rite",
        "type": "select",
        "options": [
          "catholic_baptism",
          "infant_dedication",
          "kumpil_confirmation",
          "combined_baptism_and_reception"
        ]
      },
      {
        "key": "officiant_parish",
        "label": "Officiant / parish",
        "type": "text"
      },
      {
        "key": "godparents_principal",
        "label": "Principal Godparents (Ninong & Ninang)",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "relationship",
            "type": "text"
          },
          {
            "key": "gender_role",
            "type": "select",
            "options": [
              "ninong",
              "ninang"
            ]
          }
        ],
        "help": "Add every principal sponsor — no limit."
      },
      {
        "key": "godparents_secondary",
        "label": "Secondary Godparents",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "relationship",
            "type": "text"
          },
          {
            "key": "gender_role",
            "type": "select",
            "options": [
              "ninong",
              "ninang"
            ]
          }
        ],
        "help": "Filipino binyag often has dozens — add as many as you have."
      },
      {
        "key": "christening_outfit",
        "label": "Christening gown / outfit",
        "type": "text"
      },
      {
        "key": "reception_handaan",
        "label": "Reception / handaan notes",
        "type": "textarea"
      }
    ]
  },
  "birthday": {
    "type": "birthday",
    "label": "Birthday (Kaarawan)",
    "terminology": "Milestone birthdays (1st, 7th, 60th, 80th, 100th). Palabunutan = guest raffle. Handaan/lechon = the feast. 'This Is Your Life' = retrospective.",
    "the_hook": "Milestone-aware: apo tribute + 'This Is Your Life' for 1st/elder milestones, plus organizing the palabunutan.",
    "avoid": [
      "one-size kiddie-party framing",
      "ignoring elder milestones",
      "missing the raffle/lechon culture"
    ],
    "signature_fields": [
      {
        "key": "celebrant_name",
        "label": "Celebrant",
        "type": "text"
      },
      {
        "key": "celebrant_age",
        "label": "Turning…",
        "type": "number"
      },
      {
        "key": "milestone_type",
        "label": "Milestone",
        "type": "select",
        "options": [
          "1st_birthday",
          "7th_birthday",
          "kids_regular",
          "18th_debut",
          "60th",
          "75th",
          "80th",
          "90th",
          "100th",
          "adult_regular"
        ]
      },
      {
        "key": "motif_theme",
        "label": "Motif / theme",
        "type": "text",
        "help": "Character peg for kids, color/era peg for adults."
      },
      {
        "key": "palabunutan",
        "label": "Palabunutan (guest raffle)",
        "type": "boolean"
      },
      {
        "key": "palabunutan_prizes",
        "label": "Raffle prizes",
        "type": "list",
        "item_fields": [
          {
            "key": "prize",
            "type": "text"
          }
        ]
      },
      {
        "key": "program_highlights",
        "label": "Program",
        "type": "multiselect",
        "options": [
          "this_is_your_life",
          "apo_grandchildren_tribute",
          "testimonials",
          "candle_blowing",
          "games",
          "production_number"
        ]
      },
      {
        "key": "handaan_centerpiece",
        "label": "Food centerpiece",
        "type": "text",
        "help": "Lechon, cake, etc."
      }
    ]
  },
  "gender_reveal": {
    "type": "gender_reveal",
    "label": "Gender Reveal",
    "terminology": "Reveal method, Team Boy vs Team Girl, the secret-keeper (who alone knows).",
    "the_hook": "A designated secret-keeper + Team Boy/Team Girl guessing game — built for suspense.",
    "avoid": [
      "over-traditionalizing an imported format",
      "conflating with binyag/baby shower",
      "heavy gender-essentialist copy"
    ],
    "signature_fields": [
      {
        "key": "parents_names",
        "label": "Parents-to-be",
        "type": "text"
      },
      {
        "key": "due_date",
        "label": "Due date",
        "type": "date"
      },
      {
        "key": "reveal_method",
        "label": "Reveal method",
        "type": "select",
        "options": [
          "cake_cut",
          "balloon_pop",
          "smoke_powder",
          "confetti_cannon",
          "pinata",
          "sports_ball",
          "box_release"
        ]
      },
      {
        "key": "guessing_game",
        "label": "Team Boy vs Team Girl game",
        "type": "boolean"
      },
      {
        "key": "secret_keeper",
        "label": "The secret-keeper",
        "type": "text",
        "help": "The one person who knows — OB, baker, or trusted friend."
      },
      {
        "key": "combined_with_baby_shower",
        "label": "Combine with baby shower?",
        "type": "boolean"
      },
      {
        "key": "motif",
        "label": "Motif",
        "type": "multiselect",
        "options": [
          "blue_pink",
          "he_or_she",
          "team_theme",
          "neutral"
        ]
      }
    ]
  },
  "anniversary": {
    "type": "anniversary",
    "label": "Anniversary (Anibersaryo)",
    "terminology": "Silver 25 / Ruby 40 / Golden 50 / Diamond 60. Renewal of vows = pag-renew ng panata.",
    "the_hook": "Golden anniversary: original wedding date + surviving sponsors + renewal of vows — a wedding reprise.",
    "avoid": [
      "treating a 50th as a small dinner",
      "assuming wedding-only anniversaries"
    ],
    "signature_fields": [
      {
        "key": "anniversary_type",
        "label": "Type",
        "type": "select",
        "options": [
          "wedding",
          "business",
          "foundation",
          "organization",
          "religious_ordination"
        ]
      },
      {
        "key": "celebrant_names",
        "label": "Couple / organization",
        "type": "text"
      },
      {
        "key": "years_celebrating",
        "label": "Years",
        "type": "number"
      },
      {
        "key": "milestone_name",
        "label": "Milestone",
        "type": "select",
        "options": [
          "silver_25",
          "pearl_30",
          "ruby_40",
          "golden_50",
          "diamond_60",
          "platinum_70",
          "other"
        ]
      },
      {
        "key": "original_event_date",
        "label": "Original date (wedding / founding)",
        "type": "date"
      },
      {
        "key": "renewal_of_vows",
        "label": "Renewal of vows",
        "type": "boolean"
      },
      {
        "key": "renewal_officiant",
        "label": "Renewal officiant / church",
        "type": "text"
      },
      {
        "key": "tribute_program",
        "label": "Tribute program",
        "type": "multiselect",
        "options": [
          "children_apo_tribute",
          "this_is_your_life",
          "surviving_sponsors_honored",
          "in_memoriam"
        ]
      }
    ]
  },
  "graduation": {
    "type": "graduation",
    "label": "Graduation (Pagtatapos)",
    "terminology": "Moving-up/promotion, board passer/topnotcher, honors (cum laude…), toga/sablay, salo-salo/blow-out, 'para sa magulang'.",
    "the_hook": "The dedication ('para kay…') to parents, plus board-passer/topnotcher as a real graduation tier.",
    "avoid": [
      "ignoring moving-up ceremonies",
      "not counting board-exam passers",
      "stripping out the family-sacrifice frame"
    ],
    "signature_fields": [
      {
        "key": "graduate_name",
        "label": "Graduate",
        "type": "text"
      },
      {
        "key": "school_alma_mater",
        "label": "School / alma mater",
        "type": "text"
      },
      {
        "key": "academic_level",
        "label": "Level",
        "type": "select",
        "options": [
          "moving_up_kinder",
          "elementary",
          "jhs",
          "shs",
          "college",
          "board_exam_passer",
          "bar_passer",
          "postgrad",
          "vocational_tesda"
        ]
      },
      {
        "key": "degree_course",
        "label": "Degree / course",
        "type": "text"
      },
      {
        "key": "honors_distinction",
        "label": "Honors / distinction",
        "type": "select",
        "options": [
          "none",
          "with_honors",
          "cum_laude",
          "magna_cum_laude",
          "summa_cum_laude",
          "valedictorian",
          "salutatorian",
          "topnotcher",
          "leadership_award"
        ]
      },
      {
        "key": "dedication_para_kay",
        "label": "Dedicated to (para kay…)",
        "type": "text",
        "help": "Who this achievement is for — usually the parents."
      },
      {
        "key": "celebration_type",
        "label": "How you'll celebrate",
        "type": "select",
        "options": [
          "salo_salo",
          "blow_out",
          "thanksgiving_mass",
          "intimate_family"
        ]
      }
    ]
  },
  "reunion": {
    "type": "reunion",
    "label": "Reunion",
    "terminology": "Clan reunion, batch/alumni homecoming, balikbayan (relative from abroad), reunion shirt, patriarch/matriarch, in-memoriam.",
    "the_hook": "Naming the balikbayan flying home + the matching reunion shirt + in-memoriam for those who've passed.",
    "avoid": [
      "generic-party framing",
      "missing patriarch/matriarch honoring",
      "ignoring the balikbayan driver"
    ],
    "signature_fields": [
      {
        "key": "reunion_type",
        "label": "Type",
        "type": "select",
        "options": [
          "family_clan",
          "batch_alumni",
          "school_homecoming",
          "fraternity_sorority_org",
          "town_fiesta_homecoming",
          "company"
        ]
      },
      {
        "key": "group_identity",
        "label": "Clan surname / batch year / alma mater",
        "type": "text"
      },
      {
        "key": "generations_or_batches",
        "label": "Generations / batches represented",
        "type": "list",
        "item_fields": [
          {
            "key": "label",
            "type": "text"
          }
        ]
      },
      {
        "key": "balikbayan_honorees",
        "label": "Balikbayan (coming from abroad)",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "coming_from",
            "type": "text"
          }
        ]
      },
      {
        "key": "patriarch_matriarch",
        "label": "Patriarch / matriarch honored",
        "type": "text"
      },
      {
        "key": "in_memoriam",
        "label": "In-memoriam",
        "type": "list",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          }
        ]
      },
      {
        "key": "reunion_shirt",
        "label": "Matching reunion shirt",
        "type": "text",
        "help": "Design / color theme."
      },
      {
        "key": "program_highlights",
        "label": "Program",
        "type": "multiselect",
        "options": [
          "parlor_games",
          "palabunutan",
          "ancestral_tribute",
          "family_tree_reveal",
          "talent_show",
          "thanksgiving_mass"
        ]
      }
    ]
  },
  "gala_night": {
    "type": "gala_night",
    "label": "Gala Night",
    "terminology": "Awards/fundraiser/society ball. Dress code incl. Filipiniana (barong/terno). Table sponsors. Guest of honor, honorees, beneficiary.",
    "the_hook": "Filipiniana (barong/terno) dress code + named table sponsorships.",
    "avoid": [
      "Western black-tie-only assumption",
      "ignoring table-selling economics"
    ],
    "signature_fields": [
      {
        "key": "gala_purpose",
        "label": "Purpose",
        "type": "select",
        "options": [
          "awards_night",
          "fundraiser_charity",
          "society_ball",
          "product_launch",
          "coronation",
          "grand_gala_dinner"
        ]
      },
      {
        "key": "dress_code_theme",
        "label": "Dress code / theme",
        "type": "select",
        "options": [
          "black_tie",
          "filipiniana",
          "masquerade",
          "red_carpet",
          "creative_theme"
        ]
      },
      {
        "key": "guest_of_honor",
        "label": "Guest of honor / keynote",
        "type": "text"
      },
      {
        "key": "honorees_awardees",
        "label": "Honorees / awardees",
        "type": "list",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "award",
            "type": "text"
          }
        ]
      },
      {
        "key": "table_sponsors",
        "label": "Table sponsors",
        "type": "list",
        "item_fields": [
          {
            "key": "sponsor_name",
            "type": "text"
          },
          {
            "key": "table_tier",
            "type": "text"
          }
        ]
      },
      {
        "key": "beneficiary_cause",
        "label": "Beneficiary / cause",
        "type": "text"
      },
      {
        "key": "program_flow",
        "label": "Program",
        "type": "multiselect",
        "options": [
          "awarding",
          "keynote",
          "production_number",
          "auction",
          "entertainment",
          "intermission_performers"
        ]
      }
    ]
  },
  "corporate": {
    "type": "corporate",
    "label": "Corporate Event",
    "terminology": "Christmas party (grand raffle + department production numbers), sportsfest, service awards, grand opening blessing (basbas) + ribbon cutting.",
    "the_hook": "Christmas-party raffle + department production numbers; for openings, the priest/pastor blessing (basbas) + ribbon cutting.",
    "avoid": [
      "generic Western-offsite framing",
      "skipping the raffle/production culture",
      "omitting the office blessing"
    ],
    "signature_fields": [
      {
        "key": "corporate_event_type",
        "label": "Event type",
        "type": "select",
        "options": [
          "christmas_party",
          "team_building",
          "product_launch",
          "conference_summit",
          "sportsfest",
          "company_anniversary",
          "grand_opening_blessing",
          "awarding_night",
          "general_assembly",
          "year_end_kickoff"
        ]
      },
      {
        "key": "company_name",
        "label": "Company / organization",
        "type": "text"
      },
      {
        "key": "department_or_unit",
        "label": "Department / unit",
        "type": "text"
      },
      {
        "key": "theme_motif",
        "label": "Theme / motif",
        "type": "text"
      },
      {
        "key": "program_highlights",
        "label": "Program",
        "type": "multiselect",
        "options": [
          "grand_raffle_major_prizes",
          "consuelo_de_bobo_prizes",
          "service_awards",
          "employee_of_the_year",
          "department_production_numbers",
          "games",
          "keynote",
          "team_building_activities"
        ]
      },
      {
        "key": "blessing_ceremony",
        "label": "Blessing + ribbon cutting (for openings)",
        "type": "boolean",
        "help": "Priest/pastor basbas before ribbon cutting."
      }
    ]
  },
  "tournament": {
    "type": "tournament",
    "label": "Tournament",
    "terminology": "Liga (league), muse / Muse of the League, opening parade, MVP, Mythical Five, barangay.",
    "the_hook": "Team muses + Muse of the League + the opening parade — the community layer of a Filipino liga.",
    "avoid": [
      "bare Western-bracket framing",
      "missing the muse/pageant layer",
      "ignoring the barangay-liga community"
    ],
    "signature_fields": [
      {
        "key": "sport_discipline",
        "label": "Sport / discipline",
        "type": "select",
        "options": [
          "basketball",
          "volleyball",
          "esports",
          "boxing",
          "billiards",
          "chess",
          "badminton",
          "running_fun_run",
          "pageant",
          "other"
        ]
      },
      {
        "key": "tournament_format",
        "label": "Format",
        "type": "select",
        "options": [
          "single_elimination",
          "double_elimination",
          "round_robin",
          "liga_season"
        ]
      },
      {
        "key": "divisions",
        "label": "Divisions / brackets",
        "type": "list",
        "item_fields": [
          {
            "key": "division",
            "type": "text",
            "help": "Men's / Women's / Mixed / age bracket"
          }
        ]
      },
      {
        "key": "teams",
        "label": "Teams",
        "type": "list",
        "item_fields": [
          {
            "key": "team_name",
            "type": "text"
          },
          {
            "key": "team_muse",
            "type": "text"
          }
        ]
      },
      {
        "key": "organizer_sponsor",
        "label": "Organizer / sponsor",
        "type": "text",
        "help": "Barangay, league, or company."
      },
      {
        "key": "opening_parade",
        "label": "Opening ceremony / parade",
        "type": "boolean"
      },
      {
        "key": "awards",
        "label": "Awards",
        "type": "multiselect",
        "options": [
          "mvp",
          "mythical_five",
          "champion",
          "runner_up",
          "sportsmanship",
          "muse_of_the_league",
          "best_in_uniform"
        ]
      }
    ]
  },
  "travel": {
    "type": "travel",
    "label": "Travel (Biyahe / Lakwatsa)",
    "terminology": "Barkada trip, ambag/hatian (shared kitty), treasurer, pasalubong, Visita Iglesia (pilgrimage), balikbayan homecoming.",
    "the_hook": "The shared kitty (ambag) with a named treasurer + a pasalubong list.",
    "avoid": [
      "assuming solo/luxury travel",
      "ignoring cost-splitting and role-sharing"
    ],
    "signature_fields": [
      {
        "key": "trip_type",
        "label": "Trip type",
        "type": "select",
        "options": [
          "barkada",
          "family_bonding",
          "honeymoon",
          "pilgrimage_visita_iglesia",
          "team_building",
          "balikbayan_homecoming",
          "solo"
        ]
      },
      {
        "key": "destinations",
        "label": "Destination(s)",
        "type": "list",
        "item_fields": [
          {
            "key": "place",
            "type": "text"
          }
        ]
      },
      {
        "key": "travel_dates",
        "label": "Travel dates",
        "type": "text"
      },
      {
        "key": "travelers",
        "label": "Travelers",
        "type": "person_roster",
        "item_fields": [
          {
            "key": "name",
            "type": "text"
          },
          {
            "key": "role",
            "type": "select",
            "options": [
              "organizer",
              "treasurer",
              "member"
            ]
          }
        ]
      },
      {
        "key": "shared_budget_ambag",
        "label": "Shared kitty (ambag) per head",
        "type": "number"
      },
      {
        "key": "pasalubong_list",
        "label": "Pasalubong list",
        "type": "list",
        "item_fields": [
          {
            "key": "item",
            "type": "text"
          },
          {
            "key": "for_whom",
            "type": "text"
          }
        ]
      },
      {
        "key": "itinerary_highlights",
        "label": "Itinerary highlights",
        "type": "textarea"
      }
    ]
  },
  "celebration": {
    "type": "celebration",
    "label": "Celebration (Salu-salo)",
    "terminology": "Pasasalamat (thanksgiving), despedida (farewell), welcome/homecoming, house blessing (basbas), promotion.",
    "the_hook": "Pasasalamat (thanksgiving) and despedida (send-off) as first-class occasions.",
    "avoid": [
      "forcing a religious frame",
      "over-structuring a loose gathering"
    ],
    "signature_fields": [
      {
        "key": "occasion_reason",
        "label": "What we're celebrating",
        "type": "select",
        "options": [
          "thanksgiving_pasasalamat",
          "despedida_farewell",
          "welcome_homecoming",
          "promotion",
          "house_blessing",
          "healing_recovery",
          "achievement",
          "just_because"
        ]
      },
      {
        "key": "guest_of_honor",
        "label": "Guest of honor / celebrant",
        "type": "text"
      },
      {
        "key": "occasion_note",
        "label": "A little about the occasion",
        "type": "textarea"
      },
      {
        "key": "blessing_or_program",
        "label": "Blessing / short program",
        "type": "boolean"
      }
    ]
  },
  "simple_event": {
    "type": "simple_event",
    "label": "Simple Event",
    "terminology": "Salu-salo / small handaan — a casual get-together.",
    "the_hook": "Not over-asking — a genuinely light, one-tap path.",
    "avoid": [
      "forcing elaborate fields",
      "treating simplicity as incompleteness"
    ],
    "signature_fields": [
      {
        "key": "occasion_label",
        "label": "What's the occasion?",
        "type": "text"
      },
      {
        "key": "host_name",
        "label": "Host",
        "type": "text"
      },
      {
        "key": "vibe",
        "label": "Vibe",
        "type": "select",
        "options": [
          "casual",
          "intimate",
          "formal"
        ]
      },
      {
        "key": "notes",
        "label": "Notes",
        "type": "textarea"
      }
    ]
  }
};

/** The specialty spec for an event type, or null when the type declares none. */
export function getSpecialtySpec(eventType: string | null | undefined): SpecialtySpec | null {
  if (!eventType) return null;
  return SPECIALTY_CATALOG[eventType] ?? null;
}

/** The signature fields for an event type ([] when unknown/none). */
export function getSpecialtyFields(
  eventType: string | null | undefined,
): readonly SpecialtyField[] {
  return getSpecialtySpec(eventType)?.signature_fields ?? [];
}
