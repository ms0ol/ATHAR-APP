import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, type UserFavorite } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  getCurrentContext, getSmartFeed, 
  type CurrentContext, type ResolvedFeedItem 
} from '../utils/contextEngine';
import { type PrayerTimes, getNextPrayer } from '../utils/prayerTimes';
import { getHijriDate } from '../utils/hijriCalendar';
import { 
  Clock, Compass, Sparkles, Check, CheckSquare, Square, 
  BookOpen, Heart, Share2, Copy, Calendar, Bookmark, Award, HelpCircle
} from 'lucide-react';

interface SmartTimelineProps {
  currentTime: Date;
  calculatedTimes: PrayerTimes | null;
  hijriAdjustment: number;
  theme: 'warm' | 'night' | 'gold' | 'light';
  onOpenReader: (item: {
    id: string;
    type: 'hadith' | 'wisdom' | 'dua' | 'ziyarat' | 'taqiba' | 'event' | 'munajat';
    title: string;
    text: string;
    tags: string[];
  }) => void;
  onNavigateToTab: (tab: 'home' | 'prayer' | 'read' | 'duas_ziyarat' | 'calendar' | 'favorites' | 'search' | 'settings') => void;
}

export function SmartTimeline({
  currentTime,
  calculatedTimes,
  hijriAdjustment,
  theme,
  onOpenReader,
  onNavigateToTab
}: SmartTimelineProps) {
  const [feed, setFeed] = useState<ResolvedFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('worship_completed_steps');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch user favorites for instant state update
  const favorites = useLiveQuery(() => db.user_favorites.toArray()) || [];

  // Hijri date and Gregorian date calculations
  const hijriToday = useMemo(() => {
    return getHijriDate(currentTime, hijriAdjustment);
  }, [currentTime, hijriAdjustment]);

  const formattedGregorianToday = useMemo(() => {
    return currentTime.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [currentTime]);

  const nextPrayerInfo = useMemo(() => {
    if (!calculatedTimes) return null;
    return getNextPrayer(calculatedTimes);
  }, [calculatedTimes, currentTime]);

  // Derive current context
  const context = useMemo(() => {
    if (!calculatedTimes) return null;
    return getCurrentContext(calculatedTimes, hijriAdjustment);
  }, [calculatedTimes, currentTime, hijriAdjustment]);

  // Fetch the active feed whenever context updates
  useEffect(() => {
    async function loadFeed() {
      if (!context) return;
      setLoading(true);
      const items = await getSmartFeed(context);
      setFeed(items);
      setLoading(false);
    }
    loadFeed();
  }, [context]);

  // Save completed steps to localStorage
  const handleToggleStep = (itemId: string, stepIndex: number) => {
    const key = `${itemId}_${stepIndex}`;
    const updated = { ...completedSteps, [key]: !completedSteps[key] };
    setCompletedSteps(updated);
    localStorage.setItem('worship_completed_steps', JSON.stringify(updated));
  };

  const handleCopyText = (item: ResolvedFeedItem) => {
    const contentToCopy = item.text || item.description || '';
    if (!contentToCopy) return;

    navigator.clipboard.writeText(contentToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleFavorite = async (item: ResolvedFeedItem) => {
    const type = item.contentType as any;
    const existing = await db.user_favorites
      .where('[type+itemId]')
      .equals([type, item.id])
      .first();

    if (existing) {
      await db.user_favorites.delete(existing.id!);
    } else {
      await db.user_favorites.put({
        type,
        itemId: item.id,
        title: item.title,
        addedAt: Date.now()
      });
    }
  };

  // Safe container styles mapping
  const getContainerClass = () => {
    switch (theme) {
      case 'warm': return 'bg-slate-800/40 border-slate-700/50 text-slate-100';
      case 'night': return 'bg-zinc-900/50 border-zinc-800 text-slate-100';
      case 'gold': return 'bg-[#23201a]/70 border-[#39342a] text-[#f7f2e9]';
      case 'light': return 'bg-white border-slate-100 shadow-sm text-slate-800';
    }
  };

  const getSubtleBgClass = () => {
    switch (theme) {
      case 'warm': return 'bg-slate-900/50 text-slate-300 border-slate-800';
      case 'night': return 'bg-zinc-950/40 text-slate-300 border-zinc-900';
      case 'gold': return 'bg-[#1b1914] text-[#d6cdb8] border-[#312c23]';
      case 'light': return 'bg-slate-50 text-slate-600 border-slate-200/60';
    }
  };

  const getPhaseHeader = () => {
    if (!context) {
      return {
        title: 'التقويم العبادي',
        color: 'text-amber-500',
        badge: 'جاري الحساب...',
        icon: <Calendar className="w-5 h-5 text-amber-500" />
      };
    }
    
    const { phase, targetPrayer } = context;
    const arabicPrayer = targetPrayer === 'fajr' ? 'الفجر' : targetPrayer === 'dhuhr' ? 'الظهر' : 'المغرب';

    if (phase === 'before_prayer') {
      return {
        title: `🌅 قبل صلاة ${arabicPrayer}`,
        color: 'text-amber-500',
        badge: `بقي على الأذان ${context.minutesToNext} دقيقة`,
        icon: <Clock className="w-5 h-5 animate-pulse text-amber-500" />
      };
    } else if (phase === 'during_prayer') {
      return {
        title: `🕌 وقت صلاة ${arabicPrayer}`,
        color: 'text-emerald-500',
        badge: 'حان الآن وقت الفريضة المباركة',
        icon: <Compass className="w-5 h-5 animate-spin text-emerald-500" style={{ animationDuration: '4s' }} />
      };
    } else if (phase === 'after_prayer') {
      return {
        title: `🌿 بعد صلاة ${arabicPrayer}`,
        color: 'text-indigo-400 dark:text-indigo-300',
        badge: `انقضت الصلاة منذ ${context.minutesSinceLast} دقيقة`,
        icon: <Award className="w-5 h-5 text-indigo-400" />
      };
    } else {
      // Normal time (Morning, Afternoon, Evening, Night)
      const dayLabel = context.isIslamicNight ? context.nightOf : `نهار ${context.weekday}`;
      return {
        title: `☀️ ${dayLabel}`,
        color: 'text-amber-400',
        badge: context.isIslamicNight ? 'هدأة الليل والمناجاة' : 'معاش النهار والذكر',
        icon: <Calendar className="w-5 h-5 text-amber-500" />
      };
    }
  };

  const phaseHeader = getPhaseHeader();

  return (
    <div className="space-y-6" id="smart-timeline-component">
      
      {/* 1. Gregorian & Hijri Date Header Widget with Next Prayer Countdown */}
      <div className={`p-6 rounded-3xl border ${getContainerClass()} flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden`} id="date-header-card">
        <div className="absolute -left-6 -bottom-6 text-slate-500/5 font-serif text-8xl pointer-events-none font-bold">Worship</div>
        <div>
          <span className="text-[10px] uppercase font-sans tracking-wider px-2.5 py-0.5 bg-amber-500/10 text-amber-500 dark:text-amber-400 font-semibold rounded-full border border-amber-500/20">
            اليوم الحالي
          </span>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 font-serif mt-2">
            {hijriToday.formatted}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
            {formattedGregorianToday}
          </p>
        </div>

        {/* Dynamic countdown summary */}
        {nextPrayerInfo ? (
          <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-2xl flex items-center gap-3.5">
            <div className="text-right">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">الصلاة القادمة: <span className="font-bold text-amber-500">{nextPrayerInfo.nextPrayerArabic}</span></p>
              <p className="text-lg font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {nextPrayerInfo.countdown}
              </p>
              <p className="text-[10px] text-slate-400 font-sans">متبقي على وقت الأذان</p>
            </div>
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">جاري حساب مواقيت الصلاة...</div>
        )}
      </div>

      {/* 2. Dynamic Phase Banner */}
      <div className={`p-6 rounded-3xl border ${getContainerClass()} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden`} id="timeline-phase-banner">
        <div className="absolute -left-10 -bottom-10 text-slate-500/5 font-serif text-9xl pointer-events-none font-bold select-none">Feed</div>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl shrink-0">
            {phaseHeader.icon}
          </div>
          <div>
            <span className="text-[10px] uppercase font-sans tracking-wider px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold rounded-full border border-amber-500/20">
              {phaseHeader.badge}
            </span>
            <h2 className="text-xl font-bold font-serif mt-2 flex items-center gap-2">
              <span className={phaseHeader.color}>{phaseHeader.title}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              متابعة عبادية ذكية ومستمرة بناءً على مكانك وتوقيتك الحالي.
            </p>
          </div>
        </div>

        {/* 2. Interactive Compass Shortcut for Prayer Phase */}
        {context?.phase === 'during_prayer' && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigateToTab('prayer')}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            id="qibla-redirect-btn"
          >
            <Compass className="w-4.5 h-4.5" />
            <span>حساب القبلة والبوصلة</span>
          </motion.button>
        )}
      </div>

      {/* 3. Feed List */}
      <div className="space-y-4" id="timeline-feed-list">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
            <Clock className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-xs">جاري بناء الخط الزمني العبادي الحالي...</p>
          </div>
        ) : feed.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs bg-slate-50/10 border border-dashed rounded-3xl">
            لا تتوفر عناصر حالية في التغذية الذكية.
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {feed.map((item, index) => {
              // Calculate checklist progress if actions exist
              const actionCount = item.actions?.length || 0;
              const checkedCount = item.actions?.filter((_, i) => completedSteps[`${item.id}_${i}`]).length || 0;
              const isFullyDone = actionCount > 0 && checkedCount === actionCount;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`p-5 rounded-2xl border ${getContainerClass()} flex flex-col justify-between transition-all relative overflow-hidden`}
                >
                  {/* Category Indicator Tag */}
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="text-[10px] font-sans font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/15">
                      {item.contentType === 'hadith' && '📖 حديث اليوم الشريف'}
                      {item.contentType === 'wisdom' && '💎 حكمة وعبرة اليوم'}
                      {item.contentType === 'dua' && '🤲 دعاء مأثور'}
                      {item.contentType === 'ziyarat' && '📿 زيارة مباركة'}
                      {item.contentType === 'taqiba' && '📿 تعقيب الصلاة'}
                      {item.contentType === 'event' && '📅 مناسبة هجرية'}
                      {item.contentType === 'munajat' && '🤲 مناجاة ربانية'}
                      {item.contentType === 'custom' && '✨ توجيه عبادي مستحب'}
                    </span>
                    
                    {/* Star Badge for high priority */}
                    {item.priority >= 50 && (
                      <span className="flex items-center gap-1 text-[10px] text-red-500 dark:text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/10">
                        <Sparkles className="w-3 h-3 text-red-500" />
                        أولوية كبرى
                      </span>
                    )}
                  </div>

                  {/* Title and Description */}
                  <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 font-serif leading-relaxed">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed font-sans">
                      {item.description}
                    </p>
                  )}

                  {/* Rich text quote (Hadith / Wisdom / Dua short text) */}
                  {item.text && (
                    <div className={`p-4 rounded-xl mt-3 font-serif text-sm italic border ${getSubtleBgClass()} leading-relaxed`}>
                      " {item.text} "
                      {(item.author || item.source) && (
                        <div className="text-[10px] text-slate-400 mt-2 not-italic font-sans flex items-center justify-end gap-1">
                          {item.author && <span>— {item.author}</span>}
                          {item.source && <span>| المصدر: {item.source}</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Interactive Checklist Actions */}
                  {item.actions && item.actions.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 font-sans">
                        <span>قائمة الأعمال والمستحبات:</span>
                        <span>{checkedCount} من {actionCount} مكتمل</span>
                      </div>
                      <div className="space-y-1.5">
                        {item.actions.map((act, idx) => {
                          const isDone = !!completedSteps[`${item.id}_${idx}`];
                          return (
                            <div 
                              key={idx}
                              onClick={() => handleToggleStep(item.id, idx)}
                              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 cursor-pointer transition-all ${
                                isDone 
                                  ? 'bg-amber-500/5 border-amber-500/20 text-slate-400 line-through decoration-slate-500/30' 
                                  : 'bg-slate-50/40 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500/5'
                              }`}
                            >
                              <div className="shrink-0 text-amber-500">
                                {isDone ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              </div>
                              <span className="leading-normal">{act}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons Toolbar */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    
                    {/* Read more button if it has full text */}
                    {item.text ? (
                      <button
                        onClick={() => onOpenReader({
                          id: item.id,
                          type: item.contentType as any,
                          title: item.title,
                          text: item.text || '',
                          tags: item.tags || []
                        })}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>افتح لوضع القراءة</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-amber-500" />
                        توجيه سياقي ذكي
                      </span>
                    )}

                    {/* Copy & Favorite icons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopyText(item)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-500 transition-colors"
                        title="نسخ المحتوى"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      {(() => {
                        const isFav = favorites.some(
                          (f) => f.type === item.contentType && f.itemId === item.id
                        );
                        return (
                          <button
                            onClick={() => handleToggleFavorite(item)}
                            className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ${
                              isFav
                                ? 'text-red-500 hover:text-red-600'
                                : 'text-slate-400 hover:text-red-500'
                            }`}
                            title={isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}
                          >
                            <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                        );
                      })()}
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

    </div>
  );
}
