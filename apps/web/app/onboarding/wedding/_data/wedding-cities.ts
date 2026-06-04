/* Curated wedding cities + Top-30 carousel order. Ported from the onboarding
   prototype (owner 2026-06-04). The 30 keys in TOP30 each carry a real photo
   (public/onboarding/cities/{k}.webp) + a wedding nugget. */
export type WeddingCity = { k: string; n: string; r: string; rk: string; lat: number; lon: number; top?: number; nug?: string };
export const CITIES: WeddingCity[] = [
      {k:'tagaytay',n:'Tagaytay',r:'Cavite · CALABARZON',rk:'calabarzon',lat:14.106,lon:120.962,top:1,nug:'Cool-climate gardens & ridges over Taal — the metro’s favorite weekend wedding escape.'},
      {k:'cebu',n:'Cebu City',r:'Cebu · Central Visayas',rk:'c-visayas',lat:10.316,lon:123.886,top:2,nug:'Heritage-church vows at the Basilica, paired with island-resort receptions.'},
      {k:'boracay',n:'Boracay',r:'Aklan · Western Visayas',rk:'w-visayas',lat:11.969,lon:121.925,top:3,nug:'Barefoot sunset ceremonies on White Beach — the country’s beach-wedding icon.'},
      {k:'elnido',n:'El Nido',r:'Palawan · MIMAROPA',rk:'mimaropa',lat:11.196,lon:119.398,top:4,nug:'Island-hopping destination weddings on hidden lagoons and limestone coves.'},
      {k:'baguio',n:'Baguio',r:'Benguet · CAR',rk:'car',lat:16.402,lon:120.596,top:5,nug:'Pine-scented gardens and cool weather all year for an intimate highland wedding.'},
      {k:'nasugbu',n:'Nasugbu',r:'Batangas · CALABARZON',rk:'calabarzon',lat:14.067,lon:120.632,top:6,nug:'Calatagan & Nasugbu beach resorts, an easy drive south of Manila.'},
      {k:'panglao',n:'Panglao',r:'Bohol · Central Visayas',rk:'c-visayas',lat:9.578,lon:123.749,top:7,nug:'White-sand beach vows near the Chocolate Hills and old stone churches.'},
      {k:'manila',n:'Manila',r:'Metro Manila · NCR',rk:'ncr',lat:14.599,lon:120.984,top:8,nug:'Intramuros grandeur — San Agustín Church and historic walled-city receptions.'},
      {k:'makati',n:'Makati',r:'Metro Manila · NCR',rk:'ncr',lat:14.554,lon:121.025,top:9,nug:'Skyline rooftops and five-star ballrooms for a polished city wedding.'},
      {k:'vigan',n:'Vigan',r:'Ilocos Sur · Ilocos',rk:'ilocos',lat:17.575,lon:120.387,top:10,nug:'Spanish-colonial romance along cobblestone Calle Crisologo.'},
      // ── the rest of the searchable set ──
      {k:'quezon-city',n:'Quezon City',r:'Metro Manila · NCR',rk:'ncr',lat:14.676,lon:121.044,nug:'Grand cathedrals and hotel ballrooms — the metro’s biggest church capacities.'},
      {k:'taguig',n:'Taguig · BGC',r:'Metro Manila · NCR',rk:'ncr',lat:14.517,lon:121.050,nug:'BGC’s modern skyline venues and rooftop receptions.'},
      {k:'pasig',n:'Pasig',r:'Metro Manila · NCR',rk:'ncr',lat:14.576,lon:121.085},
      {k:'pasay',n:'Pasay',r:'Metro Manila · NCR',rk:'ncr',lat:14.538,lon:120.997},
      {k:'mandaluyong',n:'Mandaluyong',r:'Metro Manila · NCR',rk:'ncr',lat:14.577,lon:121.034},
      {k:'paranaque',n:'Parañaque',r:'Metro Manila · NCR',rk:'ncr',lat:14.479,lon:121.020},
      {k:'muntinlupa',n:'Muntinlupa · Alabang',r:'Metro Manila · NCR',rk:'ncr',lat:14.408,lon:121.042},
      {k:'marikina',n:'Marikina',r:'Metro Manila · NCR',rk:'ncr',lat:14.650,lon:121.102},
      {k:'caloocan',n:'Caloocan',r:'Metro Manila · NCR',rk:'ncr',lat:14.651,lon:120.972},
      {k:'antipolo',n:'Antipolo',r:'Rizal · CALABARZON',rk:'calabarzon',lat:14.624,lon:121.176,nug:'Hilltop chapels and garden venues with a view over the metro.'},
      {k:'batangas',n:'Batangas City',r:'Batangas · CALABARZON',rk:'calabarzon',lat:13.756,lon:121.058},
      {k:'lipa',n:'Lipa',r:'Batangas · CALABARZON',rk:'calabarzon',lat:13.941,lon:121.163},
      {k:'calamba',n:'Calamba',r:'Laguna · CALABARZON',rk:'calabarzon',lat:14.213,lon:121.165},
      {k:'sta-rosa',n:'Santa Rosa',r:'Laguna · CALABARZON',rk:'calabarzon',lat:14.312,lon:121.111},
      {k:'dasma',n:'Dasmariñas',r:'Cavite · CALABARZON',rk:'calabarzon',lat:14.329,lon:120.937},
      {k:'bacoor',n:'Bacoor',r:'Cavite · CALABARZON',rk:'calabarzon',lat:14.459,lon:120.959},
      {k:'lucena',n:'Lucena',r:'Quezon · CALABARZON',rk:'calabarzon',lat:13.931,lon:121.617},
      {k:'mactan',n:'Lapu-Lapu · Mactan',r:'Cebu · Central Visayas',rk:'c-visayas',lat:10.310,lon:123.982,nug:'Island resorts off Cebu — beachfront ceremonies a causeway from the city.'},
      {k:'mandaue',n:'Mandaue',r:'Cebu · Central Visayas',rk:'c-visayas',lat:10.323,lon:123.922},
      {k:'bohol',n:'Tagbilaran · Bohol',r:'Bohol · Central Visayas',rk:'c-visayas',lat:9.647,lon:123.855,nug:'Gateway to Panglao’s beaches and the Chocolate Hills.'},
      {k:'dumaguete',n:'Dumaguete',r:'Negros Oriental · C. Visayas',rk:'c-visayas',lat:9.307,lon:123.308,nug:'The gentle seaside ‘City of Gentle People’ — campus-town charm.'},
      {k:'iloilo',n:'Iloilo City',r:'Iloilo · Western Visayas',rk:'w-visayas',lat:10.720,lon:122.562,nug:'Heritage churches (Molo · Miag-ao) and warm Ilonggo feasts.'},
      {k:'bacolod',n:'Bacolod',r:'Negros Occidental · W. Visayas',rk:'w-visayas',lat:10.640,lon:122.969,nug:'MassKara warmth — garden and sugar-baron heritage-house weddings.'},
      {k:'kalibo',n:'Kalibo',r:'Aklan · Western Visayas',rk:'w-visayas',lat:11.706,lon:122.366},
      {k:'roxas',n:'Roxas · Capiz',r:'Capiz · Western Visayas',rk:'w-visayas',lat:11.585,lon:122.751},
      {k:'launion',n:'San Fernando · La Union',r:'La Union · Ilocos',rk:'ilocos',lat:16.615,lon:120.319,nug:'Surf-coast sunsets up north — relaxed beach weddings in La Union.'},
      {k:'laoag',n:'Laoag',r:'Ilocos Norte · Ilocos',rk:'ilocos',lat:18.197,lon:120.594},
      {k:'dagupan',n:'Dagupan',r:'Pangasinan · Ilocos',rk:'ilocos',lat:16.043,lon:120.333},
      {k:'pampanga',n:'San Fernando · Pampanga',r:'Pampanga · Central Luzon',rk:'c-luzon',lat:15.034,lon:120.689},
      {k:'clark',n:'Angeles · Clark',r:'Pampanga · Central Luzon',rk:'c-luzon',lat:15.168,lon:120.586,nug:'Clark’s hotels and hangar-sized venues near the international airport.'},
      {k:'subic',n:'Subic',r:'Zambales · Central Luzon',rk:'c-luzon',lat:14.788,lon:120.282,nug:'Bayside resorts and freeport venues, two hours from Manila.'},
      {k:'olongapo',n:'Olongapo',r:'Zambales · Central Luzon',rk:'c-luzon',lat:14.829,lon:120.282},
      {k:'malolos',n:'Malolos · Bulacan',r:'Bulacan · Central Luzon',rk:'c-luzon',lat:14.844,lon:120.811},
      {k:'tarlac',n:'Tarlac City',r:'Tarlac · Central Luzon',rk:'c-luzon',lat:15.488,lon:120.588},
      {k:'tuguegarao',n:'Tuguegarao',r:'Cagayan · Cagayan Valley',rk:'cagayan-valley',lat:17.613,lon:121.727},
      {k:'santiago',n:'Santiago · Isabela',r:'Isabela · Cagayan Valley',rk:'cagayan-valley',lat:16.687,lon:121.548},
      {k:'naga',n:'Naga',r:'Camarines Sur · Bicol',rk:'bicol',lat:13.619,lon:123.181,nug:'Pilgrim-city churches and Mt. Isarog garden venues.'},
      {k:'legazpi',n:'Legazpi',r:'Albay · Bicol',rk:'bicol',lat:13.139,lon:123.733,nug:'Weddings framed by the perfect cone of Mayon Volcano.'},
      {k:'palawan',n:'Puerto Princesa',r:'Palawan · MIMAROPA',rk:'mimaropa',lat:9.739,lon:118.734,nug:'Underground-river country — beach and garden venues in Palawan’s capital.'},
      {k:'davao',n:'Davao City',r:'Davao del Sur · Davao',rk:'davao',lat:7.190,lon:125.455,nug:'Garden estates and Samal-island resorts in the south’s biggest city.'},
      {k:'tagum',n:'Tagum',r:'Davao del Norte · Davao',rk:'davao',lat:7.448,lon:125.808},
      {k:'cdo',n:'Cagayan de Oro',r:'Misamis Oriental · N. Mindanao',rk:'n-mindanao',lat:8.482,lon:124.647,nug:'River-adventure city with riverside and hotel venues.'},
      {k:'camiguin',n:'Camiguin',r:'Camiguin · N. Mindanao',rk:'n-mindanao',lat:9.173,lon:124.730},
      {k:'iligan',n:'Iligan',r:'Lanao del Norte · N. Mindanao',rk:'n-mindanao',lat:8.228,lon:124.245},
      {k:'gensan',n:'General Santos',r:'South Cotabato · SOCCSKSARGEN',rk:'soccsksargen',lat:6.113,lon:125.171},
      {k:'cotabato',n:'Cotabato City',r:'Maguindanao · BARMM',rk:'barmm',lat:7.223,lon:124.247},
      {k:'zamboanga',n:'Zamboanga City',r:'Zamboanga del Sur · Zamboanga',rk:'zamboanga',lat:6.921,lon:122.079,nug:'‘Asia’s Latin City’ — Spanish-flavored heritage weddings.'},
      {k:'dipolog',n:'Dipolog',r:'Zamboanga del Norte · Zamboanga',rk:'zamboanga',lat:8.589,lon:123.341},
      {k:'siargao',n:'Siargao · Gen. Luna',r:'Surigao del Norte · Caraga',rk:'caraga',lat:9.787,lon:126.162,nug:'Surf-town beach weddings — laid-back, barefoot, island-cool.'},
      {k:'butuan',n:'Butuan',r:'Agusan del Norte · Caraga',rk:'caraga',lat:8.948,lon:125.540},
      {k:'tacloban',n:'Tacloban',r:'Leyte · Eastern Visayas',rk:'e-visayas',lat:11.244,lon:125.004},
      {k:'ormoc',n:'Ormoc',r:'Leyte · Eastern Visayas',rk:'e-visayas',lat:11.006,lon:124.608},
      // ── notable destinations / islands (still a representative slice — production has the full PSGC list) ──
      {k:'batanes',n:'Basco · Batanes',r:'Batanes · Cagayan Valley',rk:'cagayan-valley',lat:20.448,lon:121.970,nug:'Rolling hills, stone houses and cliff-edge chapels — the country’s northern frontier.'},
      {k:'coron',n:'Coron',r:'Palawan · MIMAROPA',rk:'mimaropa',lat:12.005,lon:120.204,nug:'Limestone lagoons and shipwreck-blue water for an island-bound wedding.'},
      {k:'puerto-galera',n:'Puerto Galera',r:'Or. Mindoro · MIMAROPA',rk:'mimaropa',lat:13.503,lon:120.954,nug:'White-beach coves a short crossing from Batangas.'},
      {k:'sagada',n:'Sagada',r:'Mountain Province · CAR',rk:'car',lat:17.083,lon:120.900,nug:'Pine highlands and hanging-cliff drama for an offbeat mountain wedding.'},
      {k:'siquijor',n:'Siquijor',r:'Siquijor · Central Visayas',rk:'c-visayas',lat:9.214,lon:123.515,nug:'Mystic-island beaches and old churches under century-old trees.'},
      {k:'bantayan',n:'Bantayan Island',r:'Cebu · Central Visayas',rk:'c-visayas',lat:11.170,lon:123.722,nug:'Powder-white sandbars off northern Cebu.'},
      {k:'calatagan',n:'Calatagan',r:'Batangas · CALABARZON',rk:'calabarzon',lat:13.833,lon:120.632,nug:'Resort beaches and seaside chapels at Batangas’ western tip.'},
      {k:'caramoan',n:'Caramoan',r:'Camarines Sur · Bicol',rk:'bicol',lat:13.770,lon:123.862,nug:'Dramatic limestone islets for a castaway-chic celebration.'},
      {k:'baler',n:'Baler',r:'Aurora · Central Luzon',rk:'c-luzon',lat:15.759,lon:121.563,nug:'Surf-coast Pacific sunrises on the east shore.'},
      {k:'sorsogon',n:'Sorsogon City',r:'Sorsogon · Bicol',rk:'bicol',lat:12.973,lon:124.007}
];

