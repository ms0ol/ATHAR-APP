import React, { useEffect, useState, useRef } from 'react';
import { db } from '../db/database';
import { 
  X, ZoomIn, ZoomOut, Maximize2, Minimize2, 
  Copy, Share2, Heart, Check, Smartphone, 
  ArrowUp, Sparkles, Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReaderModeProps {
  itemId: string;
  type: 'hadith' | 'wisdom' | 'dua' | 'ziyarat' | 'taqiba' | 'event' | 'munajat';
  title: string;
  text: string;
  tags: string[];
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export const ReaderMode: React.FC<ReaderModeProps> = ({
  itemId,
  type,
  title,
  text,
  tags,
  onClose,
  isFavorite,
  onToggleFavorite
}) => {
  // Reading configurations
  const [fontSize, setFontSize] = useState<number>(22); // pixels
  const [lineHeight, setLineHeight] = useState<number>(2.0); // ems
  const [fullScreen, setFullScreen] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [shared, setShared] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<any>(null);

  // Restore previous progress
  useEffect(() => {
    async function restoreProgress() {
      const progress = await db.user_reading_progress.get(itemId);
      if (progress && containerRef.current) {
        setProgressPercent(progress.progressPercentage);
        // Wait for render to scroll
        setTimeout(() => {
          if (containerRef.current) {
            const scrollHeight = containerRef.current.scrollHeight - containerRef.current.clientHeight;
            containerRef.current.scrollTop = (progress.progressPercentage / 100) * scrollHeight;
          }
        }, 100);
      } else {
        setProgressPercent(0);
      }
    }
    restoreProgress();
  }, [itemId]);

  // Request Wake Lock to prevent screen sleep
  useEffect(() => {
    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
        } catch (err) {
          console.warn('Wake lock request failed:', err);
        }
      }
    }
    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
          setWakeLockActive(false);
        });
      }
    };
  }, []);

  // Handle scroll to track progress
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const totalScrollable = scrollHeight - clientHeight;
    if (totalScrollable <= 0) return;
    
    const percentage = Math.round((scrollTop / totalScrollable) * 100);
    setProgressPercent(percentage);

    // Save progress to database (throttled conceptually via immediate updates in state)
    db.user_reading_progress.put({
      itemId,
      type,
      title,
      lastPosition: scrollTop,
      progressPercentage: percentage,
      updatedAt: Date.now()
    });
  };

  // Copy text helper
  const handleCopy = () => {
    navigator.clipboard.writeText(`${title}\n\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share helper
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text,
          url: window.location.href
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {
        console.warn('Share API failed, falling back to copy:', err);
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="fixed inset-0 bg-slate-950 text-slate-100 z-50 flex flex-col font-serif"
      id="reader-mode-overlay"
    >
      {/* Top Bar (distraction-free, minimal) */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="إغلاق"
            id="reader-close-btn"
          >
            <X className="w-6 h-6" />
          </button>
          <div>
            <span className="text-[10px] font-sans font-medium px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
              وضع القراءة
            </span>
            <h2 className="text-sm font-sans font-bold text-slate-200 line-clamp-1 mt-0.5">
              {title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Stats / Wake Lock indicator */}
          {wakeLockActive && (
            <span className="hidden md:flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-sans">
              <Smartphone className="w-3 h-3" />
              <span>الشاشة مفعّلة</span>
            </span>
          )}

          {/* Quick Reader Settings Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title="تخصيص الخط والسطور"
            id="reader-settings-toggle"
          >
            <Sliders className="w-5 h-5" />
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative"
            title="نسخ"
            id="reader-copy-btn"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="مشاركة"
            id="reader-share-btn"
          >
            {shared ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
          </button>

          {/* Favorite */}
          <button
            onClick={onToggleFavorite}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-800 rounded-lg transition-colors"
            title={isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
            id="reader-fav-btn"
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900 border-b border-slate-800 px-6 py-4 overflow-hidden shrink-0 font-sans"
            id="reader-settings-panel"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto text-slate-200">
              {/* Font Size controls */}
              <div>
                <span className="text-xs font-medium text-slate-400 block mb-2">حجم خط القراءة</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFontSize(Math.max(16, fontSize - 2))}
                    className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center gap-1 text-sm border border-slate-700 transition-colors"
                  >
                    <ZoomOut className="w-4 h-4" />
                    <span>تصغير</span>
                  </button>
                  <span className="text-sm font-bold min-w-10 text-center">{fontSize}px</span>
                  <button
                    onClick={() => setFontSize(Math.min(36, fontSize + 2))}
                    className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center gap-1 text-sm border border-slate-700 transition-colors"
                  >
                    <ZoomIn className="w-4 h-4" />
                    <span>تكبير</span>
                  </button>
                </div>
              </div>

              {/* Line Height controls */}
              <div>
                <span className="text-xs font-medium text-slate-400 block mb-2">التباعد بين الأسطر</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setLineHeight(Math.max(1.4, lineHeight - 0.2))}
                    className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm border border-slate-700 transition-colors"
                  >
                    تضييق
                  </button>
                  <span className="text-sm font-bold min-w-10 text-center">{lineHeight.toFixed(1)}</span>
                  <button
                    onClick={() => setLineHeight(Math.min(3.0, lineHeight + 0.2))}
                    className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm border border-slate-700 transition-colors"
                  >
                    توسيع
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Linear Reading Progress Indicator */}
      <div className="h-1 w-full bg-slate-850 shrink-0">
        <div 
          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-100"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Scripture Text Stage */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 md:px-12 py-10 max-w-3xl mx-auto scroll-smooth w-full select-text leading-relaxed"
        style={{ 
          fontSize: `${fontSize}px`, 
          lineHeight: `${lineHeight}`,
          fontFamily: "'Amiri', serif"
        }}
        id="reader-text-scrollable"
      >
        {/* Header inside scripture */}
        <div className="text-center mb-10 pb-6 border-b border-slate-800/60 font-sans shrink-0">
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-amber-400">
            {title}
          </h1>
          {progressPercent > 0 && (
            <p className="text-xs text-slate-500 mt-2 font-sans">
              نسبة الإنجاز: {progressPercent}%
            </p>
          )}
        </div>

        {/* Sacred Text with high contrast and classic padding */}
        <div className="text-right text-slate-100 whitespace-pre-wrap font-serif text-justify font-amiri select-all">
          {text}
        </div>

        {/* Ending decoration */}
        <div className="text-center mt-12 pt-8 border-t border-slate-800/40 text-slate-600 flex flex-col items-center gap-2 font-sans">
          <Sparkles className="w-5 h-5 text-amber-600" />
          <span className="text-xs">الحمد لله رب العالمين</span>
        </div>
      </div>

      {/* Bottom status rail */}
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400 shrink-0 font-sans">
        <span>قراءة في {title}</span>
        <div className="flex items-center gap-3">
          <span>التقدم: {progressPercent}%</span>
          {progressPercent > 80 && (
            <span className="text-emerald-400 font-bold">مكتمل تقريباً</span>
          )}
          <button 
            onClick={scrollToTop}
            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold transition-colors"
          >
            <ArrowUp className="w-3 h-3" />
            <span>لأعلى</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
