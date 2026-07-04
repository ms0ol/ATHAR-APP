export interface HijriDate {
  year: number;
  month: number; // 1 to 12
  day: number; // 1 to 30
  monthName: string;
  monthNameEn: string;
  formatted: string;
}

export const HIJRI_MONTHS_AR = [
  'مُحرَّم',
  'صَفَر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة'
];

export const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Shaban',
  'Ramadhan',
  'Shawwal',
  'Dhu al-Qidah',
  'Dhu al-Hijjah'
];

export const WEEKDAYS_AR = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت'
];

/**
 * Converts a Gregorian Date to Hijri Date mathematically
 * Based on the Tabular Islamic Calendar (15-Civil) formula
 */
export function getHijriDate(date: Date, adjustmentDays: number = 0): HijriDate {
  // Let's copy date and apply the user's local adjustment
  const adjustedDate = new Date(date.getTime());
  if (adjustmentDays !== 0) {
    adjustedDate.setDate(adjustedDate.getDate() + adjustmentDays);
  }

  let wjd: number;
  const year = adjustedDate.getFullYear();
  const month = adjustedDate.getMonth() + 1;
  const day = adjustedDate.getDate();

  if (year > 1582 || (year === 1582 && month > 10) || (year === 1582 && month === 10 && day > 14)) {
    // Gregorian calendar
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    wjd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  } else {
    // Julian calendar
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    wjd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }

  // Calculate Hijri details
  const epoch = 1948439.5; // Jul 16, 622 CE
  const jdn = wjd - epoch + 0.5;

  const cyc = Math.floor(jdn / 10631);
  const rcyc = jdn % 10631;

  const iy = Math.floor((rcyc * 30 + 11) / 10631);
  const hYear = cyc * 30 + iy + 1;

  // Days elapsed in the year
  const daysInYear = Math.floor((iy * 10631 + 14) / 30);
  const rDays = rcyc - daysInYear;

  // Month and Day
  let hMonth = Math.floor((rDays * 30 + 29) / 885) + 1;
  let hDay = Math.floor(rDays - Math.floor((hMonth - 1) * 29.5) + 0.5);

  // Safeguards
  if (hDay <= 0) {
    hMonth -= 1;
    if (hMonth === 0) {
      hMonth = 12;
    }
    // approximate last month days
    hDay = hMonth % 2 === 0 ? 29 : 30;
  }
  
  if (hMonth > 12) {
    hMonth = 12;
  }

  const monthName = HIJRI_MONTHS_AR[hMonth - 1];
  const monthNameEn = HIJRI_MONTHS_EN[hMonth - 1];

  return {
    year: hYear,
    month: hMonth,
    day: hDay,
    monthName,
    monthNameEn,
    formatted: `${hDay} ${monthName} ${hYear} هـ`
  };
}

export interface CalendarDayInfo {
  gregorianDate: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hijriDay: number;
  hijriMonth: number;
  hijriYear: number;
  hijriMonthName: string;
  hijriFormatted: string;
}

/**
 * Generates calendar cells (6 weeks grid = 42 cells) for a Gregorian Month/Year
 */
export function generateCalendarGrid(year: number, month: number, adjustmentDays: number = 0): CalendarDayInfo[] {
  const grid: CalendarDayInfo[] = [];
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week of the 1st of the month (0 = Sunday, ..., 6 = Saturday)
  const startDayOfWeek = firstDayOfMonth.getDay();
  const today = new Date();

  // Prev month filler cells
  const prevMonthLast = new Date(year, month, 0);
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLast.getDate() - i);
    const h = getHijriDate(d, adjustmentDays);
    grid.push({
      gregorianDate: d,
      dayOfMonth: d.getDate(),
      isCurrentMonth: false,
      isToday: isSameDay(d, today),
      hijriDay: h.day,
      hijriMonth: h.month,
      hijriYear: h.year,
      hijriMonthName: h.monthName,
      hijriFormatted: h.formatted
    });
  }

  // Current month cells
  const totalDays = lastDayOfMonth.getDate();
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    const h = getHijriDate(d, adjustmentDays);
    grid.push({
      gregorianDate: d,
      dayOfMonth: i,
      isCurrentMonth: true,
      isToday: isSameDay(d, today),
      hijriDay: h.day,
      hijriMonth: h.month,
      hijriYear: h.year,
      hijriMonthName: h.monthName,
      hijriFormatted: h.formatted
    });
  }

  // Next month filler cells to complete 42 cells grid
  const remainingCells = 42 - grid.length;
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month + 1, i);
    const h = getHijriDate(d, adjustmentDays);
    grid.push({
      gregorianDate: d,
      dayOfMonth: i,
      isCurrentMonth: false,
      isToday: isSameDay(d, today),
      hijriDay: h.day,
      hijriMonth: h.month,
      hijriYear: h.year,
      hijriMonthName: h.monthName,
      hijriFormatted: h.formatted
    });
  }

  return grid;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
