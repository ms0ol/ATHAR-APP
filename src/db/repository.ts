import { db, type Hadith, type Wisdom, type Taqibat, type Munajat, type WeeklyDua, type WeeklyZiyarat, type HijriEvent, type SmartFeedItem } from './database';

/**
 * WorshipRepository - Decouples database/storage from UI and services.
 * Implements a clean repository pattern and manages content relationships.
 */
export const WorshipRepository = {
  // --- HADITHS ---
  async getHadithById(id: string): Promise<Hadith | undefined> {
    return db.hadiths.get(id);
  },

  async getAllHadiths(): Promise<Hadith[]> {
    return db.hadiths.toArray();
  },

  async getHadithsByTag(tag: string): Promise<Hadith[]> {
    return db.hadiths.filter(h => h.tags.includes(tag)).toArray();
  },

  // --- WISDOMS ---
  async getWisdomById(id: string): Promise<Wisdom | undefined> {
    return db.wisdoms.get(id);
  },

  async getAllWisdoms(): Promise<Wisdom[]> {
    return db.wisdoms.toArray();
  },

  // --- TAQIBAT ---
  async getTaqibaById(id: string): Promise<Taqibat | undefined> {
    return db.taqibat.get(id);
  },

  async getTaqibaByPrayer(prayer: string): Promise<Taqibat | undefined> {
    return db.taqibat.where('prayer').equals(prayer).first();
  },

  // --- MUNAJAT ---
  async getMunajatById(id: string): Promise<Munajat | undefined> {
    return db.munajat.get(id);
  },

  async getAllMunajats(): Promise<Munajat[]> {
    return db.munajat.toArray();
  },

  // --- WEEKLY DUAS ---
  async getWeeklyDuaByDay(day: number): Promise<WeeklyDua | undefined> {
    return db.weekly_duas.where('day').equals(day).first();
  },

  // --- WEEKLY ZIYARAT ---
  async getWeeklyZiyaratByDay(day: number): Promise<WeeklyZiyarat | undefined> {
    return db.weekly_ziyarat.where('day').equals(day).first();
  },

  // --- HIJRI EVENTS ---
  async getHijriEventById(id: string): Promise<HijriEvent | undefined> {
    return db.hijri_events.get(id);
  },

  async getHijriEventsByDate(month: number, day: number): Promise<HijriEvent[]> {
    return db.hijri_events.where('[month+day]').equals([month, day]).toArray();
  },

  // --- SMART FEED RULES ---
  async getAllSmartFeedRules(): Promise<SmartFeedItem[]> {
    return db.smart_feed.toArray();
  },

  // --- RELATION ENGINE ---
  /**
   * Resolves content relations (finds related hadiths, wisdoms, etc. based on shared tags)
   */
  async getRelatedContent(tags: string[], excludeId: string): Promise<{
    hadiths: Hadith[];
    wisdoms: Wisdom[];
    munajats: Munajat[];
  }> {
    if (!tags || tags.length === 0) {
      return { hadiths: [], wisdoms: [], munajats: [] };
    }

    // Simple overlapping tag heuristic
    const hadiths = await db.hadiths
      .filter(h => h.id !== excludeId && h.tags.some(t => tags.includes(t)))
      .limit(3)
      .toArray();

    const wisdoms = await db.wisdoms
      .filter(w => w.id !== excludeId && w.tags.some(t => tags.includes(t)))
      .limit(3)
      .toArray();

    const munajats = await db.munajat
      .filter(m => m.id !== excludeId && m.tags.some(t => tags.includes(t)))
      .limit(3)
      .toArray();

    return { hadiths, wisdoms, munajats };
  }
};
