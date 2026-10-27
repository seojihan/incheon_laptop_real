import {
  AppNotification,
  InternalHelpArticle,
  LaptopRequest,
  NotebookInventoryItem,
  RentalSlot,
  RequestType,
  RequestStatus,
  User,
} from '../types';
import { getRequestErrorMessage, normalizeClassNum, validateClassRentalSelection, validateHomeRental } from './validation';
import { getRequestSlotDate, hasCalendarWeekLabel } from './rentalSchedule';
import { isDemoSession } from './auth';
import type { Database, Json } from './database.types';
import { supabase } from './supabase';

type DatabaseLaptopRequestRow = Database['public']['Tables']['laptop_requests']['Row'];

interface LaptopRequestRow {
  id: string;
  user_id: string;
  user_name: string;
  student_id: string;
  grade?: string;
  class_num: string;
  type: 'home' | 'class';
  status: RequestStatus;
  start_date: string;
  end_date?: string | null;
  slots?: RentalSlot[] | null;
  reason?: string | null;
  week_label?: string | null;
  rental_year?: number | null;
  rental_month?: number | null;
  rental_week?: number | null;
  notebook_number?: number | null;
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
  archived_at?: string | null;
}

interface NotificationRow {
  id: string;
  user_id: string;
  request_id?: string | null;
  title: string;
  message: string;
  read_at?: string | null;
  created_at: string;
}

const DEMO_REQUESTS_STORAGE_KEY = 'icjs-demo-laptop-requests';
const DEMO_NOTIFICATIONS_STORAGE_KEY = 'icjs-demo-notifications';
const DEMO_NOTEBOOKS_STORAGE_KEY = 'icjs-demo-notebook-inventory';
const TOTAL_NOTEBOOKS = 33;
const signalNotificationsChanged = () => window.dispatchEvent(new Event('icjs:notifications-changed'));
const missingGradeColumn = (error: { code?: string; message?: string } | null) => Boolean(error && (
  error.code === '42703' || error.code === 'PGRST204'
) && (error.message || '').toLowerCase().includes('grade'));

const insertRequestWithSchemaFallback = async (record: Record<string, unknown>) => {
  const { data, error } = await (supabase as any).from('laptop_requests').insert(record).select().single();
  if (!missingGradeColumn(error)) return { data, error };
  const { grade: _grade, ...legacyRecord } = record;
  return await (supabase as any).from('laptop_requests').insert(legacyRecord).select().single();
};

const readStorage = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error('브라우저 저장 공간이 부족하거나 차단되어 요청을 저장하지 못했습니다.');
  }
};

const readDemoRequests = () => readStorage<LaptopRequestRow[]>(DEMO_REQUESTS_STORAGE_KEY, []);
const writeDemoRequests = (requests: LaptopRequestRow[]) => writeStorage(DEMO_REQUESTS_STORAGE_KEY, requests);
const readDemoNotifications = () => readStorage<NotificationRow[]>(DEMO_NOTIFICATIONS_STORAGE_KEY, []);
const writeDemoNotifications = (notifications: NotificationRow[]) => writeStorage(DEMO_NOTIFICATIONS_STORAGE_KEY, notifications);

const mapRowToRequest = (row: LaptopRequestRow): LaptopRequest => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  studentId: row.student_id,
  classNum: normalizeClassNum(row.class_num),
  grade: row.grade || row.student_id.slice(0, 1),
  type: row.type,
  status: row.status,
  startDate: row.start_date,
  endDate: row.end_date || undefined,
  slots: row.slots || undefined,
  reason: row.reason || undefined,
  weekLabel: row.week_label || undefined,
  rentalYear: row.rental_year || undefined,
  rentalMonth: row.rental_month || undefined,
  rentalWeek: row.rental_week || undefined,
  notebookNumber: row.notebook_number || undefined,
  reviewNote: row.review_note || undefined,
  reviewedAt: row.reviewed_at || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseSlots = (value: Json | null): RentalSlot[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const slots = value.filter((slot): slot is { dayIdx: number; periodIdx: number } =>
    Boolean(
      slot &&
      typeof slot === 'object' &&
      !Array.isArray(slot) &&
      Number.isInteger(slot.dayIdx) &&
      Number.isInteger(slot.periodIdx),
    ),
  );
  return slots.length === value.length ? slots : undefined;
};

