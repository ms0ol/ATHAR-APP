import { db } from '../db/database';

export interface SearchResultItem {
  id: string;
  type: 'hadith' | 'wisdom' | 'taqiba' | 'munajat' | 'dua' | 'ziyarat' | 'event';
  title: string;
  text: string;
  score: number;
  tags: string[];
  meta?: any;
}

export interface SearchResults {
  hadiths: any[];
  wisdoms: any[];
  taqibat: any[];
  munajat: any[];
  weeklyDuas: any[];
  weeklyZiyarat: any[];
  events: any[];
  totalCount: number;
}

/**
 * Highly polished SearchEngine supporting weighted full-text scoring,
 * tag-matching prioritisation, and structured ranking results.
 */
export const SearchEngine = {
  /**
   * Search across all offline collections with weighted relevance scoring
   */
  async search(query: string): Promise<SearchResults> {
    if (!query || query.trim() === '') {
      return {
        hadiths: [],
        wisdoms: [],
        taqibat: [],
        munajat: [],
        weeklyDuas: [],
        weeklyZiyarat: [],
        events: [],
        totalCount: 0
      };
    }

    const q = query.toLowerCase().trim();

    // Scoring function: returns score (> 0 if matched, 0 otherwise)
    const calculateScore = (item: any): number => {
      let score = 0;
      
      // Exact or partial title match (High weight)
      const title = (item.title || item.narrator || item.author || '').toLowerCase();
      if (title.includes(q)) {
        score += 15;
        if (title.startsWith(q)) score += 5; // Extra weight if begins with query
      }

      // Tag match (Medium weight)
      if (item.tags && Array.isArray(item.tags)) {
        const matchesTag = item.tags.some((t: string) => t.toLowerCase().includes(q));
        if (matchesTag) {
          score += 10;
        }
      }

      // Main body text/description match (Basic weight)
      const text = (item.text || item.description || '').toLowerCase();
      if (text.includes(q)) {
        score += 5;
        // Count occurrences to rank higher
        const occurrences = (text.match(new RegExp(q, 'g')) || []).length;
        score += occurrences * 2;
      }

      return score;
    };

    // Parallel fetch from Dexie database tables
    const [
      hadiths,
      wisdoms,
      taqibat,
      munajat,
      weeklyDuas,
      weeklyZiyarats,
      events
    ] = await Promise.all([
      db.hadiths.toArray(),
      db.wisdoms.toArray(),
      db.taqibat.toArray(),
      db.munajat.toArray(),
      db.weekly_duas.toArray(),
      db.weekly_ziyarat.toArray(),
      db.hijri_events.toArray()
    ]);

    // Map and calculate scores
    const scoredHadiths = hadiths
      .map(item => ({ item, score: calculateScore(item) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    const scoredWisdoms = wisdoms
      .map(item => ({ item, score: calculateScore(item) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    const scoredTaqibat = taqibat
      .map(item => ({ item, score: calculateScore(item) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    const scoredMunajat = munajat
      .map(item => ({ item, score: calculateScore(item) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    const scoredWeeklyDuas = weeklyDuas
      .map(item => ({ item, score: calculateScore(item) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    const scoredWeeklyZiyarats = weeklyZiyarats
      .map(item => ({ item, score: calculateScore(item) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    const scoredEvents = events
      .map(item => ({ item, score: calculateScore(item) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    const totalCount =
      scoredHadiths.length +
      scoredWisdoms.length +
      scoredTaqibat.length +
      scoredMunajat.length +
      scoredWeeklyDuas.length +
      scoredWeeklyZiyarats.length +
      scoredEvents.length;

    return {
      hadiths: scoredHadiths,
      wisdoms: scoredWisdoms,
      taqibat: scoredTaqibat,
      munajat: scoredMunajat,
      weeklyDuas: scoredWeeklyDuas,
      weeklyZiyarat: scoredWeeklyZiyarats,
      events: scoredEvents,
      totalCount
    };
  }
};
