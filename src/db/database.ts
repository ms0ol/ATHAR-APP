import Dexie, { type Table } from 'dexie';

export interface Hadith {
  id: string;
  text: string;
  narrator: string;
  source: string;
  tags: string[];
}

export interface Wisdom {
  id: string;
  text: string;
  author: string;
  tags: string[];
}

export interface Taqibat {
  id: string;
  prayer: string;
  title: string;
  text: string;
  virtue: string;
  tags: string[];
}

export interface Munajat {
  id: string;
  title: string;
  text: string;
  tags: string[];
}

export interface WeeklyDua {
  id: string;
  day: number;
  title: string;
  text: string;
  tags: string[];
}

export interface WeeklyZiyarat {
  id: string;
  day: number;
  title: string;
  text: string;
  tags: string[];
}

export interface HijriEvent {
  id: string;
  month: number;
  day: number;
  title: string;
  description: string;
  actions: string[];
  duas: string[];
  ziyarat: string[];
  prayers: string[];
  tags: string[];
}

export interface TagDict {
  id: string;
  tag: string;
  category: string;
}

export interface SmartFeedItem {
  id: string;
  title: string;
  content_type: string;
  content_id: string;
  trigger_type: 'before_prayer' | 'after_prayer' | 'during_prayer' | 'weekday' | 'night_of_weekday' | 'hijri_date' | 'hijri_month' | 'time_of_day' | string;
  trigger_value: string;
  priority: number;
  start_offset?: number;
  end_offset?: number;
  description?: string;
  actions?: string[];
}

export interface UserFavorite {
  id?: number;
  type: 'hadith' | 'wisdom' | 'dua' | 'ziyarat' | 'taqiba' | 'event';
  itemId: string;
  title: string;
  addedAt: number;
}

export interface ReadingProgress {
  itemId: string;
  type: string;
  title: string;
  lastPosition: number;
  progressPercentage: number;
  updatedAt: number;
}

export interface UserSetting {
  key: string;
  value: any;
}

export class WorshipDatabase extends Dexie {
  hadiths!: Table<Hadith, string>;
  wisdoms!: Table<Wisdom, string>;
  taqibat!: Table<Taqibat, string>;
  munajat!: Table<Munajat, string>;
  weekly_duas!: Table<WeeklyDua, string>;
  weekly_ziyarat!: Table<WeeklyZiyarat, string>;
  hijri_events!: Table<HijriEvent, string>;
  tags_dictionary!: Table<TagDict, string>;
  user_favorites!: Table<UserFavorite, number>;
  user_reading_progress!: Table<ReadingProgress, string>;
  user_settings!: Table<UserSetting, string>;
  smart_feed!: Table<SmartFeedItem, string>;

  constructor() {
    super('WorshipDatabase');
    this.version(1).stores({
      hadiths: 'id, narrator, source, *tags',
      wisdoms: 'id, author, *tags',
      taqibat: 'id, prayer, title, *tags',
      munajat: 'id, title, *tags',
      weekly_duas: 'id, day, title, *tags',
      weekly_ziyarat: 'id, day, title, *tags',
      hijri_events: 'id, [month+day], month, day, title, *tags',
      tags_dictionary: 'id, tag, category',
      user_favorites: '++id, [type+itemId], type, itemId, title',
      user_reading_progress: 'itemId, type, progressPercentage',
      user_settings: 'key'
    });
    this.version(2).stores({
      hadiths: 'id, narrator, source, *tags',
      wisdoms: 'id, author, *tags',
      taqibat: 'id, prayer, title, *tags',
      munajat: 'id, title, *tags',
      weekly_duas: 'id, day, title, *tags',
      weekly_ziyarat: 'id, day, title, *tags',
      hijri_events: 'id, [month+day], month, day, title, *tags',
      tags_dictionary: 'id, tag, category',
      user_favorites: '++id, [type+itemId], type, itemId, title',
      user_reading_progress: 'itemId, type, progressPercentage',
      user_settings: 'key',
      smart_feed: 'id, trigger_type, trigger_value, priority'
    });
  }
}

export const db = new WorshipDatabase();