const fromDatabaseRow = (row: DatabaseLaptopRequestRow): LaptopRequestRow => {
  if (row.type !== 'home' && row.type !== 'class') {
    throw new Error('서버에서 알 수 없는 대여 유형을 반환했습니다.');
  }
  if (!['pending', 'approved', 'rejected', 'returned', 'cancelled'].includes(row.status)) {
    throw new Error('서버에서 알 수 없는 신청 상태를 반환했습니다.');
  }
  return {
    ...row,
    type: row.type,
    status: row.status as RequestStatus,
    slots: parseSlots(row.slots),
  };
};

const mapNotification = (row: NotificationRow): AppNotification => ({
  id: row.id,
  userId: row.user_id,
  requestId: row.request_id || undefined,
  title: row.title,
  message: row.message,
  readAt: row.read_at || undefined,
  createdAt: row.created_at,
});

const deriveClassNum = (studentId: string) => normalizeClassNum(studentId.slice(1, 3));

const ensureStudentId = (studentId?: string) => {
  if (!studentId || !/^[1-3]\d{4}$/.test(studentId)) {
    throw new Error('학생 정보가 올바르지 않습니다. 개인 설정에서 학년, 반, 번호를 확인해주세요.');
  }
};

const addDemoNotification = (request: LaptopRequestRow, title: string, message: string) => {
  const notifications = readDemoNotifications();
  notifications.unshift({
    id: crypto.randomUUID(),
    user_id: request.user_id,
    request_id: request.id,
    title,
    message,
    read_at: null,
    created_at: new Date().toISOString(),
  });
  writeDemoNotifications(notifications);
};

const throwFriendly = (error: unknown, fallback: string): never => {
  throw new Error(getRequestErrorMessage(error, fallback));
};

export const createHomeRequest = async (params: {
  userId: string;
  userName: string;
  studentId?: string;
  startDate: string;
  endDate: string;
  reason: string;
}) => {
  ensureStudentId(params.studentId);
  const validationError = validateHomeRental(params.startDate, params.endDate, params.reason);
  if (validationError) throw new Error(validationError);

  if (isDemoSession()) {
    const requests = readDemoRequests();
    if (requests.some((item) => item.user_id === params.userId && item.type === 'home' && ['pending', 'approved'].includes(item.status))) {
      throw new Error('처리 중인 가정 대여 신청이 이미 있습니다.');
    }
    const now = new Date().toISOString();
    const row: LaptopRequestRow = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      user_name: params.userName.trim(),
      student_id: params.studentId!,
      grade: params.studentId!.slice(0, 1),
      class_num: deriveClassNum(params.studentId!),
      type: 'home',
      status: 'pending',
      start_date: params.startDate,
      end_date: params.endDate,
      reason: params.reason.trim() || '가정용 노트북 대여 신청',
      created_at: now,
      updated_at: now,
    };
    writeDemoRequests([row, ...requests]);
    addDemoNotification(row, '대여 신청이 접수되었습니다', `${row.start_date}부터 ${row.end_date}까지의 가정 대여 신청을 접수했습니다.`);
    signalNotificationsChanged();
    return mapRowToRequest(row);
  }

  const { data, error } = await insertRequestWithSchemaFallback({
      user_id: params.userId,
      user_name: params.userName.trim(),
      student_id: params.studentId,
      grade: params.studentId!.slice(0, 1),
      class_num: deriveClassNum(params.studentId!),
      type: 'home',
      start_date: params.startDate,
      end_date: params.endDate,
      reason: params.reason.trim() || '가정용 노트북 대여 신청',
    });

  if (error) throwFriendly(error, '가정 대여 신청을 저장하지 못했습니다.');
  signalNotificationsChanged();
  return mapRowToRequest(fromDatabaseRow(data));
};

