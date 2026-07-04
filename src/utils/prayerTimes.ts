export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CityPreset {
  name: string;
  arabicName: string;
  latitude: number;
  longitude: number;
  timezone: number;
}

export type CalculationMethod = 'Shia' | 'UmmAlQura' | 'MWL' | 'Egypt' | 'Karachi';

export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  sunset: string;
  maghrib: string;
  isha: string;
  midnight: string;
}

export const CITY_PRESETS: CityPreset[] = [
  { name: 'Mecca', arabicName: 'مكة المكرمة', latitude: 21.4225, longitude: 39.8262, timezone: 3 },
  { name: 'Baghdad', arabicName: 'بغداد', latitude: 33.3152, longitude: 44.3661, timezone: 3 },
  { name: 'Najaf', arabicName: 'النجف الأشرف', latitude: 32.0259, longitude: 44.3463, timezone: 3 },
  { name: 'Karbala', arabicName: 'كربلاء المقدسة', latitude: 32.6160, longitude: 44.0249, timezone: 3 },
  { name: 'Cairo', arabicName: 'القاهرة', latitude: 30.0444, longitude: 31.2357, timezone: 2 },
  { name: 'Beirut', arabicName: 'بيروت', latitude: 33.8938, longitude: 35.5018, timezone: 2 },
  { name: 'Damascus', arabicName: 'دمشق', latitude: 33.5138, longitude: 36.2765, timezone: 3 },
  { name: 'Riyadh', arabicName: 'الرياض', latitude: 24.7136, longitude: 46.6753, timezone: 3 },
  { name: 'Tehran', arabicName: 'طهران', latitude: 35.6892, longitude: 51.3890, timezone: 3.5 },
  { name: 'London', arabicName: 'لندن', latitude: 51.5074, longitude: -0.1278, timezone: 1 },
  { name: 'Dearborn', arabicName: 'ديربورن', latitude: 42.3223, longitude: -83.1763, timezone: -4 },
  { name: 'Sydney', arabicName: 'سيدني', latitude: -33.8688, longitude: 151.2093, timezone: 10 }
];

// Mathematical degrees to radians and vice-versa
const degToRad = (deg: number) => (deg * Math.PI) / 180;
const radToDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Calculates the Qibla direction (angle from true North clockwise)
 */
export function calculateQibla(latitude: number, longitude: number): number {
  const kLat = degToRad(21.4225); // Kaaba latitude
  const kLon = degToRad(39.8262); // Kaaba longitude

  const phi = degToRad(latitude);
  const lambda = degToRad(longitude);

  const deltaLambda = kLon - lambda;

  const y = Math.sin(deltaLambda);
  const x = Math.cos(phi) * Math.tan(kLat) - Math.sin(phi) * Math.cos(deltaLambda);

  let qibla = radToDeg(Math.atan2(y, x));
  if (qibla < 0) {
    qibla += 360;
  }
  return qibla;
}

/**
 * Main Prayer Times calculator
 */
