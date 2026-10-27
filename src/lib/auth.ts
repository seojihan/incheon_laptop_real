import type { Session } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';
import type { Json } from './database.types';
import { composeStudentId } from './validation';
import { isDemoModeEnabled, isSupabaseConfigured, supabase } from './supabase';

const DEMO_AUTH_STORAGE_KEY = 'icjs-demo-auth-session';
const DEMO_PROFILE_STORAGE_KEY = 'icjs-demo-profile';
const LOGIN_INTENT_STORAGE_KEY = 'icjs-login-intent';
const AUTH_TIMEOUT_MS = 12_000;

export { composeStudentId };

export type LoginIntent = 'student' | 'teacher';

export const getLoginIntent = (): LoginIntent => {
  try {
    return window.localStorage.getItem(LOGIN_INTENT_STORAGE_KEY) === 'teacher' ? 'teacher' : 'student';
  } catch {
    return 'student';
  }
};

export const clearLoginIntent = () => {
  try { window.localStorage.removeItem(LOGIN_INTENT_STORAGE_KEY); } catch { /* optional preference */ }
};

const withTimeout = async <T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const schemaColumnMissing = (error: { code?: string; message?: string } | null, column: string) => {
  const message = (error?.message || '').toLowerCase();
  return Boolean(error && (error.code === '42703' || error.code === 'PGRST204' || (message.includes(column) && (message.includes('column') || message.includes('schema cache')))));
};

const isUserRole = (value: unknown): value is UserRole =>
  value === 'student' || value === 'teacher' || value === 'helper' || value === 'admin';

export const getUserRole = (session: Session | null | Record<string, any>, profile?: UserProfile | null): UserRole | null => {
  if (!session?.user) return null;
  if (profile?.role) return profile.role;

  const appRoles = Array.isArray(session.user.app_metadata?.roles) ? session.user.app_metadata.roles : [];
  const appRole = session.user.app_metadata?.role;
  const trustedRole = ['admin', 'teacher', 'helper'].find((role) => appRoles.includes(role)) ?? appRole;
  return isUserRole(trustedRole) ? trustedRole : 'student';
};

const readJsonStorage = <T>(key: string): T | null => {
  try {
    const cached = window.localStorage.getItem(key);
    return cached ? JSON.parse(cached) as T : null;
  } catch {
    return null;
  }
};

const writeJsonStorage = (key: string, value: unknown | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error('브라우저 저장 공간을 사용할 수 없습니다. 시크릿 모드를 해제하거나 저장 공간 권한을 확인해주세요.');
  }
};

export const isDemoSession = () => isDemoModeEnabled && Boolean(readJsonStorage(DEMO_AUTH_STORAGE_KEY));

export const getProfile = async (userId: string) => {
  if (isDemoSession()) {
    const profile = readJsonStorage<UserProfile>(DEMO_PROFILE_STORAGE_KEY);
    return profile?.user_id === userId ? profile : null;
  }

  if (!isSupabaseConfigured) return null;

  let query = supabase.from('profiles')
    .select('user_id, role, student_id, student_name, grade, class_num, created_at, updated_at, archived_at')
    .eq('user_id', userId).maybeSingle();
  let result = await withTimeout(query, AUTH_TIMEOUT_MS, '프로필 로드 시간이 초과되었습니다.');
  if (schemaColumnMissing(result.error, 'archived_at')) {
    query = supabase.from('profiles')
      .select('user_id, role, student_id, student_name, grade, class_num, created_at, updated_at')
      .eq('user_id', userId).maybeSingle();
    result = await withTimeout(query, AUTH_TIMEOUT_MS, '프로필 로드 시간이 초과되었습니다.');
  }
  const { data, error } = result;
  if (error) throw error;
  return data as UserProfile | null;
};