const hasOverlappingClassRequest = (
  requests: LaptopRequest[],
  params: { year: number; month: number; week: number; weekStartDate: string; slots: RentalSlot[] },
) => {
  const requestedDates = new Set(params.slots.map((slot) => getRequestSlotDate(params.weekStartDate, slot.dayIdx, true)));
  return requests.some((request) => {
    if (request.type !== 'class' || !['pending', 'approved'].includes(request.status)) return false;
    if (request.rentalYear === params.year && request.rentalMonth === params.month && request.rentalWeek === params.week) return true;
    return (request.slots ?? []).some((slot) => {
      const existingDate = getRequestSlotDate(request.startDate, slot.dayIdx, hasCalendarWeekLabel(request.weekLabel));
      return requestedDates.has(existingDate);
    });
  });
};

export const createClassRequest = async (params: {
  userId: string;
  userName: string;
  studentId?: string;
  year: number;
  month: number;
  week: number;
  weekStartDate: string;
  weekLabel: string;
  slots: RentalSlot[];
  reason: string;
}) => {
  ensureStudentId(params.studentId);
  if (params.year < new Date().getFullYear() || params.year > new Date().getFullYear() + 1) {
    throw new Error('신청 연도가 올바르지 않습니다.');
  }
  if (params.month < 1 || params.month > 12 || params.week < 1 || params.week > 5) {
    throw new Error('신청 월 또는 주차가 올바르지 않습니다.');
  }
  const slotError = validateClassRentalSelection({
    year: params.year,
    month: params.month,
    week: params.week,
    weekStartDate: params.weekStartDate,
    slots: params.slots,
  });
  if (slotError) throw new Error(slotError);

  if (isDemoSession()) {
    const requests = readDemoRequests();
    const userRequests = requests.filter((item) => item.user_id === params.userId).map(mapRowToRequest);
    if (hasOverlappingClassRequest(userRequests, params)) throw new Error('선택한 날짜에 처리 중인 교과 대여 신청이 이미 있습니다. 기존 신청 내역을 확인해주세요.');

    const now = new Date().toISOString();
    const row: LaptopRequestRow = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      user_name: params.userName.trim(),
      student_id: params.studentId!,
      grade: params.studentId!.slice(0, 1),
      class_num: deriveClassNum(params.studentId!),
      type: 'class',
      status: 'pending',
      start_date: params.weekStartDate,
      slots: params.slots.map(({ dayIdx, periodIdx }) => ({ dayIdx, periodIdx })),
      reason: params.reason.trim() || '교과 대여 신청',
      week_label: params.weekLabel,
      rental_year: params.year,
      rental_month: params.month,
      rental_week: params.week,
      created_at: now,
      updated_at: now,
    };
    writeDemoRequests([row, ...requests]);
    addDemoNotification(row, '대여 신청이 접수되었습니다', `${row.week_label} 신청을 접수했습니다.`);
    signalNotificationsChanged();
    return mapRowToRequest(row);
  }

  const userRequests = await getUserRequests(params.userId);
  if (hasOverlappingClassRequest(userRequests, params)) throw new Error('선택한 날짜에 처리 중인 교과 대여 신청이 이미 있습니다. 기존 신청 내역을 확인해주세요.');

  const { data, error } = await insertRequestWithSchemaFallback({
      user_id: params.userId,
      user_name: params.userName.trim(),
      student_id: params.studentId,
      grade: params.studentId!.slice(0, 1),
      class_num: deriveClassNum(params.studentId!),
      type: 'class',
      start_date: params.weekStartDate,
      slots: params.slots.map(({ dayIdx, periodIdx }) => ({ dayIdx, periodIdx })),
      reason: params.reason.trim() || '교과 대여 신청',
      week_label: params.weekLabel,
      rental_year: params.year,
      rental_month: params.month,
      rental_week: params.week,
    });

  if (error) throwFriendly(error, '교과 대여 신청을 저장하지 못했습니다.');
  signalNotificationsChanged();
  return mapRowToRequest(fromDatabaseRow(data));
};

