import { getLang, t } from '@/i18n';
import type { LocalDate } from './types';

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date for a Date or ISO string. */
export function toLocalDate(d: Date | string | number = new Date()): LocalDate {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse `YYYY-MM-DD` as local midnight. */
export function parseLocalDate(s: LocalDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday-based week start. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const dow = (day.getDay() + 6) % 7; // Mon=0
  return addDays(day, -dow);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toLocalDate(a) === toLocalDate(b);
}

// Names indexed Monday-first. Arabic uses Western digits with Arabic names.
const NAMES = {
  en: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    daysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    daysLetter: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  },
  ar: {
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    monthsLong: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    days: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
    daysShort: ['اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت', 'أحد'],
    daysLetter: ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'],
  },
};
const names = () => NAMES[getLang()];

export const weekdayName = (i: number) => names().days[i];
export const weekdayShort = (i: number) => names().daysShort[i];
export const weekdayLetter = (i: number) => names().daysLetter[i];

const asDate = (d: Date | string) => (typeof d === 'string' ? (d.length === 10 ? parseLocalDate(d) : new Date(d)) : d);

/** "7 Nov" / "7 نوفمبر" */
export function formatShortDate(d: Date | string): string {
  const date = asDate(d);
  return `${date.getDate()} ${names().months[date.getMonth()]}`;
}

/** "Nov 2026" / "نوفمبر 2026" */
export function formatMonth(d: Date): string {
  return `${names().months[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Saturday 7 November" / "السبت، 7 نوفمبر" */
export function formatFullDate(d: Date): string {
  const n = names();
  const day = n.days[weekdayIndex(d)];
  return getLang() === 'ar' ? `${day}، ${d.getDate()} ${n.monthsLong[d.getMonth()]}` : `${day} ${d.getDate()} ${n.monthsLong[d.getMonth()]}`;
}

/** "Today" / "Yesterday" / "Sat, 7 Nov" (year added when not the current year). */
export function formatLongDate(d: Date | string): string {
  const date = asDate(d);
  const now = new Date();
  const diff = daysBetween(date, now);
  if (diff === 0) return t('common.today');
  if (diff === 1) return t('common.yesterday');
  const n = names();
  const sep = getLang() === 'ar' ? '، ' : ', ';
  const base = `${n.daysShort[weekdayIndex(date)]}${sep}${date.getDate()} ${n.months[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

export function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** 3725 → "1h 2m" / "1 س 2 د", 300 → "5m" */
export function formatDuration(totalSec: number): string {
  if (totalSec > 0 && totalSec < 60) return t('dur.lessMin');
  const m = Math.round(totalSec / 60);
  if (m < 60) return t('dur.m', { m });
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? t('dur.hm', { h, m: rem }) : t('dur.h', { h });
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return t('greet.evening');
  if (h < 12) return t('greet.morning');
  if (h < 18) return t('greet.afternoon');
  return t('greet.evening');
}
