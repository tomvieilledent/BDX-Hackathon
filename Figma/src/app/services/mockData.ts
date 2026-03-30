// Service de données mockées pour simuler les alertes et risques

export type RiskLevel = 'safe' | 'warning' | 'danger';

export interface Alert {
  id: string;
  type: 'flood' | 'heatwave' | 'seveso' | 'storm' | 'fire';
  title: string;
  level: RiskLevel;
  distance: number; // en km
  time: string;
  description: string;
}

export interface Consigne {
  id: string;
  icon: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Shelter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  capacity: number;
  available: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  category: 'immediate' | 'preparation' | 'evacuation';
}

// Simule les alertes basées sur la position
export function getAlertsByLocation(lat: number, lon: number): Alert[] {
  return [
    {
      id: '1',
      type: 'flood',
      title: 'Inondation',
      level: 'danger',
      distance: 2.3,
      time: 'Il y a 15 min',
      description: 'Crue rapide détectée sur la rivière. Évitez les zones basses.',
    },
    {
      id: '2',
      type: 'heatwave',
      title: 'Canicule',
      level: 'warning',
      distance: 0,
      time: 'Aujourd\'hui',
      description: 'Températures > 35°C prévues. Restez hydraté.',
    },
    {
      id: '3',
      type: 'seveso',
      title: 'Site SEVESO',
      level: 'safe',
      distance: 5.8,
      time: 'En surveillance',
      description: 'Site industriel à risque. Aucun incident signalé.',
    },
  ];
}

// Retourne le niveau de risque global
export function getOverallRiskLevel(alerts: Alert[]): RiskLevel {
  const hasDanger = alerts.some(a => a.level === 'danger');
  const hasWarning = alerts.some(a => a.level === 'warning');
  
  if (hasDanger) return 'danger';
  if (hasWarning) return 'warning';
  return 'safe';
}

// Consignes de sécurité
export function getConsignesByAlertType(type: string): Consigne[] {
  const consignesMap: Record<string, Consigne[]> = {
    flood: [
      { id: 'f1', icon: '🏠', text: 'Montez aux étages supérieurs', priority: 'high' },
      { id: 'f2', icon: '⚡', text: 'Coupez l\'électricité et le gaz', priority: 'high' },
      { id: 'f3', icon: '🚗', text: 'N\'utilisez pas votre véhicule', priority: 'high' },
      { id: 'f4', icon: '📱', text: 'Gardez votre téléphone chargé', priority: 'medium' },
      { id: 'f5', icon: '📻', text: 'Écoutez les infos locales', priority: 'medium' },
    ],
    heatwave: [
      { id: 'h1', icon: '💧', text: 'Buvez 2L d\'eau minimum', priority: 'high' },
      { id: 'h2', icon: '🏠', text: 'Restez à l\'intérieur 11h-17h', priority: 'high' },
      { id: 'h3', icon: '🌡️', text: 'Fermez volets et rideaux', priority: 'medium' },
      { id: 'h4', icon: '👵', text: 'Vérifiez vos proches âgés', priority: 'high' },
    ],
    seveso: [
      { id: 's1', icon: '🏃', text: 'Éloignez-vous de la source', priority: 'high' },
      { id: 's2', icon: '🪟', text: 'Confinement : fermez portes et fenêtres', priority: 'high' },
      { id: 's3', icon: '🚪', text: 'Calfeutrez les entrées d\'air', priority: 'high' },
      { id: 's4', icon: '📻', text: 'Écoutez les consignes officielles', priority: 'high' },
      { id: 's5', icon: '☎️', text: 'N\'appelez que si nécessaire', priority: 'medium' },
    ],
  };

  return consignesMap[type] || [];
}

// Refuges à proximité
export function getShelters(lat: number, lon: number): Shelter[] {
  return [
    {
      id: '1',
      name: 'Gymnase Municipal',
      address: '12 Rue des Sports',
      lat: lat + 0.01,
      lon: lon + 0.01,
      capacity: 150,
      available: true,
    },
    {
      id: '2',
      name: 'Salle des Fêtes',
      address: '5 Place de la Mairie',
      lat: lat - 0.015,
      lon: lon + 0.02,
      capacity: 80,
      available: true,
    },
    {
      id: '3',
      name: 'Centre Social',
      address: '28 Avenue Principale',
      lat: lat + 0.02,
      lon: lon - 0.01,
      capacity: 100,
      available: false,
    },
  ];
}

// Checklist d'urgence
export function getChecklistItems(): ChecklistItem[] {
  return [
    { id: 'c1', text: 'Téléphone chargé à 100%', checked: false, category: 'immediate' },
    { id: 'c2', text: 'Papiers d\'identité accessibles', checked: false, category: 'immediate' },
    { id: 'c3', text: 'Médicaments essentiels', checked: false, category: 'immediate' },
    { id: 'c4', text: 'Eau potable (3L/personne)', checked: false, category: 'preparation' },
    { id: 'c5', text: 'Nourriture non-périssable', checked: false, category: 'preparation' },
    { id: 'c6', text: 'Lampe torche + piles', checked: false, category: 'preparation' },
    { id: 'c7', text: 'Couverture de survie', checked: false, category: 'preparation' },
    { id: 'c8', text: 'Trousse de premiers secours', checked: false, category: 'preparation' },
    { id: 'c9', text: 'Sac d\'évacuation prêt', checked: false, category: 'evacuation' },
    { id: 'c10', text: 'Itinéraire vers refuge identifié', checked: false, category: 'evacuation' },
  ];
}

// Icônes des types d'alertes
export function getAlertIcon(type: string): string {
  const icons: Record<string, string> = {
    flood: '🌊',
    heatwave: '🌡️',
    seveso: '⚠️',
    storm: '⛈️',
    fire: '🔥',
  };
  return icons[type] || '⚠️';
}