export const getUserRequests = async (userId: string) => {
  if (isDemoSession()) {
    return readDemoRequests().filter((item) => item.user_id === userId).map(mapRowToRequest);
  }
  const { data, error } = await supabase
    .from('laptop_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throwFriendly(error, '신청 내역을 불러오지 못했습니다.');
  return data.map(fromDatabaseRow).map(mapRowToRequest);
};

export const getRecords = async (user: User) => {
  if (isDemoSession()) {
    const all = readDemoRequests();
    if (user.role === 'admin') return all.map(mapRowToRequest);
    if (user.role === 'teacher' || user.role === 'helper') {
      const grade = user.grade;
      const classNum = normalizeClassNum(user.classNum);
      return all.filter((item) => item.grade === grade && normalizeClassNum(item.class_num) === classNum).map(mapRowToRequest);
    }
    return all.filter((item) => item.user_id === user.id).map(mapRowToRequest);
  }

  let query = supabase.from('laptop_requests').select('*').order('created_at', { ascending: false }).limit(300);
  if (user.role === 'student') query = query.eq('user_id', user.id);
  else if (user.role !== 'admin' && user.classNum && user.grade) query = query.eq('grade', user.grade).eq('class_num', normalizeClassNum(user.classNum));
  else if (user.role !== 'admin') query = query.eq('id', '00000000-0000-0000-0000-000000000000');

  let { data, error } = await query;
  if (user.role !== 'admin' && missingGradeColumn(error) && user.classNum) {
    const legacyQuery = supabase.from('laptop_requests').select('*').eq('class_num', normalizeClassNum(user.classNum)).order('created_at', { ascending: false }).limit(300);
    ({ data, error } = await legacyQuery);
  }
  if (error) throwFriendly(error, '대여 기록을 불러오지 못했습니다.');
  return data.map(fromDatabaseRow).map(mapRowToRequest);
};

export const getPendingRequests = async (user: User) => {
  if (!['admin', 'teacher', 'helper'].includes(user.role)) return [];
  const all = await getRecords(user);
  return all.filter((item) => item.status === 'pending');
};

export const reviewLaptopRequest = async (requestId: string, decision: 'approved' | 'rejected', reviewNote = '') => {
  if (isDemoSession()) {
    const requests = readDemoRequests();
    const index = requests.findIndex((item) => item.id === requestId && item.status === 'pending');
    if (index < 0) throw new Error('이미 처리되었거나 존재하지 않는 신청입니다.');

    if (decision === 'approved') {
      const occupied = new Set(requests.filter((item) => item.status === 'approved' && item.notebook_number).map((item) => item.notebook_number));
      const available = Array.from({ length: TOTAL_NOTEBOOKS }, (_, i) => i + 1).find((number) => !occupied.has(number));
      if (!available) throw new Error('현재 대여 가능한 노트북이 없습니다. 반납 처리 후 다시 시도해주세요.');
      requests[index].notebook_number = available;
    }

    requests[index] = {
      ...requests[index],
      status: decision,
      review_note: reviewNote.trim() || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    writeDemoRequests(requests);
    addDemoNotification(
      requests[index],
      decision === 'approved' ? '대여 신청이 승인되었습니다' : '대여 신청이 반려되었습니다',
      decision === 'approved'
        ? `${requests[index].notebook_number}번 노트북이 배정되었습니다.`
        : (reviewNote.trim() || '신청 내용을 확인한 뒤 다시 신청해주세요.'),
    );
    signalNotificationsChanged();
    return mapRowToRequest(requests[index]);
  }

  const { data, error } = await supabase.rpc('review_laptop_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_review_note: reviewNote.trim() || null,
  });
  if (error) throwFriendly(error, '신청 상태를 변경하지 못했습니다.');
  signalNotificationsChanged();
  return mapRowToRequest(fromDatabaseRow(data));
};

export const cancelLaptopRequest = async (requestId: string) => {
  if (isDemoSession()) {
    const requests = readDemoRequests();
    const index = requests.findIndex((item) => item.id === requestId && item.status === 'pending');
    if (index < 0) throw new Error('대기 중인 본인 신청만 취소할 수 있습니다.');
    requests[index] = { ...requests[index], status: 'cancelled', updated_at: new Date().toISOString() };
    writeDemoRequests(requests);
    addDemoNotification(requests[index], '대여 신청을 취소했습니다', '대기 중이던 대여 신청이 취소되었습니다.');
    signalNotificationsChanged();
    return mapRowToRequest(requests[index]);
  }

  const { data, error } = await supabase.rpc('cancel_laptop_request', { p_request_id: requestId });
  if (error) throwFriendly(error, '신청을 취소하지 못했습니다.');
  signalNotificationsChanged();
  return mapRowToRequest(fromDatabaseRow(data));
};

export const returnLaptopRequest = async (requestId: string) => {
  if (isDemoSession()) {
    const requests = readDemoRequests();
    const index = requests.findIndex((item) => item.id === requestId && item.status === 'approved');
    if (index < 0) throw new Error('승인되어 대여 중인 신청만 반납 처리할 수 있습니다.');
    requests[index] = { ...requests[index], status: 'returned', updated_at: new Date().toISOString() };
    writeDemoRequests(requests);
    addDemoNotification(requests[index], '노트북 반납이 완료되었습니다', `${requests[index].notebook_number}번 노트북 반납이 기록되었습니다.`);
    signalNotificationsChanged();
    return mapRowToRequest(requests[index]);
  }

  const { data, error } = await supabase.rpc('return_laptop_request', { p_request_id: requestId });
  if (error) throwFriendly(error, '반납 상태를 저장하지 못했습니다.');
  signalNotificationsChanged();
  return mapRowToRequest(fromDatabaseRow(data));
};

export const getNotebookInventory = async (): Promise<NotebookInventoryItem[]> => {
  if (isDemoSession()) {
    const requests = readDemoRequests();
    const active = requests.filter((item) => item.status === 'approved' && item.notebook_number);
    const overrides = readStorage<Record<string, { condition: NotebookInventoryItem['condition']; note?: string }>>(DEMO_NOTEBOOKS_STORAGE_KEY, {});
    return Array.from({ length: TOTAL_NOTEBOOKS }, (_, index) => {
      const number = index + 1;
      const request = active.find((item) => item.notebook_number === number);
      const homeRentalCount = requests.filter((item) =>
        item.notebook_number === number && item.type === 'home' && ['approved', 'returned'].includes(item.status),
      ).length;
      const override = overrides[String(number)];
      return {
        number,
        assetTag: `ICJS-NB-${String(number).padStart(2, '0')}`,
        condition: override?.condition || 'available',
        homeRentalCount,
        activeRentalType: request?.type,
        activeRentalStartDate: request?.start_date,
        activeRentalEndDate: request?.end_date || undefined,
        note: override?.note || undefined,
        activeRequest: request ? mapRowToRequest(request) : undefined,
      };
    });
  }

  const [
    { data: notebooks, error: notebookError },
    { data: requests, error: requestError },
    { data: summary, error: summaryError },
  ] = await Promise.all([
    supabase.from('notebooks').select('*').order('number', { ascending: true }),
    supabase.from('laptop_requests').select('*').eq('status', 'approved').not('notebook_number', 'is', null),
    supabase.rpc('get_notebook_inventory_summary'),
  ]);
  if (notebookError) throwFriendly(notebookError, '노트북 목록을 불러오지 못했습니다.');
  if (requestError) throwFriendly(requestError, '현재 대여 상태를 불러오지 못했습니다.');
  if (summaryError) throwFriendly(summaryError, '장비별 대여 이력을 불러오지 못했습니다.');

  const requestByNotebook = new Map<number, LaptopRequest>(
    requests.map(fromDatabaseRow).map((row) => [Number(row.notebook_number), mapRowToRequest(row)]),
  );
  const summaryByNotebook = new Map(summary.map((item) => [item.notebook_number, item]));
  return (notebooks as Array<{ number: number; asset_tag: string; condition: NotebookInventoryItem['condition']; note?: string | null }>).map((item) => ({
    number: item.number,
    assetTag: item.asset_tag,
    condition: item.condition,
    homeRentalCount: Number(summaryByNotebook.get(item.number)?.home_rental_count || 0),
    activeRentalType: (summaryByNotebook.get(item.number)?.active_request_type || undefined) as RequestType | undefined,
    activeRentalStartDate: summaryByNotebook.get(item.number)?.active_start_date || undefined,
    activeRentalEndDate: summaryByNotebook.get(item.number)?.active_end_date || undefined,
    note: item.note || undefined,
    activeRequest: requestByNotebook.get(item.number),
  }));
};

export const updateNotebookCondition = async (
  number: number,
  condition: NotebookInventoryItem['condition'],
  note: string,
) => {
  const cleanNote = note.trim();
  if (!Number.isInteger(number) || number < 1 || number > TOTAL_NOTEBOOKS) {
    throw new Error('노트북 번호를 확인해주세요.');
  }
  if (!['available', 'maintenance', 'retired'].includes(condition)) {
    throw new Error('선택한 장비 상태가 올바르지 않습니다.');
  }
  if (cleanNote.length > 500) throw new Error('메모는 500자 이내로 입력해주세요.');

  if (isDemoSession()) {
    const activeRental = readDemoRequests().some((item) => item.status === 'approved' && item.notebook_number === number);
    const overrides = readStorage<Record<string, { condition: NotebookInventoryItem['condition']; note?: string }>>(DEMO_NOTEBOOKS_STORAGE_KEY, {});
    const currentCondition = overrides[String(number)]?.condition || 'available';
    if (activeRental && condition !== currentCondition) {
      throw new Error('대여 중인 장비의 상태는 반납 처리한 뒤 변경할 수 있습니다. 메모는 지금 수정할 수 있습니다.');
    }
    overrides[String(number)] = { condition, note: cleanNote || undefined };
    writeStorage(DEMO_NOTEBOOKS_STORAGE_KEY, overrides);
    return;
  }

  const { error } = await supabase
    .from('notebooks')
    .update({ condition, note: cleanNote || null })
    .eq('number', number)
    .select('number')
    .single();
  if (error) throwFriendly(error, '장비 상태를 저장하지 못했습니다. 담당자 권한과 연결 상태를 확인해주세요.');
};

export const getNotifications = async (userId: string) => {
  if (isDemoSession()) {
    return readDemoNotifications().filter((item) => item.user_id === userId).map(mapNotification);
  }
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throwFriendly(error, '알림을 불러오지 못했습니다.');
  return (data as NotificationRow[]).map(mapNotification);
};

export const markNotificationRead = async (notificationId: string) => {
  const readAt = new Date().toISOString();
  if (isDemoSession()) {
    const notifications = readDemoNotifications();
    const index = notifications.findIndex((item) => item.id === notificationId);
    if (index >= 0) notifications[index].read_at = readAt;
    writeDemoNotifications(notifications);
    return;
  }
  const { error } = await supabase.from('notifications').update({ read_at: readAt }).eq('id', notificationId);
  if (error) throwFriendly(error, '알림 상태를 저장하지 못했습니다.');
};

export const markAllNotificationsRead = async (userId: string) => {
  const readAt = new Date().toISOString();
  if (isDemoSession()) {
    writeDemoNotifications(readDemoNotifications().map((item) => item.user_id === userId ? { ...item, read_at: item.read_at || readAt } : item));
    return;
  }
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: readAt })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throwFriendly(error, '알림 상태를 저장하지 못했습니다.');
};

export const getInternalHelpArticles = async (): Promise<InternalHelpArticle[]> => {
  if (isDemoSession()) return [];

  const { data, error } = await supabase
    .from('internal_help_articles')
    .select('id, slug, title, summary, body, allowed_roles, sort_order, updated_at')
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });

  if (error) throwFriendly(error, '권한별 내부 안내를 불러오지 못했습니다.');
  return data.map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    body: article.body,
    allowedRoles: article.allowed_roles.filter((role): role is User['role'] =>
      role === 'student' || role === 'teacher' || role === 'helper' || role === 'admin'
    ),
    sortOrder: article.sort_order,
    updatedAt: article.updated_at,
  }));
};