export const createOrUpdateProfile = async (profile: {
  user_id: string;
  role: UserRole;
  student_id?: string | null;
  student_name: string;
  grade?: string | null;
  class_num?: string | null;
  metadata?: Json;
  archived_at?: string | null;
}) => {
  if (isDemoSession()) {
    const demoProfile = { ...profile, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    writeJsonStorage(DEMO_PROFILE_STORAGE_KEY, demoProfile);
    return demoProfile as UserProfile;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase 환경 설정이 필요합니다.');

  const { user_id: userId, role, ...profileFields } = profile;
  delete profileFields.archived_at;
  const { data: existingProfile, error: lookupError } = await withTimeout(
    supabase.from('profiles').select('user_id, role').eq('user_id', userId).maybeSingle(),
    AUTH_TIMEOUT_MS,
    '프로필 확인 시간이 초과되었습니다.',
  );
  if (lookupError) throw lookupError;

  // Keep immutable identity and archive fields out of UPDATE payloads. A role
  // update is included only for an explicit role change such as teacher setup.
  const updateFields = existingProfile?.role === role ? profileFields : { ...profileFields, role };
  const insertProfile = { user_id: userId, role, ...profileFields };
  const result = existingProfile
    ? await withTimeout(
      supabase.from('profiles').update(updateFields).eq('user_id', userId)
        .select('user_id, role, student_id, student_name, grade, class_num, created_at, updated_at, archived_at').single(),
      AUTH_TIMEOUT_MS,
      '프로필 저장 시간이 초과되었습니다.',
    )
    : await withTimeout(
      supabase.from('profiles').insert([insertProfile])
        .select('user_id, role, student_id, student_name, grade, class_num, created_at, updated_at, archived_at').single(),
      AUTH_TIMEOUT_MS,
      '프로필 저장 시간이 초과되었습니다.',
    );

  if (result.error) throw result.error;
  return result.data as UserProfile;
};

export const reactivateArchivedStudent = async (params: { name: string; studentId: string; grade: string; classNum: string }) => {
  if (isDemoSession()) throw new Error('보관된 학생 계정 복구는 연결된 서비스에서만 가능합니다.');
  const { data, error } = await (supabase as any).rpc('reactivate_archived_student', {
    p_student_name: params.name.trim(),
    p_student_id: params.studentId,
    p_grade: params.grade,
    p_class_num: params.classNum,
  });
  if (error) throw error;
  return data as UserProfile;
};

const createDemoSession = () => {
  const session = {
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'demo@localhost',
      user_metadata: { full_name: '로컬 데모 사용자' },
      app_metadata: { provider: 'google', providers: ['google'] },
    },
  };
  writeJsonStorage(DEMO_AUTH_STORAGE_KEY, session);
  return session;
};

export const signInWithGoogle = async (intent: LoginIntent = 'student') => {
  try { window.localStorage.setItem(LOGIN_INTENT_STORAGE_KEY, intent); } catch { /* OAuth still works if storage is blocked */ }
  if (isDemoModeEnabled) {
    const session = createDemoSession();
    return { demoMode: true, session };
  }

  if (!isSupabaseConfigured) {
    throw new Error('Supabase 프로젝트 URL과 게시 가능 키를 먼저 설정해주세요.');
  }

  const redirectTo = new URL(import.meta.env.BASE_URL || '/', window.location.origin).href;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: 'openid email profile',
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw error;
  return data;
};

export const signOut = async () => {
  clearLoginIntent();
  if (isDemoSession()) {
    writeJsonStorage(DEMO_AUTH_STORAGE_KEY, null);
    writeJsonStorage(DEMO_PROFILE_STORAGE_KEY, null);
    return;
  }

  let signOutFailure: unknown;
  try {
    if (isSupabaseConfigured) {
      const { error } = await withTimeout(
        supabase.auth.signOut({ scope: 'local' }),
        AUTH_TIMEOUT_MS,
        '로그아웃 서버 응답 시간이 초과되었습니다.',
      );
      if (error) signOutFailure = error;
    }
  } catch (caught) {
    signOutFailure = caught;
  } finally {
    try {
      window.localStorage.removeItem('icjs-laptop-auth');
    } catch {
      // App state is still cleared; storage cleanup can fail in restricted browsers.
    }
  }

  if (signOutFailure) throw signOutFailure;
};

export const getSession = async () => {
  if (isDemoModeEnabled) {
    return readJsonStorage<Record<string, any>>(DEMO_AUTH_STORAGE_KEY);
  }
  if (!isSupabaseConfigured) return null;

  const request = supabase.auth.getSession();
  const { data: { session }, error } = await withTimeout(request, AUTH_TIMEOUT_MS, '세션 확인 시간이 초과되었습니다.');
  if (error) throw error;
  return session;
};
