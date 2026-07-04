import { db } from './database';

export interface ContentVersions {
  hadiths: number;
  wisdoms: number;
  taqibat: number;
  munajat: number;
  weekly_duas: number;
  weekly_ziyarat: number;
  hijri_events: number;
  tags_dictionary: number;
  smart_feed: number;
}

export async function checkAndImportData(onProgress?: (progress: string) => void): Promise<boolean> {
  try {
    onProgress?.('جاري التحقق من وجود تحديثات...');
    const response = await fetch('/data/content_versions.json');
    if (!response.ok) {
      throw new Error('فشل تحميل ملف الإصدارات');
    }
    const remoteVersions: ContentVersions = await response.json();

    // Get current local versions from user_settings
    const localVersionsSetting = await db.user_settings.get('content_versions');
    const localVersions: Partial<ContentVersions> = localVersionsSetting?.value || {};

    const tablesToUpdate: (keyof ContentVersions)[] = [];

    const keys: (keyof ContentVersions)[] = [
      'hadiths',
      'wisdoms',
      'taqibat',
      'munajat',
      'weekly_duas',
      'weekly_ziyarat',
      'hijri_events',
      'tags_dictionary',
      'smart_feed'
    ];

    for (const key of keys) {
      if (!localVersions[key] || localVersions[key]! < remoteVersions[key]) {
        tablesToUpdate.push(key);
      }
    }

    if (tablesToUpdate.length === 0) {
      // Check if actually empty (first launch safeguard)
      const hadithCount = await db.hadiths.count();
      if (hadithCount > 0) {
        onProgress?.('جميع البيانات محدثة ومطابقة.');
        return false;
      }
      // If count is 0, force download everything
      tablesToUpdate.push(...keys);
    }

    onProgress?.(`جاري مزامنة ${tablesToUpdate.length} أقسام من البيانات...`);

    for (const table of tablesToUpdate) {
      onProgress?.(`تنزيل واستيراد: ${getArabicTableName(table)}...`);
      const fileRes = await fetch(`/data/${table}.json`);
      if (!fileRes.ok) {
        console.error(`Failed to fetch /data/${table}.json`);
        continue;
      }
      const data = await fileRes.json();
      
      // Clear specific table and reload
      await (db[table] as any).clear();
      await (db[table] as any).bulkPut(data);
      
      localVersions[table] = remoteVersions[table];
      await db.user_settings.put({ key: 'content_versions', value: { ...localVersions } });
    }

    onProgress?.('اكتملت مزامنة قاعدة البيانات بنجاح.');
    await db.user_settings.put({ key: 'last_update_time', value: Date.now() });
    return true;
  } catch (error) {
    console.error('Error during data import:', error);
    onProgress?.('أنت تعمل دون اتصال بالإنترنت. سيتم استخدام النسخة المحلية.');
    
    // Check if we have local data as a fallback, otherwise seed some fallback defaults in memory
    const hadithCount = await db.hadiths.count();
    if (hadithCount === 0) {
      onProgress?.('قاعدة البيانات فارغة وتعمل أوفلاين. جاري إنشاء بيانات محلية احتياطية...');
      await seedOfflineFallback();
    }
    return false;
  }
}

export async function forceRebuildDatabase(onProgress?: (progress: string) => void): Promise<void> {
  onProgress?.('جاري تفريغ قاعدة البيانات بالكامل...');
  
  const tables: ('hadiths' | 'wisdoms' | 'taqibat' | 'munajat' | 'weekly_duas' | 'weekly_ziyarat' | 'hijri_events' | 'tags_dictionary' | 'smart_feed')[] = [
    'hadiths',
    'wisdoms',
    'taqibat',
    'munajat',
    'weekly_duas',
    'weekly_ziyarat',
    'hijri_events',
    'tags_dictionary',
    'smart_feed'
  ];

  for (const table of tables) {
    await (db[table] as any).clear();
  }
  
  await db.user_settings.delete('content_versions');
  await db.user_settings.delete('last_update_time');
  
  await checkAndImportData(onProgress);
}

function getArabicTableName(table: keyof ContentVersions): string {
  switch (table) {
    case 'hadiths': return 'الأحاديث';
    case 'wisdoms': return 'الحِكَم والأقوال';
    case 'taqibat': return 'تعقيبات الصلوات';
    case 'munajat': return 'المناجيات والهمسات';
    case 'weekly_duas': return 'الأدعية الأسبوعية';
    case 'weekly_ziyarat': return 'الزيارات الأسبوعية';
    case 'hijri_events': return 'التقويم والمناسبات';
    case 'tags_dictionary': return 'قاموس الوسوم';
    case 'smart_feed': return 'التقويم العبادي الذكي';
    default: return table;
  }
}

async function seedOfflineFallback() {
  // Safe seed if fetch failed and absolutely nothing in DB
  const hadiths = [
    {
      id: "h_1",
      text: "إِنَّمَا بُعِثْتُ لِأُتَمِّمَ مَكَارِمَ الْأَخْلَاقِ.",
      narrator: "رسول الله صلى الله عليه وآله وسلم",
      source: "بحار الأنوار",
      tags: ["الأخلاق", "الرسول"]
    }
  ];
  const wisdoms = [
    {
      id: "w_1",
      text: "الْعِلْمُ وِرَاثَةٌ كَرِيمَةٌ، وَالْآدَابُ حُلَلٌ مُجَدَّدَةٌ.",
      author: "الإمام علي عليه السلام",
      tags: ["العلم", "الأخلاق"]
    }
  ];
  const taqibat = [
    {
      id: "t_fajr",
      prayer: "fajr",
      title: "تعقيب صلاة الفجر",
      text: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَآلِ مُحَمَّدٍ، وَاجْعَلِ النُّورَ فِي بَصَرِي، وَالْبَصِيرَةَ فِي دِينِي.",
      virtue: "يجلب البركة والرزق.",
      tags: ["الصلاة", "الفجر"]
    }
  ];
  
  await db.hadiths.bulkPut(hadiths);
  await db.wisdoms.bulkPut(wisdoms);
  await db.taqibat.bulkPut(taqibat);
}
