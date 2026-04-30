import type { RiskCategory } from './types';

export const BORDEAUX_CENTER: [number, number] = [44.8378, -0.5792];

export const CATEGORY_LABEL: Record<RiskCategory, string> = {
  weather: 'Meteo',
  fire: 'Incendie',
  flood: 'Inondation',
  industrial: 'Industriel',
  other: 'Autre',
  quake: 'Seisme',
  radiation: 'Radiologique',
  storm: 'Tempete',
  volcano: 'Volcan'
};

export const PREP_GUIDES: Array<{ title: string; points: string[] }> = [
  {
    title: 'Inondation',
    points: ['Monter les objets sensibles en hauteur', 'Couper electricite et gaz', 'Suivre les consignes de la mairie']
  },
  {
    title: 'Canicule',
    points: ['Boire regulierement', 'Rester dans des lieux frais', 'Surveiller les personnes fragiles']
  },
  {
    title: 'Risque industriel',
    points: ['Se confiner immediatement', 'Boucher aerations et fenetres', 'Ecouter la radio locale']
  }
];

export const EMERGENCY_NUMBERS = [
  { label: 'Pompiers', number: '18' },
  { label: 'SAMU', number: '15' },
  { label: 'Police', number: '17' },
  { label: 'Urgence Europeenne', number: '112' }
];
