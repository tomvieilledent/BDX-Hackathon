export type RiskCategory =
  | 'weather'
  | 'fire'
  | 'flood'
  | 'industrial'
  | 'other'
  | 'quake'
  | 'radiation'
  | 'storm'
  | 'volcano';

export interface Alert {
  id: string;
  category: RiskCategory;
  level: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: {
    lat: number;
    lng: number;
    name: string;
  };
  timestamp: string;
  source: string;
}

export interface UserReport {
  id: string;
  category: RiskCategory;
  description: string;
  location: {
    lat: number;
    lng: number;
    name: string;
  };
  reporter: string;
  timestamp: string;
}
