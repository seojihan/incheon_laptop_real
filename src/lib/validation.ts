import { RentalSlot } from '../types';
import { getClassRentalWeeks } from './rentalSchedule';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const normalizeDigits = (value: string) => value.replace(/\D/g, '');

export const normalizeClassNum = (value?: string | null) => {
  const digits = normalizeDigits(value ?? '');
  return digits ? digits.padStart(2, '0') : '';
};

export const validateProfileFields = (params: {
  name: string;
  role: 'student' | 'teacher' | 'admin' | 'helper';
  grade?: string;
  classNum?: string;
  studentNum?: string;
}) => {
  const name = params.name.trim();
  const grade = normalizeDigits(params.grade ?? '');
  const classNum = normalizeDigits(params.classNum ?? '');
  const studentNum = normalizeDigits(params.studentNum ?? '');

  if (name.length < 2 || name.length > 40) {
    return '이름은 2자 이상 40자 이하로 입력해주세요.';
  }

  if (params.role === 'student' || params.role === 'helper') {
    if (!/^[1-3]$/.test(grade)) return '학년은 1~3 사이의 숫자로 입력해주세요.';
    if (!/^(?:[1-9]|1\d|20)$/.test(classNum)) return '반은 1~20 사이의 숫자로 입력해주세요.';
    if (!/^(?:[1-9]|[1-4]\d|50)$/.test(studentNum)) return '번호는 1~50 사이의 숫자로 입력해주세요.';
  }

  if (params.role === 'teacher') {
    if (!/^[1-3]$/.test(grade)) return '담당 학년은 1~3 사이의 숫자로 입력해주세요.';
    if (!/^(?:[1-9]|1\d|20)$/.test(classNum)) return '담당 반은 1~20 사이의 숫자로 입력해주세요.';
  }

  return null;
};

export const composeStudentId = (grade: string, classNum: string, studentNum: string) => {
  const g = normalizeDigits(grade);
  const c = normalizeClassNum(classNum);
  const s = normalizeDigits(studentNum).padStart(2, '0');

  if (!/^[1-3]$/.test(g) || !/^\d{2}$/.test(c) || !/^\d{2}$/.test(s)) {
    throw new Error('학년, 반, 번호 형식이 올바르지 않습니다.');
  }

  return `${g}${c}${s}`;
};

const parseLocalDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export const todayLocalIso = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export const validateHomeRental = (startDate: string, endDate: string, reason: string) => {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const today = parseLocalDate(todayLocalIso())!;

  if (!start || !end) return '대여 시작일과 반납 예정일을 모두 선택해주세요.';
  if (start < today) return '대여 시작일은 오늘 이후로 선택해주세요.';
  if (end < start) return '반납 예정일은 대여 시작일보다 빠를 수 없습니다.';

  const rentalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (rentalDays > 30) return '가정 대여는 한 번에 최대 30일까지 신청할 수 있습니다.';
  if (reason.trim().length > 500) return '특이 사항은 500자 이하로 입력해주세요.';
  return null;
};

export const validateSlots = (slots: RentalSlot[]) => {
  if (slots.length === 0) return '신청할 교시를 한 개 이상 선택해주세요.';
  if (slots.length > 45) return '선택 가능한 교시 수를 초과했습니다.';

  const unique = new Set<string>();
  for (const slot of slots) {
    if (!Number.isInteger(slot.dayIdx) || slot.dayIdx < 0 || slot.dayIdx > 4) {
      return '선택한 요일 정보가 올바르지 않습니다.';
    }
    if (!Number.isInteger(slot.periodIdx) || slot.periodIdx < 0 || slot.periodIdx > 8) {
      return '선택한 교시 정보가 올바르지 않습니다.';
    }
    const key = `${slot.dayIdx}-${slot.periodIdx}`;
    if (unique.has(key)) return '같은 교시가 중복 선택되었습니다.';
    unique.add(key);
  }
  return null;
};

export const validateClassRentalSelection = (params: {
  year: number;
  month: number;
  week: number;
  weekStartDate: string;
  slots: RentalSlot[];
  todayIso?: string;
}) => {
  const todayIso = params.todayIso ?? todayLocalIso();
  const slotError = validateSlots(params.slots);
  if (slotError) return slotError;

  const selectedWeek = getClassRentalWeeks(params.year, params.month, todayIso)
    .find((week) => week.week === params.week);
  if (!selectedWeek || selectedWeek.mondayDate !== params.weekStartDate) {
    return '선택한 대여 주간을 확인할 수 없습니다. 날짜를 다시 선택해주세요.';
  }
  if (!selectedWeek.available) return '이미 지난 주간은 신청할 수 없습니다.';

  for (const slot of params.slots) {
    const date = selectedWeek.datesByDay[slot.dayIdx];
    if (!date) return '선택한 요일이 대여 주간에 포함되지 않습니다.';
    if (date < todayIso) return '이미 지난 날짜는 신청할 수 없습니다.';
  }

  return null;
};

export const getRequestErrorMessage = (error: unknown, fallback: string) => {
  const candidate = error as { code?: string; message?: string; details?: string } | null;
  const message = `${candidate?.message ?? ''} ${candidate?.details ?? ''}`.toLowerCase();

  if (candidate?.code === '23505' || message.includes('duplicate')) {
    return '같은 기간에 처리 중인 신청이 이미 있습니다. 기존 신청 내역을 확인해주세요.';
  }
  if (candidate?.code === '42501' || message.includes('row-level security')) {
    return '이 작업을 수행할 권한이 없습니다. 다시 로그인한 뒤 시도해주세요.';
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return '네트워크 연결을 확인한 뒤 다시 시도해주세요.';
  }
  return candidate?.message || fallback;
};
