import React, { useEffect, useState } from 'react';
import { db, Hadith, Wisdom, Taqibat, Munajat, WeeklyDua, WeeklyZiyarat, HijriEvent } from '../db/database';
import { BookOpen, Award, Sparkles, Heart } from 'lucide-react';

interface RelatedItem {
  id: string;
  type: 'hadith' | 'wisdom' | 'taqiba' | 'munajat' | 'dua' | 'ziyarat' | 'event';
  typeArabic: string;
  title: string;
  text: string;
  tags: string[];
  score: number;
}

interface RelatedContentProps {
  tags: string[];
  excludeId: string;
  onItemClick: (item: { id: string; type: string; title: string; text: string; tags: string[] }) => void;
}

export const RelatedContent: React.FC<RelatedContentProps> = ({ tags, excludeId, onItemClick }) => {
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);

  useEffect(() => {
    async function fetchRelated() {
      if (!tags || tags.length === 0) {
        setRelatedItems([]);
        return;
      }

      const matches: RelatedItem[] = [];

      try {
        // Query hadiths
        const hadiths = await db.hadiths.toArray();
        hadiths.forEach((h) => {
          if (h.id === excludeId) return;
          const score = h.tags.filter((t) => tags.includes(t)).length;
          if (score > 0) {
            matches.push({
              id: h.id,
              type: 'hadith',
              typeArabic: 'حديث شريف',
              title: `حديث مروي عن ${h.narrator}`,
              text: h.text,
              tags: h.tags,
              score
            });
          }
        });

        // Query wisdoms
        const wisdoms = await db.wisdoms.toArray();
        wisdoms.forEach((w) => {
          if (w.id === excludeId) return;
          const score = w.tags.filter((t) => tags.includes(t)).length;
          if (score > 0) {
            matches.push({
              id: w.id,
              type: 'wisdom',
              typeArabic: 'حكمة بليغة',
              title: `من حكم ${w.author}`,
              text: w.text,
              tags: w.tags,
              score
            });
          }
        });

        // Query taqibat
        const taqibat = await db.taqibat.toArray();
        taqibat.forEach((t) => {
          if (t.id === excludeId) return;
          const score = t.tags.filter((tg) => tags.includes(tg)).length;
          if (score > 0) {
            matches.push({
              id: t.id,
              type: 'taqiba',
              typeArabic: 'تعقيب صلاة',
              title: t.title,
              text: t.text,
              tags: t.tags,
              score
            });
          }
        });

        // Query munajat
        const munajat = await db.munajat.toArray();
        munajat.forEach((m) => {
          if (m.id === excludeId) return;
          const score = m.tags.filter((tg) => tags.includes(tg)).length;
          if (score > 0) {
            matches.push({
              id: m.id,
              type: 'munajat',
              typeArabic: 'مناجاة',
              title: m.title,
              text: m.text,
              tags: m.tags,
              score
            });
          }
        });

        // Query weekly_duas
        const weeklyDuas = await db.weekly_duas.toArray();
        weeklyDuas.forEach((d) => {
          if (d.id === excludeId) return;
          const score = d.tags.filter((tg) => tags.includes(tg)).length;
          if (score > 0) {
            matches.push({
              id: d.id,
              type: 'dua',
              typeArabic: 'دعاء',
              title: d.title,
              text: d.text,
              tags: d.tags,
              score
            });
          }
        });

        // Query weekly_ziyarat
        const weeklyZiyarat = await db.weekly_ziyarat.toArray();
        weeklyZiyarat.forEach((z) => {
          if (z.id === excludeId) return;
          const score = z.tags.filter((tg) => tags.includes(tg)).length;
          if (score > 0) {
            matches.push({
              id: z.id,
              type: 'ziyarat',
              typeArabic: 'زيارة',
              title: z.title,
              text: z.text,
              tags: z.tags,
              score
            });
          }
        });

        // Query events
        const events = await db.hijri_events.toArray();
        events.forEach((e) => {
          if (e.id === excludeId) return;
          const score = e.tags.filter((tg) => tags.includes(tg)).length;
          if (score > 0) {
            matches.push({
              id: e.id,
              type: 'event',
              typeArabic: 'مناسبة تاريخية',
              title: e.title,
              text: e.description,
              tags: e.tags,
              score
            });
          }
        });

        // Sort matches by relevance score (descending) and take top 4
        matches.sort((a, b) => b.score - a.score);
        setRelatedItems(matches.slice(0, 4));
      } catch (err) {
        console.error('Error fetching related content:', err);
      }
    }

    fetchRelated();
  }, [tags, excludeId]);

  if (relatedItems.length === 0) return null;

  return (
    <div className="mt-12 border-t border-slate-100 dark:border-slate-800 pt-8" id="related-content-container">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <span>قد يهمك أيضاً</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {relatedItems.map((item) => (
          <div
            key={item.id}
            id={`related-item-${item.id}`}
            onClick={() => onItemClick(item)}
            className="p-4 bg-slate-50 hover:bg-amber-50/50 dark:bg-slate-900/50 dark:hover:bg-amber-950/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs px-2.5 py-1 bg-amber-100/60 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 font-medium rounded-full">
                  {item.typeArabic}
                </span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  تطابق {Math.round((item.score / tags.length) * 100)}%
                </span>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                {item.title}
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 line-clamp-2 leading-relaxed font-serif">
                {item.text}
              </p>
            </div>
            <div className="flex flex-wrap gap-1 mt-4">
              {item.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[10px] px-1.5 py-0.5 bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
