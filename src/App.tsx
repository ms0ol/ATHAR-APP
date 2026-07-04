import React, { useEffect, useState } from 'react';
import { db, Hadith, Wisdom, Taqibat, Munajat, WeeklyDua, WeeklyZiyarat, HijriEvent } from './db/database';
import { checkAndImportData, forceRebuildDatabase } from './db/importer';
import { 
  calculatePrayerTimes, getNextPrayer, CITY_PRESETS, 
  calculateQibla, PrayerTimes, NextPrayerInfo 
} from './utils/prayerTimes';
import { getHijriDate, generateCalendarGrid, WEEKDAYS_AR, HIJRI_MONTHS_AR, CalendarDayInfo } from './utils/hijriCalendar';
import { AppSettings, DEFAULT_SETTINGS } from './types';
import { RelatedContent } from './components/RelatedContent';
import { ReaderMode } from './components/ReaderMode';
import { QiblaCompass } from './components/QiblaCompass';
import { SmartTimeline } from './components/SmartTimeline';
import { SearchEngine } from './utils/searchEngine';
import { useLiveQuery } from 'dexie-react-hooks';

// Icons
import { 
  Home, Clock, BookOpen, Heart, CalendarDays, Settings, Search, 
  Compass, ChevronLeft, ChevronRight, Info, AlertCircle, 
  Sparkles, Check, Copy, Share2, ArrowLeft, RefreshCw, 
  BookMarked, HelpCircle, Eye, EyeOff
} from 'lucide-react';

function getSmartContext() {
  const now = new Date();
  const day = now.getDay(); // 0 is Sun, 4 is Thu, 5 is Fri
  const hour = now.getHours();

  if (day === 4 && hour >= 17) {
    return {
      title: "تقترب ليلة الجمعة المباركة",
      message: "ليلة مناجاة واستغفار وقضاء الحوائج.",
      recommendation: "ننصح بقراءة دعاء كميل بن زياد وزيارة الإمام الحسين (ع).",
      itemId: "wd_kumayl",
      type: "dua"
    };
  } else if (day === 5 && hour < 11) {
    return {
      title: "يوم الجمعة المبارك - صباحاً",
      message: "يوم العيد الأسبوعي للمؤمنين وزيارة قائم آل محمد (عج).",
      recommendation: "يستحب قراءة دعاء الندبة ندبةً لغيبة ولي الأمر.",
      itemId: "wd_nudba",
      type: "dua"
    };
  } else if (day === 5 && hour >= 11 && hour <= 15) {
    return {
      title: "يوم الجمعة - وقت الزوال",
      message: "أفضل أوقات استجابة الدعاء وصلاة الجمعة.",
      recommendation: "تعقيب صلاة الظهر وزيارة الإمام المهدي (عج) المخصوصة في يوم الجمعة.",
      itemId: "wz_fri",
      type: "ziyarat"
    };
  } else {
    // General dynamic recommendation based on hour
    if (hour >= 4 && hour < 6) {
      return {
        title: "وقت السحر وصلاة الفجر",
        message: "أوقات تتنزل فيها البركات والرحمة الإلهية.",
        recommendation: "تعقيب صلاة الفجر لقضاء الديون وسعة الرزق.",
        itemId: "t_fajr",
        type: "taqiba"
      };
    } else if (hour >= 11 && hour < 14) {
      return {
        title: "وقت صلاة الظهرين",
        message: "أبواب السماء مفتوحة لاستجابة الدعاء عند الزوال.",
        recommendation: "ننصح بتعقيب صلاة الظهر والاستغفار مئة مرة بعد العصر.",
        itemId: "t_dhuhr",
        type: "taqiba"
      };
    } else if (hour >= 17 && hour < 20) {
      return {
        title: "وقت صلاة المغرب والعشاء",
        message: "حلول الليل وبداية العبادات المسائية.",
        recommendation: "قراءة تعقيب صلاة المغرب لطلب الأمان والحفظ.",
        itemId: "t_maghrib",
        type: "taqiba"
      };
    } else {
      return {
        title: "مناجاة وتفكر في هدأة الليل",
        message: "الخلوة مع الله في الثلث الأخير من الليل.",
        recommendation: "ننصح بقراءة مناجاة التائبين من المناجيات الخمسة عشر للامام السجاد.",
        itemId: "m_1",
        type: "munajat"
      };
    }
  }
}

