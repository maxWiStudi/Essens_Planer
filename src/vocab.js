// Shared vocabulary for recipes, settings and the planner.

export const MEALS = ['fruehstueck', 'mittag', 'abend']
export const MEAL_LABEL = { fruehstueck: 'Frühstück', mittag: 'Mittagessen', abend: 'Abendessen' }
export const MAIN_MEALS = ['mittag', 'abend']

// Strictest first: a vegan recipe fits every diet, an omni recipe only omni.
export const DIETS = ['vegan', 'vegetarisch', 'pescetarisch', 'omni']
export const DIET_LABEL = {
  vegan: 'Vegan',
  vegetarisch: 'Vegetarisch',
  pescetarisch: 'Pescetarisch',
  omni: 'Alles',
}

export const PROTEINS = [
  'gefluegel', 'rind', 'schwein', 'fisch', 'meeresfruechte',
  'huelsenfruechte', 'ei', 'tofu', 'milchprodukt', 'nuesse', 'keins',
]
export const PROTEIN_LABEL = {
  gefluegel: 'Geflügel', rind: 'Rind', schwein: 'Schwein', fisch: 'Fisch',
  meeresfruechte: 'Meeresfrüchte', huelsenfruechte: 'Hülsenfrüchte', ei: 'Ei',
  tofu: 'Tofu', milchprodukt: 'Milchprodukte', nuesse: 'Nüsse & Saaten', keins: '–',
}
export const MEAT = new Set(['gefluegel', 'rind', 'schwein'])
export const SEAFOOD = new Set(['fisch', 'meeresfruechte'])

export const BASES = ['kartoffel', 'reis', 'nudeln', 'brot', 'getreide', 'keins']
export const BASE_LABEL = {
  kartoffel: 'Kartoffeln', reis: 'Reis', nudeln: 'Nudeln', brot: 'Brot',
  getreide: 'Getreide', keins: '–',
}

export const STYLES = ['pfanne', 'ofen', 'eintopf', 'suppe', 'salat', 'bowl', 'auflauf', 'kalt', 'gebaeck']

export const ALLERGENS = ['gluten', 'laktose', 'ei', 'nuesse', 'erdnuss', 'soja', 'fisch', 'krebstiere', 'sellerie', 'senf', 'sesam']
export const ALLERGEN_LABEL = {
  gluten: 'Gluten', laktose: 'Laktose', ei: 'Ei', nuesse: 'Schalenfrüchte', erdnuss: 'Erdnuss',
  soja: 'Soja', fisch: 'Fisch', krebstiere: 'Krebstiere', sellerie: 'Sellerie', senf: 'Senf', sesam: 'Sesam',
}

export const AISLES = ['obst-gemuese', 'kuehlung', 'fleisch-fisch', 'brot', 'trocken', 'konserven', 'tiefkuehl', 'vorrat']
export const AISLE_LABEL = {
  'obst-gemuese': 'Obst & Gemüse', kuehlung: 'Kühlregal', 'fleisch-fisch': 'Fleisch & Fisch',
  brot: 'Brot & Backwaren', trocken: 'Nudeln, Reis & Getreide', konserven: 'Konserven & Gläser',
  tiefkuehl: 'Tiefkühl', vorrat: 'Vorrat (Öl, Gewürze …)',
}

export const EQUIPMENT = ['herd', 'ofen', 'mixer']
export const EQUIPMENT_LABEL = { herd: 'Herd', ofen: 'Backofen', mixer: 'Mixer / Pürierstab' }

export const UNITS = ['g', 'ml', 'Stk', 'EL', 'TL', 'Prise', 'Bund', 'Dose', 'Zehe', 'Scheibe', 'Pck']
