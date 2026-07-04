import { getHijriDate, type HijriDate } from './hijriCalendar';
import { type PrayerTimes, getNextPrayer } from './prayerTimes';
import { db, type SmartFeedItem } from '../db/database';

export interface CurrentContext {
  currentPrayer: string;
  nextPrayer: string;
  phase: 'before_prayer' | 'during_prayer' | 'after_prayer' | 'normal_time';
  targetPrayer: string;
  minutesToNext: number;
  minutesSinceLast: number;
  weekday: string;
  weekdayEn: string;
  dayOfWeek: number;
  isIslamicNight: boolean;
  hijriDate: string; // "month-day"
  hijriDay: number;
  hijriMonth: number;
  hijriMonthName: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  nightOf: string;
  events: string[];
}

export interface ResolvedFeedItem {
  id: string;
  title: string;
  contentType: string; // 'custom' | 'hadith' | 'wisdom' | 'dua' | 'ziyarat' | 'taqiba' | 'event' | 'munajat'
  priority: number;
  description?: string;
  text?: string; // Rich content text
  author?: string; // e.g. Narrator, Author
  source?: string; // Source book
  virtue?: string; // Taqiba virtue
  actions?: string[]; // Nested action steps
  tags?: string[];
}

export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Derives the current religious and temporal context of the app
 */
export function getCurrentContext(times: PrayerTimes, hijriAdjustment: number = 0): CurrentContext {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.getDay();

  // Parse prayer times to absolute minutes
  const fajrMin = timeStringToMinutes(times.fajr);
  const sunriseMin = timeStringToMinutes(times.sunrise);
  const dhuhrMin = timeStringToMinutes(times.dhuhr);
  const asrMin = timeStringToMinutes(times.asr);
  const sunsetMin = timeStringToMinutes(times.sunset);
  const maghribMin = timeStringToMinutes(times.maghrib);
  const ishaMin = timeStringToMinutes(times.isha);

  // Islamic Night vs Day: Islamic night begins at Maghrib and ends at Fajr
  let isIslamicNight = false;
  if (currentMinutes >= maghribMin || currentMinutes < fajrMin) {
    isIslamicNight = true;
  }

  // Calculate Hijri Date (shifts to next Hijri day after Maghrib)
  const dateForHijri = new Date(now.getTime());
  if (currentMinutes >= maghribMin) {
    dateForHijri.setDate(dateForHijri.getDate() + 1);
  }
  const hijri = getHijriDate(dateForHijri, hijriAdjustment);

  // Determine current prayer phase and offsets
  let phase: 'before_prayer' | 'during_prayer' | 'after_prayer' | 'normal_time' = 'normal_time';
  let targetPrayer = '';
  let minutesToNext = 0;
  let minutesSinceLast = 0;

  // Fajr boundaries
  if (currentMinutes >= fajrMin - 60 && currentMinutes < fajrMin) {
    phase = 'before_prayer';
    targetPrayer = 'fajr';
    minutesToNext = fajrMin - currentMinutes;
  } else if (currentMinutes >= fajrMin && currentMinutes < fajrMin + 20) {
    phase = 'during_prayer';
    targetPrayer = 'fajr';
    minutesSinceLast = currentMinutes - fajrMin;
  } else if (currentMinutes >= fajrMin + 20 && currentMinutes < fajrMin + 80) {
    phase = 'after_prayer';
    targetPrayer = 'fajr';
    minutesSinceLast = currentMinutes - (fajrMin + 20);
  }
  // Dhuhr boundaries (covers Dhuhr/Asr combined window)
  else if (currentMinutes >= dhuhrMin - 30 && currentMinutes < dhuhrMin) {
    phase = 'before_prayer';
    targetPrayer = 'dhuhr';
    minutesToNext = dhuhrMin - currentMinutes;
  } else if (currentMinutes >= dhuhrMin && currentMinutes < dhuhrMin + 20) {
    phase = 'during_prayer';
    targetPrayer = 'dhuhr';
    minutesSinceLast = currentMinutes - dhuhrMin;
  } else if (currentMinutes >= dhuhrMin + 20 && currentMinutes < dhuhrMin + 80) {
    phase = 'after_prayer';
    targetPrayer = 'dhuhr';
    minutesSinceLast = currentMinutes - (dhuhrMin + 20);
  }
  // Maghrib boundaries (covers Maghrib/Isha combined window)
  else if (currentMinutes >= maghribMin - 30 && currentMinutes < maghribMin) {
    phase = 'before_prayer';
    targetPrayer = 'maghrib';
    minutesToNext = maghribMin - currentMinutes;
  } else if (currentMinutes >= maghribMin && currentMinutes < maghribMin + 25) {
    phase = 'during_prayer';
    targetPrayer = 'maghrib';
    minutesSinceLast = currentMinutes - maghribMin;
  } else if (currentMinutes >= maghribMin + 25 && currentMinutes < maghribMin + 85) {
    phase = 'after_prayer';
    targetPrayer = 'maghrib';
    minutesSinceLast = currentMinutes - (maghribMin + 25);
  }

  // General Time of Day
  let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'night';
  if (currentMinutes >= sunriseMin && currentMinutes < dhuhrMin) {
    timeOfDay = 'morning';
  } else if (currentMinutes >= dhuhrMin && currentMinutes < sunsetMin) {
    timeOfDay = 'afternoon';
  } else if (currentMinutes >= sunsetMin && currentMinutes < ishaMin + 120) {
    timeOfDay = 'evening';
  } else {
    timeOfDay = 'night';
  }

  const weekdaysAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const weekdaysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekday = weekdaysAr[dayOfWeek];
  const weekdayEn = weekdaysEn[dayOfWeek];

  // Islamic Night description
  let nightOf = '';
  if (isIslamicNight) {
    let nextDayIndex = dayOfWeek;
    if (currentMinutes >= maghribMin) {
      nextDayIndex = (dayOfWeek + 1) % 7;
    }
    nightOf = `ليلة ${weekdaysAr[nextDayIndex]}`;
  }

  const nextInfo = getNextPrayer(times);

  return {
    currentPrayer: nextInfo.currentPrayerName,
    nextPrayer: nextInfo.nextPrayerName,
    phase,
    targetPrayer,
    minutesToNext,
    minutesSinceLast,
    weekday,
    weekdayEn,
    dayOfWeek,
    isIslamicNight,
    hijriDate: `${hijri.month}-${hijri.day}`,
    hijriDay: hijri.day,
    hijriMonth: hijri.month,
    hijriMonthName: hijri.monthName,
    timeOfDay,
    nightOf,
    events: []
  };
}

