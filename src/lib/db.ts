import {
  AppNotification,
  InternalHelpArticle,
  LaptopRequest,
  NotebookInventoryItem,
  RentalSlot,
  RequestStatus,
  User,
} from '../types';
import { getRequestErrorMessage, normalizeClassNum, validateHomeRental, validateSlots } from './validation';
import { isDemoSession } from './auth';
import type { Database, Json } from './database.types';
import { supabase } from './supabase';

type DatabaseLaptopRequestRow = Database['public']['Tables']['laptop_requests']['Row'];

interface LaptopRequestRow {
  id: string;
  user_id: string;
  user_name: string;
  student_id: string;
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
const TOTAL_NOTEBOOKS = 33;
const signalNotificationsChanged = () => window.dispatchEvent(new Event('icjs:notifications-changed'));

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
  type: row.type,
  status: row.status,
  startDate: row.start_date,
  endDate: row.end_date || undefined,
  slots: row.slots || undefined,
  period: row.slots?.map((slot) => slot.periodIdx + 1),
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

const localDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
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

  const { data, error } = await supabase
    .from('laptop_requests')
    .insert({
      user_id: params.userId,
      user_name: params.userName.trim(),
      student_id: params.studentId,
      class_num: deriveClassNum(params.studentId!),
      type: 'home',
      start_date: params.startDate,
      end_date: params.endDate,
      reason: params.reason.trim() || '가정용 노트북 대여 신청',
    })
    .select()
    .single();

  if (error) throwFriendly(error, '가정 대여 신청을 저장하지 못했습니다.');
  signalNotificationsChanged();
  return mapRowToRequest(fromDatabaseRow(data));
};

export const createClassRequest = async (params: {
  userId: string;
  userName: string;
  studentId?: string;
  year: number;
  month: number;
  week: number;
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
  const slotError = validateSlots(params.slots);
  if (slotError) throw new Error(slotError);

  if (isDemoSession()) {
    const requests = readDemoRequests();
    const duplicate = requests.some((item) =>
      item.user_id === params.userId &&
      item.type === 'class' &&
      item.rental_year === params.year &&
      item.rental_month === params.month &&
      item.rental_week === params.week &&
      ['pending', 'approved'].includes(item.status),
    );
    if (duplicate) throw new Error('같은 주차에 처리 중인 교과 대여 신청이 이미 있습니다.');

    const now = new Date().toISOString();
    const row: LaptopRequestRow = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      user_name: params.userName.trim(),
      student_id: params.studentId!,
      class_num: deriveClassNum(params.studentId!),
      type: 'class',
      status: 'pending',
      start_date: localDate(params.year, params.month, 1 + (params.week - 1) * 7),
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

  const { data, error } = await supabase
    .from('laptop_requests')
    .insert({
      user_id: params.userId,
      user_name: params.userName.trim(),
      student_id: params.studentId,
      class_num: deriveClassNum(params.studentId!),
      type: 'class',
      start_date: localDate(params.year, params.month, 1 + (params.week - 1) * 7),
      slots: params.slots.map(({ dayIdx, periodIdx }) => ({ dayIdx, periodIdx })),
      reason: params.reason.trim() || '교과 대여 신청',
      week_label: params.weekLabel,
      rental_year: params.year,
      rental_month: params.month,
      rental_week: params.week,
    })
    .select()
    .single();

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
      const classNum = normalizeClassNum(user.classNum);
      return all.filter((item) => normalizeClassNum(item.class_num) === classNum).map(mapRowToRequest);
    }
    return all.filter((item) => item.user_id === user.id).map(mapRowToRequest);
  }

  let query = supabase.from('laptop_requests').select('*').order('created_at', { ascending: false }).limit(300);
  if (user.role === 'student') query = query.eq('user_id', user.id);
  else if (user.role !== 'admin' && user.classNum) query = query.eq('class_num', normalizeClassNum(user.classNum));

  const { data, error } = await query;
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
    const active = readDemoRequests().filter((item) => item.status === 'approved' && item.notebook_number);
    return Array.from({ length: TOTAL_NOTEBOOKS }, (_, index) => {
      const number = index + 1;
      const request = active.find((item) => item.notebook_number === number);
      return {
        number,
        assetTag: `ICJS-NB-${String(number).padStart(2, '0')}`,
        condition: 'available',
        activeRequest: request ? mapRowToRequest(request) : undefined,
      };
    });
  }

  const [{ data: notebooks, error: notebookError }, { data: requests, error: requestError }] = await Promise.all([
    supabase.from('notebooks').select('*').order('number', { ascending: true }),
    supabase.from('laptop_requests').select('*').eq('status', 'approved').not('notebook_number', 'is', null),
  ]);
  if (notebookError) throwFriendly(notebookError, '노트북 목록을 불러오지 못했습니다.');
  if (requestError) throwFriendly(requestError, '현재 대여 상태를 불러오지 못했습니다.');

  const requestByNotebook = new Map<number, LaptopRequest>(
    requests.map(fromDatabaseRow).map((row) => [Number(row.notebook_number), mapRowToRequest(row)]),
  );
  return (notebooks as Array<{ number: number; asset_tag: string; condition: NotebookInventoryItem['condition']; note?: string | null }>).map((item) => ({
    number: item.number,
    assetTag: item.asset_tag,
    condition: item.condition,
    note: item.note || undefined,
    activeRequest: requestByNotebook.get(item.number),
  }));
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