export default function App() {
  // Sync state
  const [syncing, setSyncing] = useState<boolean>(true);
  const [syncProgress, setSyncProgress] = useState<string>('جاري تحضير قاعدة البيانات المحلية...');
  
  // App preferences
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Active tab state
  const [activeTab, setActiveTab] = useState<'home' | 'prayer' | 'read' | 'duas_ziyarat' | 'calendar' | 'favorites' | 'search' | 'settings'>('home');

  // Reader overlay state
  const [activeReader, setActiveReader] = useState<{
    id: string;
    type: 'hadith' | 'wisdom' | 'dua' | 'ziyarat' | 'taqiba' | 'event' | 'munajat';
    title: string;
    text: string;
    tags: string[];
  } | null>(null);

  // Time tracker for clock and prayer countdown
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [calculatedTimes, setCalculatedTimes] = useState<PrayerTimes | null>(null);
  const [nextPrayerInfo, setNextPrayerInfo] = useState<NextPrayerInfo | null>(null);

  // Interactive Hijri Calendar state
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<CalendarDayInfo | null>(null);
  const [dayEvent, setDayEvent] = useState<HijriEvent | null>(null);

  // Read tab inner sub-tab state
  const [readSubTab, setReadSubTab] = useState<'hadiths' | 'wisdoms' | 'munajat'>('hadiths');

  // Supplications and visits sub-tab state
  const [duasSubTab, setDuasSubTab] = useState<'weekly_duas' | 'weekly_ziyarat' | 'general_duas'>('weekly_duas');

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<{
    hadiths: Hadith[];
    wisdoms: Wisdom[];
    taqibat: Taqibat[];
    munajat: Munajat[];
    weeklyDuas: WeeklyDua[];
    weeklyZiyarat: WeeklyZiyarat[];
    events: HijriEvent[];
    totalCount: number;
  } | null>(null);

  // Favorites sub-tab state
  const [favSubTab, setFavSubTab] = useState<'hadith' | 'wisdom' | 'dua' | 'ziyarat' | 'taqiba' | 'event'>('hadith');

  // Pull local database arrays reactively using dexie-react-hooks
  const localHadiths = useLiveQuery(() => db.hadiths.toArray()) || [];
  const localWisdoms = useLiveQuery(() => db.wisdoms.toArray()) || [];
  const localTaqibat = useLiveQuery(() => db.taqibat.toArray()) || [];
  const localMunajat = useLiveQuery(() => db.munajat.toArray()) || [];
  const localWeeklyDuas = useLiveQuery(() => db.weekly_duas.toArray()) || [];
  const localWeeklyZiyarat = useLiveQuery(() => db.weekly_ziyarat.toArray()) || [];
  const localEvents = useLiveQuery(() => db.hijri_events.toArray()) || [];
  const dbFavorites = useLiveQuery(() => db.user_favorites.toArray()) || [];
  const readingProgresses = useLiveQuery(() => db.user_reading_progress.toArray()) || [];

  // Load preferences and run synchronization on startup
  useEffect(() => {
    async function initApp() {
      try {
        const savedSettings = await db.user_settings.get('app_settings');
        if (savedSettings) {
          setSettings(savedSettings.value);
        } else {
          await db.user_settings.put({ key: 'app_settings', value: DEFAULT_SETTINGS });
        }

        // Check & sync JSON data with IndexedDB
        await checkAndImportData((prog) => setSyncProgress(prog));
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setSyncing(false);
      }
    }
    initApp();
  }, []);

  // Recalculate prayer times whenever date, preset city, or calculation method changes
  const currentDateKey = `${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()}`;

  useEffect(() => {
    const times = calculatePrayerTimes(
      currentTime,
      settings.latitude,
      settings.longitude,
      settings.timezone,
      settings.calculationMethod
    );
    setCalculatedTimes(times);
  }, [currentDateKey, settings.latitude, settings.longitude, settings.timezone, settings.calculationMethod]);

  // Clock tick timer (once per second) to update count downs and real-time clocks
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (calculatedTimes) {
        const info = getNextPrayer(calculatedTimes);
        setNextPrayerInfo(info);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [calculatedTimes]);

  // Monitor Calendar selection changes and fetch historical events matching selected Hijri date
  useEffect(() => {
    async function fetchEventForDay() {
      if (!selectedDay) return;
      const event = await db.hijri_events
        .where('[month+day]')
        .equals([selectedDay.hijriMonth, selectedDay.hijriDay])
        .first();
      setDayEvent(event || null);
    }
    fetchEventForDay();
  }, [selectedDay]);

  // Trigger search indexing when searchQuery modifies
  useEffect(() => {
    async function triggerSearch() {
      if (!searchQuery || searchQuery.trim() === '') {
        setSearchResults(null);
        return;
      }
      const results = await SearchEngine.search(searchQuery);
      setSearchResults(results);
    }

    const delayDebounce = setTimeout(() => {
      triggerSearch();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Set default calendar selected cell to today on load
  useEffect(() => {
    const grid = generateCalendarGrid(calendarYear, calendarMonth, settings.hijriAdjustment);
    const todayCell = grid.find(c => c.isToday && c.isCurrentMonth) || grid.find(c => c.isCurrentMonth);
    if (todayCell) {
      setSelectedDay(todayCell);
    }
  }, [calendarYear, calendarMonth, settings.hijriAdjustment]);

  // Toggle favorite helper
  const isFavorite = (type: string, itemId: string): boolean => {
    return dbFavorites.some(f => f.type === type && f.itemId === itemId);
  };

  const handleToggleFavorite = async (type: any, itemId: string, title: string) => {
    const existing = dbFavorites.find(f => f.type === type && f.itemId === itemId);
    if (existing) {
      await db.user_favorites.delete(existing.id!);
    } else {
      await db.user_favorites.put({
        type,
        itemId,
        title,
        addedAt: Date.now()
      });
    }
  };

  // Safe city modifier
  const handleCityChange = async (presetName: string) => {
    const preset = CITY_PRESETS.find(c => c.name === presetName);
    if (!preset) return;

    const newSettings = {
      ...settings,
      city: preset.name,
      latitude: preset.latitude,
      longitude: preset.longitude,
      timezone: preset.timezone
    };

    setSettings(newSettings);
    await db.user_settings.put({ key: 'app_settings', value: newSettings });
  };

  // Safe method modifier
  const handleMethodChange = async (method: any) => {
    const newSettings = {
      ...settings,
      calculationMethod: method
    };
    setSettings(newSettings);
    await db.user_settings.put({ key: 'app_settings', value: newSettings });
  };

  // Safe font / text configuration modifier
  const handlePreferenceChange = async (key: keyof AppSettings, value: any) => {
    const newSettings = {
      ...settings,
      [key]: value
    };
    setSettings(newSettings);
    await db.user_settings.put({ key: 'app_settings', value: newSettings });
  };

  // Rebuild local database triggering
  const handleRebuildDatabase = async () => {
    setSyncing(true);
    await forceRebuildDatabase((prog) => setSyncProgress(prog));
    setSyncing(false);
  };

  // Calculate the current smart context (التقويم الذكي)
  const smartContext = getSmartContext();

  // Map settings parameters to direct tailwind wrappers
  const getThemeWrapperClass = () => {
    switch (settings.theme) {
      case 'warm': return 'bg-slate-900 text-slate-100 min-h-screen flex flex-col selection:bg-amber-500/30 selection:text-amber-200';
      case 'night': return 'bg-zinc-950 text-slate-50 min-h-screen flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200';
      case 'gold': return 'bg-[#1a1712] text-[#f7f2e9] min-h-screen flex flex-col selection:bg-[#c39b62]/40';
      case 'light': return 'bg-slate-50 text-slate-800 min-h-screen flex flex-col selection:bg-amber-100 selection:text-amber-900';
    }
  };

  const getContainerClass = () => {
    switch (settings.theme) {
      case 'warm': return 'bg-slate-800/45 border-slate-700/50 text-slate-100';
      case 'night': return 'bg-zinc-900/60 border-zinc-800 text-slate-100';
      case 'gold': return 'bg-[#23201a] border-[#39342a] text-[#f7f2e9]';
      case 'light': return 'bg-white border-slate-100 shadow-sm text-slate-800';
    }
  };

  const getActiveTabClass = (tab: string) => {
    const isActive = activeTab === tab;
    if (settings.theme === 'light') {
      return isActive 
        ? 'text-amber-700 bg-amber-50' 
        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50';
    }
    return isActive 
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30';
  };

  const getAppFontClass = () => {
    switch (settings.font) {
      case 'amiri': return 'font-amiri';
      case 'cairo': return 'font-cairo';
      case 'tajawal': return 'font-tajawal';
      case 'inter': return 'font-inter';
      default: return 'font-cairo';
    }
  };

  // Home screen "last read" hook
  const handleOpenProgressItem = async (progressItem: any) => {
    // Open in reader
    let text = '';
    let tags: string[] = [];

    if (progressItem.type === 'hadith') {
      const match = await db.hadiths.get(progressItem.itemId);
      if (match) { text = match.text; tags = match.tags; }
    } else if (progressItem.type === 'wisdom') {
      const match = await db.wisdoms.get(progressItem.itemId);
      if (match) { text = match.text; tags = match.tags; }
    } else if (progressItem.type === 'taqiba') {
      const match = await db.taqibat.get(progressItem.itemId);
      if (match) { text = match.text; tags = match.tags; }
    } else if (progressItem.type === 'munajat') {
      const match = await db.munajat.get(progressItem.itemId);
      if (match) { text = match.text; tags = match.tags; }
    } else if (progressItem.type === 'dua') {
      const match = await db.weekly_duas.get(progressItem.itemId);
      if (match) { text = match.text; tags = match.tags; }
    } else if (progressItem.type === 'ziyarat') {
      const match = await db.weekly_ziyarat.get(progressItem.itemId);
      if (match) { text = match.text; tags = match.tags; }
    }

    if (text) {
      setActiveReader({
        id: progressItem.itemId,
        type: progressItem.type,
        title: progressItem.title,
        text,
        tags
      });
    }
  };

  // Fast search helper for tag clicking
  const handleTagSearch = (tag: string) => {
    setSearchQuery(tag);
    setActiveTab('search');
  };

  // Startup Sync Overlay
  if (syncing) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-slate-100 z-50 p-6" id="startup-sync-overlay">
        <div className="text-center max-w-sm flex flex-col items-center gap-6">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-pulse" />
            <Compass className="w-10 h-10 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-serif text-amber-400">رفيق العبادة اليومي</h1>
            <p className="text-xs text-slate-400 mt-1 font-sans">بناء قاعدة البيانات المحلية للمتصفح لتشغيل كامل الأقسام بدون إنترنت</p>
          </div>
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 animate-infinite" style={{ width: '40%' }} />
          </div>
          <p className="text-xs text-amber-300 font-sans tracking-wide leading-relaxed bg-slate-900/50 py-2 px-4 rounded-xl border border-slate-800">
            {syncProgress}
          </p>
        </div>
      </div>
    );
  }

  const hijriToday = getHijriDate(currentTime, settings.hijriAdjustment);
  const formattedGregorianToday = currentTime.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className={`${getThemeWrapperClass()} ${getAppFontClass()} text-right`} dir="rtl" id="app-root-container">
      
      {/* Top Brand Banner bar */}
      <header className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold font-serif text-amber-400">رَفِيقُ العِبَادَةِ</h1>
            <p className="text-[9px] text-slate-400 font-sans tracking-tight">مستودع المأثورات والأعمال اليومية</p>
          </div>
        </div>

        {/* Global Search shortcut bar */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('search')}
            className={`p-2 text-slate-400 hover:text-white rounded-lg transition-colors ${activeTab === 'search' ? 'bg-slate-800 text-white' : ''}`}
            title="البحث الشامل"
            id="header-search-toggle"
          >
            <Search className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-2 text-slate-400 hover:text-white rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-slate-800 text-white' : ''}`}
            title="الإعدادات"
            id="header-settings-toggle"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area Grid */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-10">
        
        {/* TAB 1: HOME (الرئيسية) */}
        {activeTab === 'home' && (
          <div className="space-y-6" id="home-tab-view">
            
            {/* Interactive Timeline Feed powered by Smart Context Engine */}
            <SmartTimeline
              currentTime={currentTime}
              calculatedTimes={calculatedTimes}
              hijriAdjustment={settings.hijriAdjustment}
              theme={settings.theme}
              onOpenReader={(item) => {
                setActiveReader({
                  id: item.id,
                  type: item.type,
                  title: item.title,
                  text: item.text,
                  tags: item.tags
                });
              }}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />

            {/* 2. Last Read Reading Progress Tracker (استكمال القراءة) */}
            <div className={`p-5 rounded-3xl border ${getContainerClass()}`} id="reading-progress-card">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-1.5">
                <BookOpen className="w-4.5 h-4.5 text-amber-500" />
                <span>استكمال القراءة ومتابعة الختمات</span>
              </h3>
              {readingProgresses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {readingProgresses.slice(0, 2).map((item) => (
                    <div 
                      key={item.itemId}
                      onClick={() => handleOpenProgressItem(item)}
                      className="p-3 bg-slate-50/50 hover:bg-amber-50/20 dark:bg-slate-900/40 dark:hover:bg-amber-950/10 border border-slate-100 dark:border-slate-800 rounded-xl cursor-pointer transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-amber-500 transition-colors line-clamp-1">{item.title}</h4>
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-200/55 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded mt-1.5 inline-block">
                          {item.type === 'hadith' ? 'حديث شريف' : item.type === 'wisdom' ? 'حكمة' : item.type === 'dua' ? 'دعاء' : item.type === 'ziyarat' ? 'زيارة' : 'تعقيب صلاة'}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-slate-400 font-sans mb-1">
                          <span>نسبة الإنجاز</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">{item.progressPercentage}%</span>
                        </div>
                        <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${item.progressPercentage}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-slate-50/40 dark:bg-slate-900/10 rounded-xl text-xs text-slate-400 border border-dashed border-slate-200/40 dark:border-slate-800">
                  لم تقم بقراءة نصوص طويلة بعد. عند تصفح الأدعية والزيارات، سيظهر تقدم قراءتك هنا تلقائياً لتمكينك من المتابعة لاحقاً.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PRAYER TIMES & QIBLA (مواقيت الصلاة) */}
        {activeTab === 'prayer' && (
          <div className="space-y-6" id="prayer-tab-view">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Calculations Block */}
              <div className={`p-5 rounded-3xl border ${getContainerClass()}`} id="prayer-times-calc-box">
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span>مواقيت الصلوات لليوم</span>
                </h3>
                
                {calculatedTimes ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="flex justify-between py-3 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-200">الإمساك والفجر</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{calculatedTimes.fajr}</span>
                    </div>
                    <div className="flex justify-between py-3 text-xs">
                      <span className="text-slate-500">الشروق</span>
                      <span className="font-mono text-slate-500">{calculatedTimes.sunrise}</span>
                    </div>
                    <div className="flex justify-between py-3 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-200">الظهر الشرعي</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{calculatedTimes.dhuhr}</span>
                    </div>
                    <div className="flex justify-between py-3 text-xs">
                      <span className="text-slate-500">العصر</span>
                      <span className="font-mono text-slate-500">{calculatedTimes.asr}</span>
                    </div>
                    <div className="flex justify-between py-3 text-xs">
                      <span className="text-slate-500">غروب الشمس</span>
                      <span className="font-mono text-slate-500">{calculatedTimes.sunset}</span>
                    </div>
                    <div className="flex justify-between py-3 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-200">المغرب الشرعي</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{calculatedTimes.maghrib}</span>
                    </div>
                    <div className="flex justify-between py-3 text-xs">
                      <span className="text-slate-500">العشاء</span>
                      <span className="font-mono text-slate-500">{calculatedTimes.isha}</span>
                    </div>
                    <div className="flex justify-between py-3 text-xs">
                      <span className="text-slate-500">منتصف الليل</span>
                      <span className="font-mono text-slate-500">{calculatedTimes.midnight}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">جاري حساب المواقيت...</div>
                )}

                {/* Sub-note with quick navigation to post-prayer taqibat */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>كل صلاة مفروضة لها تعقيب مستحب مأثور.</span>
                  <button
                    onClick={() => {
                      // Redirect to read sub tab hadiths or taqibat
                      setReadSubTab('hadiths'); // or we can open specific Fajr / Dhuhr taqiba
                      setActiveTab('read');
                    }}
                    className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
                  >
                    تصفح التعقيبات الآن ←
                  </button>
                </div>
              </div>

              {/* Qibla Compass Block */}
              <QiblaCompass 
                latitude={settings.latitude} 
                longitude={settings.longitude} 
                cityName={CITY_PRESETS.find(c => c.name === settings.city)?.arabicName || settings.city} 
              />
            </div>

            {/* Virtues of prayers widget */}
            <div className={`p-5 rounded-3xl border ${getContainerClass()}`} id="prayer-virtues-box">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-1.5">
                <HelpCircle className="w-4.5 h-4.5 text-amber-500" />
                <span>من فضل الصلوات المفروضة</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                رُوي عن رسول الله (ص) أنه قال: "إنَّمَا مَثَلُ الصَّلَاةِ فِيكمْ كَمَثَلِ نَهْرٍ جَارٍ بَيْنَ أَيْدِيكمْ يَغْتَسِلُ مِنْهُ أَحَدُكمْ كُلَّ يَوْمٍ خَمْسَ مَرَّاتٍ، فَلَا يَبْقَى مِنْ دَرَنِهِ شَيْءٌ." الصلاة أول وقتها رضوان الله، وأوسطها رحمة الله، وآخرها عفو الله.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: READ (اقرأ) */}
        {activeTab === 'read' && (
          <div className="space-y-6" id="read-tab-view">
            {/* Nav tabs for sub chapters */}
            <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl shrink-0" id="read-sub-tabs">
              <button
                onClick={() => setReadSubTab('hadiths')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${readSubTab === 'hadiths' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                الأحاديث الشريفة ({localHadiths.length})
              </button>
              <button
                onClick={() => setReadSubTab('wisdoms')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${readSubTab === 'wisdoms' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                الحكم والمواعظ ({localWisdoms.length})
              </button>
              <button
                onClick={() => setReadSubTab('munajat')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${readSubTab === 'munajat' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                تعقيبات ومناجيات ({localTaqibat.length + localMunajat.length})
              </button>
            </div>

            {/* Sub content stages */}
            {readSubTab === 'hadiths' && (
              <div className="grid grid-cols-1 gap-4" id="read-hadiths-grid">
                {localHadiths.map((item) => (
                  <div key={item.id} className={`p-5 rounded-2xl border ${getContainerClass()} flex flex-col justify-between relative overflow-hidden`}>
                    <div className="text-right">
                      <span className="text-[9px] font-sans font-bold text-amber-600 dark:text-amber-400 block mb-2">حديث مروي عن {item.narrator}</span>
                      <p className="text-base text-slate-700 dark:text-slate-100 font-serif font-semibold leading-relaxed">
                        " {item.text} "
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-2">المصدر: {item.source}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {item.tags.map((tag, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleTagSearch(tag)}
                          className="text-[10px] font-sans px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full hover:bg-amber-500/20 hover:text-amber-400 transition-colors"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => setActiveReader({
                          id: item.id,
                          type: 'hadith',
                          title: `حديث مروي عن ${item.narrator}`,
                          text: item.text,
                          tags: item.tags
                        })}
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>فتح في وضع القراءة ←</span>
                      </button>

                      <button
                        onClick={() => handleToggleFavorite('hadith', item.id, `حديث عن ${item.narrator}`)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                        title="إضافة للمفضلة"
                      >
                        <Heart className={`w-4.5 h-4.5 ${isFavorite('hadith', item.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {readSubTab === 'wisdoms' && (
              <div className="grid grid-cols-1 gap-4" id="read-wisdoms-grid">
                {localWisdoms.map((item) => (
                  <div key={item.id} className={`p-5 rounded-2xl border ${getContainerClass()} flex flex-col justify-between relative overflow-hidden`}>
                    <div className="text-right">
                      <span className="text-[9px] font-sans font-bold text-amber-600 dark:text-amber-400 block mb-2">من درر وحكم {item.author}</span>
                      <p className="text-base text-slate-700 dark:text-slate-100 font-serif font-semibold leading-relaxed">
                        " {item.text} "
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {item.tags.map((tag, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleTagSearch(tag)}
                          className="text-[10px] font-sans px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full hover:bg-amber-500/20 hover:text-amber-400 transition-colors"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => setActiveReader({
                          id: item.id,
                          type: 'wisdom',
                          title: `حكمة بليغة من حكم ${item.author}`,
                          text: item.text,
                          tags: item.tags
                        })}
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>فتح في وضع القراءة ←</span>
                      </button>

                      <button
                        onClick={() => handleToggleFavorite('wisdom', item.id, `حكمة للإمام علي (ع)`)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Heart className={`w-4.5 h-4.5 ${isFavorite('wisdom', item.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {readSubTab === 'munajat' && (
              <div className="space-y-6" id="read-munajat-list">
                {/* 1. Taqibat */}
                <div>
                  <h4 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>تعقيبات الصلوات اليومية</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {localTaqibat.map((item) => (
                      <div key={item.id} className={`p-4 rounded-xl border ${getContainerClass()} flex items-center justify-between`}>
                        <div>
                          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.title}</h5>
                          <p className="text-[11px] text-slate-400 font-sans mt-0.5">{item.virtue}</p>
                        </div>
                        <button
                          onClick={() => setActiveReader({
                            id: item.id,
                            type: 'taqiba',
                            title: item.title,
                            text: item.text,
                            tags: item.tags
                          })}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-amber-500 hover:text-slate-950 text-xs font-bold transition-all shrink-0"
                        >
                          تلاوة العمل
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Munajat */}
                <div>
                  <h4 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>المناجيات الخمسة عشر (للإمام السجاد ع)</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {localMunajat.map((item) => (
                      <div key={item.id} className={`p-4 rounded-xl border ${getContainerClass()} flex items-center justify-between`}>
                        <div>
                          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.title}</h5>
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-850 text-slate-400 font-sans rounded">مناجاة خاشعة</span>
                        </div>
                        <button
                          onClick={() => setActiveReader({
                            id: item.id,
                            type: 'munajat',
                            title: item.title,
                            text: item.text,
                            tags: item.tags
                          })}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-amber-500 hover:text-slate-950 text-xs font-bold transition-all shrink-0"
                        >
                          تلاوة العمل
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DUAS & ZIYARAT (الأدعية والزيارات الأسبوعية) */}
        {activeTab === 'duas_ziyarat' && (
          <div className="space-y-6" id="duas-ziyarat-tab-view">
            {/* Sub-nav switcher */}
            <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl shrink-0" id="duas-ziyarat-sub-tabs">
              <button
                onClick={() => setDuasSubTab('weekly_duas')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${duasSubTab === 'weekly_duas' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                الأدعية الأسبوعية
              </button>
              <button
                onClick={() => setDuasSubTab('weekly_ziyarat')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${duasSubTab === 'weekly_ziyarat' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                الزيارات الأسبوعية
              </button>
              <button
                onClick={() => setDuasSubTab('general_duas')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${duasSubTab === 'general_duas' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                مأثورات عامة
              </button>
            </div>

            {/* Weekly Duas */}
            {duasSubTab === 'weekly_duas' && (
              <div className="space-y-3" id="weekly-duas-list">
                {localWeeklyDuas.map((item) => (
                  <div key={item.id} className={`p-4 rounded-xl border ${getContainerClass()} flex items-center justify-between`}>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.title}</h4>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5">مخصص لـ {WEEKDAYS_AR[item.day]}</p>
                    </div>
                    <button
                      onClick={() => setActiveReader({
                        id: item.id,
                        type: 'dua',
                        title: item.title,
                        text: item.text,
                        tags: item.tags
                      })}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold rounded-lg transition-all"
                    >
                      تلاوة الدعاء
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Weekly Ziyarat */}
            {duasSubTab === 'weekly_ziyarat' && (
              <div className="space-y-3" id="weekly-ziyarat-list">
                {localWeeklyZiyarat.map((item) => (
                  <div key={item.id} className={`p-4 rounded-xl border ${getContainerClass()} flex items-center justify-between`}>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.title}</h4>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5">مخصصة لـ {WEEKDAYS_AR[item.day]}</p>
                    </div>
                    <button
                      onClick={() => setActiveReader({
                        id: item.id,
                        type: 'ziyarat',
                        title: item.title,
                        text: item.text,
                        tags: item.tags
                      })}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold rounded-lg transition-all"
                    >
                      تلاوة الزيارة
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* General Duas */}
            {duasSubTab === 'general_duas' && (
              <div className="space-y-4 text-center py-8 text-slate-400" id="general-duas-placeholder">
                <Compass className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-xs">المأثورات العامة تشمل التواشيح والمقاطع الروحية العامة.</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400">يمكنك البحث عن أي نص في "البحث الشامل" للوصول السريع.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: INTERACTIVE HIJRI CALENDAR (التقويم الهجري) */}
        {activeTab === 'calendar' && (
          <div className="space-y-6" id="calendar-tab-view">
            {/* Header / Month navigations */}
            <div className={`p-4 rounded-2xl border ${getContainerClass()} flex items-center justify-between shrink-0`} id="calendar-month-selector">
              <button
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear(calendarYear - 1);
                  } else {
                    setCalendarMonth(calendarMonth - 1);
                  }
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                id="cal-prev-month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <div className="text-center">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 font-serif">
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  التقويم الهجري والقمري التفاعلي
                </p>
              </div>

              <button
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear(calendarYear + 1);
                  } else {
                    setCalendarMonth(calendarMonth + 1);
                  }
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                id="cal-next-month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Grid Days of Week */}
            <div className="grid grid-cols-7 gap-1 text-center shrink-0">
              {WEEKDAYS_AR.map((day, idx) => (
                <div key={idx} className="text-[11px] font-bold text-slate-400 py-1 font-sans">
                  {day.substring(0, 3)}
                </div>
              ))}
            </div>

            {/* 42 cells Calendar Matrix */}
            <div className="grid grid-cols-7 gap-1.5" id="calendar-grid-cells">
              {generateCalendarGrid(calendarYear, calendarMonth, settings.hijriAdjustment).map((cell, idx) => {
                // Check if this cell's Hijri day has a registered event
                const hasEvent = localEvents.some(e => e.month === cell.hijriMonth && e.day === cell.hijriDay);
                const isSelected = selectedDay && selectedDay.gregorianDate.getTime() === cell.gregorianDate.getTime();

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(cell)}
                    className={`aspect-square p-1.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all relative ${
                      !cell.isCurrentMonth ? 'opacity-30 border-transparent bg-transparent' : 'bg-white dark:bg-slate-900'
                    } ${
                      cell.isToday ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-100 dark:border-slate-800'
                    } ${
                      isSelected ? 'bg-amber-500/10 border-amber-500 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    {/* Gregorian cell number at top left */}
                    <span className="text-[10px] font-sans text-slate-400 dark:text-slate-500 self-start">{cell.dayOfMonth}</span>
                    
                    {/* Event alert badge in center */}
                    {hasEvent && cell.isCurrentMonth && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 shadow-sm" />
                    )}

                    {/* Hijri day number in center */}
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 text-center self-center">{cell.hijriDay}</span>
                    
                    {/* Hijri month name abbreviated at bottom */}
                    <span className="text-[8px] font-sans text-slate-500 text-center line-clamp-1">{cell.hijriMonthName.substring(0, 10)}</span>
                  </div>
                );
              })}
            </div>

            {/* Selected day events detail view panel */}
            {selectedDay && (
              <div className={`p-5 rounded-3xl border ${getContainerClass()}`} id="calendar-detail-panel">
                <span className="text-[10px] font-sans font-bold text-amber-600 dark:text-amber-400 block mb-2">أعمال ومناسبات التاريخ المحدد</span>
                <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 font-serif">
                  {selectedDay.hijriDay} {selectedDay.hijriMonthName} {selectedDay.hijriYear} هـ
                </h4>
                <p className="text-xs text-slate-400 mt-1 font-sans">تطابق غريغوري: {selectedDay.gregorianDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

                {dayEvent ? (
                  <div className="mt-4 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <div>
                      <span className="text-xs px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 rounded-full font-bold">★ {dayEvent.title}</span>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 font-sans leading-relaxed">{dayEvent.description}</p>
                    </div>

                    {dayEvent.actions.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-slate-500 block mb-1">الأعمال المستحبة لليوم:</span>
                        <ul className="space-y-1">
                          {dayEvent.actions.map((act, idx) => (
                            <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5" />
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {dayEvent.duas.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-slate-500 block mb-1">الأدعية المخصوصة:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {dayEvent.duas.map((dua, idx) => (
                            <span key={idx} className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                              {dua}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                    لا توجد مناسبات مسجلة في هذا اليوم الهجري بعينه. يستحب الاستغفار وسورة يس، والتفكر وطلب الرزق والبركة.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: GLOBAL SEARCH INDEX (البحث الشامل) */}
        {activeTab === 'search' && (
          <div className="space-y-6" id="search-tab-view">
            {/* Search Input box */}
            <div className={`p-4 rounded-2xl border ${getContainerClass()} flex items-center gap-3 shrink-0`}>
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث في الأحاديث، الحكم، الأدعية، الزيارات، أو بالوسوم (مثلاً: الصبر)..."
                className="w-full bg-transparent border-none outline-none text-sm placeholder-slate-400 text-slate-800 dark:text-slate-100 font-sans"
                id="search-input-field"
              />
            </div>

            {/* Quick tags to click search */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <span className="text-xs text-slate-400 self-center">وسوم شائعة:</span>
              {['الصبر', 'العلم', 'الأخلاق', 'الرزق', 'الفرج', 'رمضان'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(tag)}
                  className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>

            {/* Results stage */}
            {searchResults ? (
              <div className="space-y-6">
                {/* 1. Category Count breakdown (طالبها المستخدم بنظام العد التفصيلي كإحصائية) */}
                <div className={`p-4 rounded-xl border ${getContainerClass()}`} id="search-statistics-card">
                  <h4 className="font-bold text-xs text-slate-400 mb-2 uppercase">إحصائية نتائج البحث للكلمة: "{searchQuery}"</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2 bg-slate-50/50 dark:bg-slate-850/60 rounded">الأحاديث: <span className="font-bold text-amber-500">{searchResults.hadiths.length}</span></div>
                    <div className="p-2 bg-slate-50/50 dark:bg-slate-850/60 rounded">الحكم والدرر: <span className="font-bold text-amber-500">{searchResults.wisdoms.length}</span></div>
                    <div className="p-2 bg-slate-50/50 dark:bg-slate-850/60 rounded">الأدعية والزيارات: <span className="font-bold text-amber-500">{searchResults.weeklyDuas.length + searchResults.weeklyZiyarat.length}</span></div>
                    <div className="p-2 bg-slate-50/50 dark:bg-slate-850/60 rounded">المناسبات: <span className="font-bold text-amber-500">{searchResults.events.length}</span></div>
                  </div>
                </div>

                {/* 2. List results */}
                {searchResults.totalCount > 0 ? (
                  <div className="space-y-4">
                    {/* Hadith search matches */}
                    {searchResults.hadiths.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => setActiveReader({
                          id: item.id,
                          type: 'hadith',
                          title: `حديث عن ${item.narrator}`,
                          text: item.text,
                          tags: item.tags
                        })}
                        className={`p-4 rounded-xl border ${getContainerClass()} hover:border-amber-500 transition-colors cursor-pointer flex flex-col justify-between`}
                      >
                        <div>
                          <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full font-bold mb-1.5 inline-block">حديث شريف</span>
                          <p className="text-sm font-serif line-clamp-2 leading-relaxed">" {item.text} "</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2">— مروي عن {item.narrator}</span>
                      </div>
                    ))}

                    {/* Wisdom matches */}
                    {searchResults.wisdoms.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => setActiveReader({
                          id: item.id,
                          type: 'wisdom',
                          title: `حكمة من حكم ${item.author}`,
                          text: item.text,
                          tags: item.tags
                        })}
                        className={`p-4 rounded-xl border ${getContainerClass()} hover:border-amber-500 transition-colors cursor-pointer flex flex-col justify-between`}
                      >
                        <div>
                          <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full font-bold mb-1.5 inline-block">حكمة بليغة</span>
                          <p className="text-sm font-serif line-clamp-2 leading-relaxed">" {item.text} "</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2">— {item.author}</span>
                      </div>
                    ))}

                    {/* Supplications matches */}
                    {searchResults.weeklyDuas.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => setActiveReader({
                          id: item.id,
                          type: 'dua',
                          title: item.title,
                          text: item.text,
                          tags: item.tags
                        })}
                        className={`p-4 rounded-xl border ${getContainerClass()} hover:border-amber-500 transition-colors cursor-pointer flex justify-between items-center`}
                      >
                        <div>
                          <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full font-bold mb-1.5 inline-block">دعاء أسبوعي</span>
                          <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100">{item.title}</h5>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400">لا توجد نتائج مطابقة لبحثك. جرب البحث بكلمات أخرى.</div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200/50 dark:border-slate-800 rounded-3xl" id="search-intro-panel">
                <Search className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-xs">اكتب أي كلمة للبحث الفوري والسريع في كامل الكتب والمأثورات المتاحة أوفلاين.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: FAVORITES (المفضلة) */}
        {activeTab === 'favorites' && (
          <div className="space-y-6" id="favorites-tab-view">
            {/* Favorite category tags */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-x-auto shrink-0" id="favorites-sub-tabs">
              <button
                onClick={() => setFavSubTab('hadith')}
                className={`px-4 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${favSubTab === 'hadith' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
              >
                أحاديث
              </button>
              <button
                onClick={() => setFavSubTab('wisdom')}
                className={`px-4 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${favSubTab === 'wisdom' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
              >
                حِكَم
              </button>
              <button
                onClick={() => setFavSubTab('dua')}
                className={`px-4 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${favSubTab === 'dua' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
              >
                أدعية وزيارات
              </button>
            </div>

            {/* List of matching favorites */}
            {(() => {
              const matchedFavs = dbFavorites.filter(f => f.type === favSubTab);
              if (matchedFavs.length > 0) {
                return (
                  <div className="grid grid-cols-1 gap-3">
                    {matchedFavs.map((fav) => (
                      <div 
                        key={fav.id}
                        onClick={async () => {
                          // fetch full item and open in reader
                          let text = '';
                          let tags: string[] = [];
                          
                          if (fav.type === 'hadith') {
                            const match = await db.hadiths.get(fav.itemId);
                            if (match) { text = match.text; tags = match.tags; }
                          } else if (fav.type === 'wisdom') {
                            const match = await db.wisdoms.get(fav.itemId);
                            if (match) { text = match.text; tags = match.tags; }
                          } else if (fav.type === 'dua') {
                            const match = await db.weekly_duas.get(fav.itemId);
                            if (match) { text = match.text; tags = match.tags; }
                          }

                          if (text) {
                            setActiveReader({
                              id: fav.itemId,
                              type: fav.type as any,
                              title: fav.title,
                              text,
                              tags
                            });
                          }
                        }}
                        className={`p-4 rounded-xl border ${getContainerClass()} hover:border-amber-500 transition-colors cursor-pointer flex items-center justify-between`}
                      >
                        <div>
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">{fav.title}</h4>
                          <span className="text-[10px] text-slate-400 font-sans">أضيفت {new Date(fav.addedAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200/50 dark:border-slate-800 rounded-2xl">
                  لا توجد عناصر مفضلة مسجلة في هذا القسم بعد.
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 8: SETTINGS (الإعدادات) */}
        {activeTab === 'settings' && (
          <div className="space-y-6" id="settings-tab-view">
            {/* Location settings */}
            <div className={`p-5 rounded-3xl border ${getContainerClass()}`}>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4">تحديد المدينة والموقع الحالي</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-2 font-sans">اختر مدينتك من القائمة (لحساب المواقيت والقبلة):</label>
                  <select
                    value={settings.city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full p-2 bg-slate-100 dark:bg-slate-900 text-sm rounded-xl outline-none text-slate-800 dark:text-slate-100 font-sans border border-slate-200/40 dark:border-slate-800"
                  >
                    {CITY_PRESETS.map((preset) => (
                      <option key={preset.name} value={preset.name}>
                        {preset.arabicName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Calculations method */}
            <div className={`p-5 rounded-3xl border ${getContainerClass()}`}>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4">طريقة حساب أوقات الصلوات</h3>
              <div>
                <select
                  value={settings.calculationMethod}
                  onChange={(e) => handleMethodChange(e.target.value)}
                  className="w-full p-2 bg-slate-100 dark:bg-slate-900 text-sm rounded-xl outline-none text-slate-800 dark:text-slate-100 font-sans border border-slate-200/40 dark:border-slate-800"
                >
                  <option value="Shia">مؤسسة لوا (قم) - الشيعة الإثني عشرية</option>
                  <option value="UmmAlQura">جامعة أم القرى (مكة المكرمة)</option>
                  <option value="Egypt">الهيئة المصرية العامة للمساحة</option>
                  <option value="MWL">رابطة العالم الإسلامي</option>
                  <option value="Karachi">جامعة العلوم الإسلامية بكراتشي</option>
                </select>
              </div>
            </div>

            {/* Appearance settings */}
            <div className={`p-5 rounded-3xl border ${getContainerClass()}`}>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4">تخصيص المظهر وتجربة القراءة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Theme selection */}
                <div>
                  <label className="text-slate-400 block mb-2 font-sans">نمط المظهر (الثيم):</label>
                  <select
                    value={settings.theme}
                    onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                    className="w-full p-2 bg-slate-100 dark:bg-slate-900 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-sans border border-slate-200/40 dark:border-slate-800"
                  >
                    <option value="warm">مريح للعين (رمادي دافئ)</option>
                    <option value="night">الوضع الداكن (أسود معتدل)</option>
                    <option value="gold">الذهبي الكلاسيكي (رملي قديم)</option>
                    <option value="light">الوضع الفاتح الصافي</option>
                  </select>
                </div>

                {/* Font selection */}
                <div>
                  <label className="text-slate-400 block mb-2 font-sans">نوع الخط:</label>
                  <select
                    value={settings.font}
                    onChange={(e) => handlePreferenceChange('font', e.target.value)}
                    className="w-full p-2 bg-slate-100 dark:bg-slate-900 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-sans border border-slate-200/40 dark:border-slate-800"
                  >
                    <option value="cairo">خط القاهرة (سانس حديث وعصري)</option>
                    <option value="amiri">خط الأميري النَسخي (للأحاديث والآيات)</option>
                    <option value="tajawal">خط تجوال المبسط والأنيق</option>
                    <option value="inter">خط إنتر القياسي للواجهات</option>
                  </select>
                </div>

                {/* Font Size */}
                <div>
                  <label className="text-slate-400 block mb-2 font-sans">حجم خط العرض:</label>
                  <select
                    value={settings.fontSize}
                    onChange={(e) => handlePreferenceChange('fontSize', e.target.value)}
                    className="w-full p-2 bg-slate-100 dark:bg-slate-900 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-sans border border-slate-200/40 dark:border-slate-800"
                  >
                    <option value="sm">صغير (مدمج)</option>
                    <option value="md">متوسط (افتراضي)</option>
                    <option value="lg">كبير</option>
                    <option value="xl">ضخم ومقروء جداً</option>
                  </select>
                </div>

                {/* Hijri day adjustment */}
                <div>
                  <label className="text-slate-400 block mb-2 font-sans">تعديل التاريخ الهجري (بالأيام):</label>
                  <select
                    value={settings.hijriAdjustment}
                    onChange={(e) => handlePreferenceChange('hijriAdjustment', Number(e.target.value))}
                    className="w-full p-2 bg-slate-100 dark:bg-slate-900 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-sans border border-slate-200/40 dark:border-slate-800"
                  >
                    <option value="-2">تأخير يومين (-2)</option>
                    <option value="-1">تأخير يوم واحد (-1)</option>
                    <option value="0">مطابق (افتراضي)</option>
                    <option value="1">تقديم يوم واحد (+1)</option>
                    <option value="2">تقديم يومين (+2)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Offline Sync and Rebuild section */}
            <div className={`p-5 rounded-3xl border ${getContainerClass()}`} id="settings-rebuild-box">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-2">إدارة قاعدة البيانات غير المتصلة بالإنترنت</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-sans">
                يعمل التطبيق بالكامل بالاعتماد على قاعدة البيانات المحلية IndexedDB. في حال حدوث أي خطأ في استيراد البيانات أو الرغبة في تحديثها يدوياً من المصدر، يمكنك تصفير وإعادة بناء قاعدة البيانات الآن.
              </p>
              
              <div className="flex flex-col md:flex-row gap-2">
                <button
                  onClick={handleRebuildDatabase}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  id="rebuild-db-action-btn"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة بناء قاعدة البيانات ومزامنتها</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Persistent Sticky Bottom Navigation Bar (تبويبات خفيفة وبسيطة) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-2 py-2 flex justify-around items-center z-20 shrink-0 md:max-w-md md:mx-auto md:rounded-t-3xl shadow-2xl">
        <button
          onClick={() => { setActiveTab('home'); }}
          className={`flex flex-col items-center p-2 rounded-xl transition-all ${getActiveTabClass('home')}`}
          title="الرئيسية"
          id="tab-btn-home"
        >
          <Home className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-bold mt-1">الرئيسية</span>
        </button>

        <button
          onClick={() => { setActiveTab('prayer'); }}
          className={`flex flex-col items-center p-2 rounded-xl transition-all ${getActiveTabClass('prayer')}`}
          title="المواقيت والقبلة"
          id="tab-btn-prayer"
        >
          <Clock className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-bold mt-1">المواقيت</span>
        </button>

        <button
          onClick={() => { setActiveTab('read'); }}
          className={`flex flex-col items-center p-2 rounded-xl transition-all ${getActiveTabClass('read')}`}
          title="اقرأ مأثورات"
          id="tab-btn-read"
        >
          <BookOpen className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-bold mt-1">اقرأ</span>
        </button>

        <button
          onClick={() => { setActiveTab('duas_ziyarat'); }}
          className={`flex flex-col items-center p-2 rounded-xl transition-all ${getActiveTabClass('duas_ziyarat')}`}
          title="الأدعية والزيارات"
          id="tab-btn-duas-ziyarat"
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-bold mt-1">الأدعية</span>
        </button>

        <button
          onClick={() => { setActiveTab('calendar'); }}
          className={`flex flex-col items-center p-2 rounded-xl transition-all ${getActiveTabClass('calendar')}`}
          title="التقويم الهجري"
          id="tab-btn-calendar"
        >
          <CalendarDays className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-bold mt-1">التقويم</span>
        </button>

        <button
          onClick={() => { setActiveTab('favorites'); }}
          className={`flex flex-col items-center p-2 rounded-xl transition-all ${getActiveTabClass('favorites')}`}
          title="المفضلة"
          id="tab-btn-favorites"
        >
          <Heart className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-bold mt-1">المفضلة</span>
        </button>
      </nav>

      {/* FULL SCREEN Distraction-free Script Reader mode */}
      {activeReader && (
        <ReaderMode
          itemId={activeReader.id}
          type={activeReader.type}
          title={activeReader.title}
          text={activeReader.text}
          tags={activeReader.tags}
          onClose={() => setActiveReader(null)}
          isFavorite={isFavorite(activeReader.type, activeReader.id)}
          onToggleFavorite={() => handleToggleFavorite(activeReader.type, activeReader.id, activeReader.title)}
        />
      )}
    </div>
  );
}
