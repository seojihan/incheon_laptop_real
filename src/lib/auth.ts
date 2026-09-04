import type { Session } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';
import type { Json } from './database.types';
import { composeStudentId } from './validation';
import { isDemoModeEnabled, isSupabaseConfigured, supabase } from './supabase';

const DEMO_AUTH_STORAGE_KEY = 'icjs-demo-auth-session';
const DEMO_PROFILE_STORAGE_KEY = 'icjs-demo-profile';
const AUTH_TIMEOUT_MS = 12_000;

export { composeStudentId };

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

  const query = supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  const { data, error } = await withTimeout(query, AUTH_TIMEOUT_MS, '프로필 로드 시간이 초과되었습니다.');
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
}) => {
  if (isDemoSession()) {
    const demoProfile = { ...profile, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    writeJsonStorage(DEMO_PROFILE_STORAGE_KEY, demoProfile);
    return demoProfile as UserProfile;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase 환경 설정이 필요합니다.');

  const { data, error } = await supabase
    .from('profiles')
    .insert([profile])
    .select()
    .single();

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

export const signInWithGoogle = async () => {
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
    },
  });

  if (error) throw error;
  return data;
};

export const signOut = async () => {
  if (isDemoSession()) {
    writeJsonStorage(DEMO_AUTH_STORAGE_KEY, null);
    writeJsonStorage(DEMO_PROFILE_STORAGE_KEY, null);
    return;
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  try {
    window.localStorage.removeItem('icjs-laptop-auth');
  } catch {
    // The server session is already signed out; storage cleanup is best-effort.
  }
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