export function calculatePrayerTimes(
  date: Date,
  latitude: number,
  longitude: number,
  timezone: number,
  method: CalculationMethod = 'Shia'
): PrayerTimes {
  // Get day of year
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime() + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  // Astronomical calculations
  // B = 360/365 * (D - 81)
  const b = (360 / 365) * (dayOfYear - 81);
  const bRad = degToRad(b);

  // Equation of Time (in minutes)
  const eot = 9.87 * Math.sin(2 * bRad) - 7.53 * Math.cos(bRad) - 1.5 * Math.sin(bRad);

  // Solar Declination (in degrees)
  const declination = 23.44 * Math.sin(degToRad((360 / 365) * (dayOfYear - 80)));
  const decRad = degToRad(declination);
  const latRad = degToRad(latitude);

  // Base solar transit time (Dhuhr) in hours
  const localTransit = 12 + timezone - longitude / 15 - eot / 60;

  // Set method angles
  let fajrAngle = 18;
  let ishaAngle = 18;
  let maghribAngle = 4; // Used in Shia method (4 degrees after sunset)

  switch (method) {
    case 'Shia':
      fajrAngle = 16;
      ishaAngle = 14;
      maghribAngle = 4;
      break;
    case 'UmmAlQura':
      fajrAngle = 18.5;
      // Isha is strictly 90 mins after sunset (120 mins in Ramadhan)
      ishaAngle = 0; // Handled specially
      maghribAngle = 0; // Immediately at sunset
      break;
    case 'MWL':
      fajrAngle = 18;
      ishaAngle = 17;
      maghribAngle = 0;
      break;
    case 'Egypt':
      fajrAngle = 19.5;
      ishaAngle = 17.5;
      maghribAngle = 0;
      break;
    case 'Karachi':
      fajrAngle = 18;
      ishaAngle = 18;
      maghribAngle = 0;
      break;
  }

  // Hour Angle function
  const hourAngle = (angle: number, direction: 'morning' | 'evening'): number => {
    const angleRad = degToRad(angle);
    const cosH = (Math.sin(angleRad) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));
    
    if (cosH < -1 || cosH > 1) {
      // Return default values in extreme latitudes
      return direction === 'morning' ? 6 : 18;
    }
    
    const hDeg = radToDeg(Math.acos(cosH));
    return hDeg / 15;
  };

  // 1. Dhuhr (Solar Transit)
  const dhuhrTime = localTransit;

  // 2. Sunrise & Sunset
  // Standard altitude for sunrise/sunset is -0.833 degrees
  const sunsetHA = hourAngle(-0.833, 'evening');
  const sunriseTime = dhuhrTime - sunsetHA;
  const sunsetTime = dhuhrTime + sunsetHA;

  // 3. Fajr
  const fajrHA = hourAngle(-fajrAngle, 'morning');
  const fajrTime = dhuhrTime - fajrHA;

  // 4. Asr (Standard shadow ratio = 1)
  const step = Math.abs(latitude - declination);
  const gAsr = 90 - radToDeg(Math.atan(1 + Math.tan(degToRad(step))));
  const asrHA = hourAngle(gAsr, 'evening');
  const asrTime = dhuhrTime + asrHA;

  // 5. Maghrib
  let maghribTime = sunsetTime;
  if (method === 'Shia') {
    const maghribHA = hourAngle(-maghribAngle, 'evening');
    maghribTime = dhuhrTime + maghribHA;
  } else {
    // Other methods place Maghrib at sunset + tiny buffer
    maghribTime = sunsetTime + 2 / 60; // 2 minutes buffer
  }

  // 6. Isha
  let ishaTime = sunsetTime + 1.5; // Default 90 minutes
  if (method === 'UmmAlQura') {
    // check if ramadhan (Hijri calendar would be ideal, but fallback to month 9 approximate or standard UmmAlQura 90 mins)
    const isRamadhan = date.getMonth() === 8; // September or local Hijri detection
    ishaTime = sunsetTime + (isRamadhan ? 120 : 90) / 60;
  } else if (method === 'Shia') {
    const ishaHA = hourAngle(-ishaAngle, 'evening');
    ishaTime = dhuhrTime + ishaHA;
  } else {
    const ishaHA = hourAngle(-ishaAngle, 'evening');
    ishaTime = dhuhrTime + ishaHA;
  }

  // 7. Midnight (منتصف الليل)
  // Shia Midnight is exactly half way between Sunset (or Maghrib) and Fajr of next day
  // Standard Midnight is halfway between Sunset and Sunrise
  let midnightTime = 0;
  if (method === 'Shia') {
    midnightTime = maghribTime + (fajrTime + 24 - maghribTime) / 2;
  } else {
    midnightTime = sunsetTime + (sunriseTime + 24 - sunsetTime) / 2;
  }
  if (midnightTime >= 24) {
    midnightTime -= 24;
  }

  const formatTime = (timeInHours: number): string => {
    let hours = Math.floor(timeInHours);
    let minutes = Math.round((timeInHours - hours) * 60);
    
    if (minutes === 60) {
      hours += 1;
      minutes = 0;
    }
    
    hours = hours % 24;
    if (hours < 0) hours += 24;

    const hStr = hours.toString().padStart(2, '0');
    const mStr = minutes.toString().padStart(2, '0');
    return `${hStr}:${mStr}`;
  };

  return {
    fajr: formatTime(fajrTime),
    sunrise: formatTime(sunriseTime),
    dhuhr: formatTime(dhuhrTime),
    asr: formatTime(asrTime),
    sunset: formatTime(sunsetTime),
    maghrib: formatTime(maghribTime),
    isha: formatTime(ishaTime),
    midnight: formatTime(midnightTime)
  };
}

/**
 * Gets the current active or upcoming prayer, along with countdown text
 */
export interface NextPrayerInfo {
  currentPrayerName: string;
  currentPrayerArabic: string;
  nextPrayerName: string;
  nextPrayerArabic: string;
  nextPrayerTime: string;
  countdown: string; // "02:15:30"
  secondsRemaining: number;
}

export function getNextPrayer(times: PrayerTimes): NextPrayerInfo {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentSeconds = currentMinutes * 60 + now.getSeconds();

  const parseToSeconds = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60 + m) * 60;
  };

  const prayers = [
    { name: 'fajr', arabic: 'الفجر', seconds: parseToSeconds(times.fajr) },
    { name: 'sunrise', arabic: 'الشروق', seconds: parseToSeconds(times.sunrise) },
    { name: 'dhuhr', arabic: 'الظهر', seconds: parseToSeconds(times.dhuhr) },
    { name: 'asr', arabic: 'العصر', seconds: parseToSeconds(times.asr) },
    { name: 'sunset', arabic: 'الغروب', seconds: parseToSeconds(times.sunset) },
    { name: 'maghrib', arabic: 'المغرب', seconds: parseToSeconds(times.maghrib) },
    { name: 'isha', arabic: 'العشاء', seconds: parseToSeconds(times.isha) },
    { name: 'midnight', arabic: 'منتصف الليل', seconds: parseToSeconds(times.midnight) }
  ];

  // Sort prayers by time of day
  prayers.sort((a, b) => a.seconds - b.seconds);

  let currentIdx = prayers.length - 1;
  let nextIdx = 0;

  for (let i = 0; i < prayers.length; i++) {
    if (currentSeconds < prayers[i].seconds) {
      nextIdx = i;
      currentIdx = i === 0 ? prayers.length - 1 : i - 1;
      break;
    }
  }

  // Calculate countdown
  let diffSec = prayers[nextIdx].seconds - currentSeconds;
  if (diffSec < 0) {
    // Next prayer is tomorrow
    diffSec += 24 * 60 * 60;
  }

  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;

  const countdown = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  return {
    currentPrayerName: prayers[currentIdx].name,
    currentPrayerArabic: prayers[currentIdx].arabic,
    nextPrayerName: prayers[nextIdx].name,
    nextPrayerArabic: prayers[nextIdx].arabic,
    nextPrayerTime: times[prayers[nextIdx].name as keyof PrayerTimes],
    countdown,
    secondsRemaining: diffSec
  };
}
