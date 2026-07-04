export interface AppSettings {
  city: string;
  latitude: number;
  longitude: number;
  timezone: number;
  calculationMethod: 'Shia' | 'UmmAlQura' | 'MWL' | 'Egypt' | 'Karachi';
  theme: 'warm' | 'night' | 'gold' | 'light';
  font: 'amiri' | 'cairo' | 'tajawal' | 'inter';
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  lineHeight: 'tight' | 'normal' | 'relaxed' | 'loose';
  hijriAdjustment: number; // days offset for Hijri date
}

export const DEFAULT_SETTINGS: AppSettings = {
  city: 'Najaf',
  latitude: 32.0259,
  longitude: 44.3463,
  timezone: 3,
  calculationMethod: 'Shia',
  theme: 'warm',
  font: 'cairo',
  fontSize: 'md',
  lineHeight: 'relaxed',
  hijriAdjustment: 0
};

export interface ReadingSession {
  itemId: string;
  type: string;
  title: string;
  progressPercentage: number;
}