/* The 30 cities with a real photo — the carousel, in rank order (owner "do top 30"). */
export const TOP30: string[] = ['tagaytay','cebu','boracay','elnido','baguio','nasugbu','panglao','manila','makati','vigan','quezon-city','taguig','davao','iloilo','bacolod','palawan','coron','siargao','dumaguete','bohol','mactan','subic','launion','clark','calatagan','antipolo','cdo','siquijor','legazpi','sagada'];

const _byKey: Record<string, WeddingCity> = Object.fromEntries(CITIES.map((c) => [c.k, c]));
export const cityByKey = (k: string): WeddingCity | undefined => _byKey[k];

/* Region centroid (lat,lon) — fallback coords for a long-tail PSGC place picked from search. */
export const REGION_CENTROID: Record<string, [number, number]> = { ncr: [14.58, 121.0], car: [16.9, 120.9], ilocos: [17.4, 120.5], 'cagayan-valley': [17.3, 121.8], 'c-luzon': [15.3, 120.6], calabarzon: [14.2, 121.3], mimaropa: [12.0, 120.8], bicol: [13.4, 123.4], 'w-visayas': [10.9, 122.6], 'c-visayas': [10.0, 123.6], 'e-visayas': [11.4, 124.9], zamboanga: [7.8, 122.5], 'n-mindanao': [8.3, 124.7], davao: [7.1, 125.6], soccsksargen: [6.3, 124.8], caraga: [9.2, 125.8], barmm: [6.5, 122.0] };

export const normPlace = (s: string): string => (s || '').toLowerCase().replace(/city/g, '').replace(/[^a-z0-9]/g, '');

/* straight-line distance (haversine, km) for the "nearest to you" sort */
export const kmBetween = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLon = ((b.lon - a.lon) * Math.PI) / 180,
    s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
};
