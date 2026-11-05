import { isDemoSession } from './auth';
import { getDemoStudents, markDemoStudentsSignedOut } from './db';
import { supabase } from './supabase';

const throwIfRoleSchemaMissing = (error: { code?: string; message?: string } | null) => {
  if (!error) return;
  const message = (error.message || '').toLowerCase();
  if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42883' || error.code === '42P01'
    || ['list_teacher_class_members', 'set_class_notebook_helper', 'archive_teacher_class_data', 'force_student_sign_out', 'list_manageable_students'].some((name) => message.includes(name))) {
    throw new Error('교사·학급 관리용 Supabase 설정이 아직 적용되지 않았습니다. 기존 대여 기능은 계속 이용할 수 있습니다.');
  }
  throw error;
};

export interface ClassMember {
  user_id: string;
  role: 'student' | 'helper';
  student_id: string;
  student_name: string;
  grade: string;
  class_num: string;
}

export const setNotebookHelper = async (userId: string, isHelper: boolean) => {
  if (isDemoSession()) throw new Error('데모 모드에서는 도우미를 지정할 수 없습니다.');
  const { error } = await (supabase as any).rpc('set_class_notebook_helper', {
    p_user_id: userId,
    p_is_helper: isHelper,
  });
  throwIfRoleSchemaMissing(error);
};

export interface ClassArchiveResult {
  archive_id: string;
  grade: string;
  class_num: string;
  profiles: number;
  requests: number;
  notifications: number;
}

export const archiveTeacherClass = async () => {
  if (isDemoSession()) throw new Error('데모 모드에서는 학급 데이터를 보관할 수 없습니다.');
  const { data, error } = await (supabase as any).rpc('archive_teacher_class_data');
  throwIfRoleSchemaMissing(error);
  return data as ClassArchiveResult;
};

export interface ManagedStudent extends ClassMember {
  last_sign_in_at: string | null;
  session_reset_at: string | null;
}

export const getManageableStudents = async (): Promise<ManagedStudent[]> => {
  if (isDemoSession()) return getDemoStudents();
  const { data, error } = await (supabase as any).rpc('list_manageable_students');
  throwIfRoleSchemaMissing(error);
  return (data ?? []) as ManagedStudent[];
};

// The server takes at most this many students per call.
const SIGN_OUT_BATCH_SIZE = 200;

export const forceStudentSignOut = async (userIds: string[]) => {
  if (isDemoSession()) {
    markDemoStudentsSignedOut(userIds);
    return { signed_out: userIds.length };
  }
  let signedOut = 0;
  for (let start = 0; start < userIds.length; start += SIGN_OUT_BATCH_SIZE) {
    const { data, error } = await (supabase as any).rpc('force_student_sign_out', { p_user_ids: userIds.slice(start, start + SIGN_OUT_BATCH_SIZE) });
    throwIfRoleSchemaMissing(error);
    signedOut += (data as { signed_out: number }).signed_out;
  }
  return { signed_out: signedOut };
};

// Returns null when the value cannot be read: a failed check must never sign anyone out.
export const getSessionResetAt = async (userId: string) => {
  if (isDemoSession()) return null;
  const { data, error } = await (supabase as any).from('profiles').select('session_reset_at').eq('user_id', userId).maybeSingle();
  if (error) return null;
  return (data?.session_reset_at ?? null) as string | null;
};
