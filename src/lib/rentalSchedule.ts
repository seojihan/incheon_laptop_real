import type { RentalSlot } from '../types';

export const WEEKDAYS = [
  { short: '월', full: '월요일' },
  { short: '화', full: '화요일' },
  { short: '수', full: '수요일' },
  { short: '목', full: '목요일' },
  { short: '금', full: '금요일' },
] as const;

export const PERIODS = [
  { label: '등교 전', time: '08:00 - 08:40' },
  { label: '1교시', time: '08:40 - 09:30' },
  { label: '2교시', time: '09:40 - 10:30' },
  { label: '3교시', time: '10:40 - 11:30' },
  { label: '4교시', time: '11:40 - 12:30' },
  { label: '점심시간', time: '12:30 - 13:30' },
  { label: '5교시', time: '13:30 - 14:20' },
  { label: '6교시', time: '14:30 - 15:20' },
  { label: '7교시', time: '15:30 - 16:20' },
] as const;

export interface ClassRentalWeek {
  /** Ordinal calendar week that contains at least one weekday in this month. */
  week: number;
  /** Monday of this calendar week; can fall in the previous month. */
  mondayDate: string;
  /** Weekday dates that fall inside the selected month. */
  datesByDay: Array<string | null>;
  firstSchoolDate: string;
  lastSchoolDate: string;
  dateLabel: string;
  available: boolean;
}

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const formatShortSchoolDate = (isoDate: string) => {
  const date = parseIsoDate(isoDate);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}(${weekday})`;
};

export const getClassRentalWeeks = (
  year: number,
  month: number,
  todayIso: string,
): ClassRentalWeek[] => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const firstWeekMonday = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  const weeks: ClassRentalWeek[] = [];

  for (let monday = firstWeekMonday; monday <= monthEnd; monday = addDays(monday, 7)) {
    const datesByDay = WEEKDAYS.map((_, dayIdx) => {
      const date = addDays(monday, dayIdx);
      return date.getFullYear() === year && date.getMonth() === month - 1
        ? toLocalIsoDate(date)
        : null;
    });
    const inMonthDates = datesByDay.filter((date): date is string => Boolean(date));
    if (inMonthDates.length === 0) continue;

    const firstSchoolDate = inMonthDates[0];
    const lastSchoolDate = inMonthDates[inMonthDates.length - 1];
    const mondayDate = toLocalIsoDate(monday);
    weeks.push({
      week: weeks.length + 1,
      mondayDate,
      datesByDay,
      firstSchoolDate,
      lastSchoolDate,
      dateLabel: firstSchoolDate === lastSchoolDate
        ? formatShortSchoolDate(firstSchoolDate)
        : `${formatShortSchoolDate(firstSchoolDate)}–${formatShortSchoolDate(lastSchoolDate)}`,
      available: inMonthDates.some((date) => date >= todayIso),
    });
  }

  return weeks;
};

export const getDefaultClassRentalWeek = (weeks: ClassRentalWeek[]) =>
  weeks.find((week) => week.available)?.week ?? weeks[0]?.week ?? 1;

export const getFirstAvailableDay = (week: ClassRentalWeek | undefined, todayIso: string) => {
  if (!week) return 0;
  const index = week.datesByDay.findIndex((date) => date !== null && date >= todayIso);
  if (index >= 0) return index;
  const firstExisting = week.datesByDay.findIndex(Boolean);
  return firstExisting >= 0 ? firstExisting : 0;
};

export const getClassSlotDate = (week: ClassRentalWeek, dayIdx: number) =>
  week.datesByDay[dayIdx] ?? null;

/**
 * New class requests store the Monday of the calendar week. Older requests
 * stored the first day of an arbitrary seven-day block, so map their weekday
 * to the matching date inside that block when showing historical records.
 */
export const getRequestSlotDate = (startDate: string, dayIdx: number, calendarWeek: boolean) => {
  const start = parseIsoDate(startDate);
  const offset = calendarWeek
    ? dayIdx
    : (dayIdx - ((start.getDay() + 6) % 7) + 7) % 7;
  return toLocalIsoDate(addDays(start, offset));
};

export const hasCalendarWeekLabel = (weekLabel?: string) => Boolean(weekLabel?.includes(' · '));

export const formatRequestSlot = (
  slot: RentalSlot,
  startDate: string,
  weekLabel?: string,
) => {
  const day = WEEKDAYS[slot.dayIdx]?.full ?? '요일';
  const period = PERIODS[slot.periodIdx];
  const periodText = period ? `${period.label} · ${period.time}` : '시간 정보 확인 필요';
  if (!hasCalendarWeekLabel(weekLabel)) return `${day} · ${periodText}`;
  const date = getRequestSlotDate(startDate, slot.dayIdx, true);
  return `${formatShortSchoolDate(date)} · ${periodText}`;
};