/**
 * Builds the dynamic ordered Feed by matching the current context against smart_feed rules
 */
export async function getSmartFeed(context: CurrentContext): Promise<ResolvedFeedItem[]> {
  const feedItems: ResolvedFeedItem[] = [];

  try {
    // 1. Fetch all smart feed rules
    const rules = await db.smart_feed.toArray();

    // 2. Filter rules that match the current context
    const activeRules = rules.filter((rule) => {
      switch (rule.trigger_type) {
        case 'before_prayer':
          return context.phase === 'before_prayer' && context.targetPrayer === rule.trigger_value;
        case 'during_prayer':
          return context.phase === 'during_prayer' && context.targetPrayer === rule.trigger_value;
        case 'after_prayer':
          return context.phase === 'after_prayer' && context.targetPrayer === rule.trigger_value;
        case 'weekday':
          return !context.isIslamicNight && context.dayOfWeek.toString() === rule.trigger_value;
        case 'night_of_weekday':
          return context.isIslamicNight && context.dayOfWeek.toString() === rule.trigger_value;
        case 'hijri_date':
          return context.hijriDate === rule.trigger_value;
        case 'hijri_month':
          return context.hijriMonth.toString() === rule.trigger_value;
        case 'time_of_day':
          return context.timeOfDay === rule.trigger_value;
        default:
          return false;
      }
    });

    // 3. Resolve matched rules into rich content
    for (const rule of activeRules) {
      if (rule.content_type === 'custom') {
        feedItems.push({
          id: rule.id,
          title: rule.title,
          contentType: 'custom',
          priority: rule.priority,
          description: rule.description,
          actions: rule.actions,
        });
      } else if (rule.content_type === 'event_override') {
        // Load custom overriding Hijri events details (e.g. Ashura)
        const event = await db.hijri_events.get(rule.content_id);
        if (event) {
          feedItems.push({
            id: rule.id,
            title: rule.title || event.title,
            contentType: 'event',
            priority: rule.priority,
            description: event.description,
            actions: [
              ...(event.actions || []),
              ...(event.duas || []),
              ...(event.ziyarat || []),
              ...(event.prayers || [])
            ],
            tags: event.tags
          });
        }
      }
    }

    // 4. Inject Dynamic Context-Aware defaults (e.g. Hadith, Wisdom, Weekly Dua/Ziyarat, Today's Hijri Event)
    // This guarantees that the user always has a rich feed even if few custom smart_feed rules match!
    
    // A. Today's Hijri Event
    const todayEvents = await db.hijri_events
      .where('[month+day]')
      .equals([context.hijriMonth, context.hijriDay])
      .toArray();

    for (const ev of todayEvents) {
      // Avoid duplicate if already added via event_override
      if (!feedItems.some(item => item.id.includes(ev.id))) {
        feedItems.push({
          id: `feed_event_${ev.id}`,
          title: `📅 مناسبة اليوم: ${ev.title}`,
          contentType: 'event',
          priority: 80, // High priority for events
          description: ev.description,
          actions: [
            ...(ev.actions || []),
            ...(ev.duas || []),
            ...(ev.ziyarat || []),
            ...(ev.prayers || [])
          ],
          tags: ev.tags
        });
      }
    }

    // B. Weekly Dua for Today
    // In db, weekly_duas has 'day' field corresponding to Javascript day index
    const weeklyDua = await db.weekly_duas.where('day').equals(context.dayOfWeek).first();
    if (weeklyDua) {
      feedItems.push({
        id: `feed_dua_${weeklyDua.id}`,
        title: `🤲 دعاء يوم ${context.weekday}`,
        contentType: 'dua',
        priority: 15,
        description: `دعاء مأثور ومستحب لقراءته في هذا اليوم المبارك.`,
        text: weeklyDua.text,
        tags: weeklyDua.tags
      });
    }

    // C. Weekly Ziyarat for Today
    const weeklyZiyarat = await db.weekly_ziyarat.where('day').equals(context.dayOfWeek).first();
    if (weeklyZiyarat) {
      feedItems.push({
        id: `feed_ziyarat_${weeklyZiyarat.id}`,
        title: `📿 زيارة يوم ${context.weekday}`,
        contentType: 'ziyarat',
        priority: 14,
        description: `زيارة المعصومين عليهم السلام المخصصة لهذا اليوم.`,
        text: weeklyZiyarat.text,
        tags: weeklyZiyarat.tags
      });
    }

    // D. Taqibat (if currently during or after a prayer)
    if (context.phase === 'after_prayer' && context.targetPrayer) {
      const taqiba = await db.taqibat.where('prayer').equals(context.targetPrayer).first();
      if (taqiba) {
        feedItems.push({
          id: `feed_taqiba_${taqiba.id}`,
          title: `📿 ${taqiba.title}`,
          contentType: 'taqiba',
          priority: 25, // Above standard daily items
          description: taqiba.virtue,
          text: taqiba.text,
          tags: taqiba.tags
        });
      }
    }

    // E. Hadith of the Day (Deterministic based on day of month to rotate daily)
    const allHadiths = await db.hadiths.toArray();
    if (allHadiths.length > 0) {
      const index = context.hijriDay % allHadiths.length;
      const hadith = allHadiths[index];
      feedItems.push({
        id: `feed_hadith_${hadith.id}`,
        title: `📖 حديث اليوم المبارك`,
        contentType: 'hadith',
        priority: 10,
        text: hadith.text,
        author: hadith.narrator,
        source: hadith.source,
        tags: hadith.tags
      });
    }

    // F. Wisdom of the Day (Deterministic)
    const allWisdoms = await db.wisdoms.toArray();
    if (allWisdoms.length > 0) {
      const index = context.hijriDay % allWisdoms.length;
      const wisdom = allWisdoms[index];
      feedItems.push({
        id: `feed_wisdom_${wisdom.id}`,
        title: `💎 حكمة اليوم والوعظ`,
        contentType: 'wisdom',
        priority: 9,
        text: wisdom.text,
        author: wisdom.author,
        tags: wisdom.tags
      });
    }

    // G. A lovely Munajat for reflection (rotates daily)
    const allMunajats = await db.munajat.toArray();
    if (allMunajats.length > 0) {
      const index = (context.hijriDay + 2) % allMunajats.length;
      const munajat = allMunajats[index];
      feedItems.push({
        id: `feed_munajat_${munajat.id}`,
        title: `🤲 من همسات العارفين: ${munajat.title}`,
        contentType: 'munajat',
        priority: 8,
        text: munajat.text,
        tags: munajat.tags
      });
    }

    // 5. Sort everything by descending priority
    feedItems.sort((a, b) => b.priority - a.priority);

  } catch (error) {
    console.error('Error constructing smart feed:', error);
  }

  return feedItems;
}
