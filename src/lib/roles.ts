import { supabase } from './supabase';

const throwIfRoleSchemaMissing = (error: { code?: string; message?: string } | null) => {
  if (!error) return;
  const message = (error.message || '').toLowerCase();
  if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42883' || error.code === '42P01'
    || ['list_teacher_class_members', 'set_class_notebook_helper', 'archive_teacher_class_data'].some((name) => message.includes(name))) {
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

export const getTeacherClassMembers = async () => {
  const { data, error } = await (supabase as any).rpc('list_teacher_class_members');
  throwIfRoleSchemaMissing(error);
  return (data ?? []) as ClassMember[];
};

export const setNotebookHelper = async (userId: string, isHelper: boolean) => {
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
  const { data, error } = await (supabase as any).rpc('archive_teacher_class_data');
  throwIfRoleSchemaMissing(error);
  return data as ClassArchiveResult;
};
