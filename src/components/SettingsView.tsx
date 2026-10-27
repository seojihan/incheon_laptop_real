import { FormEvent, useEffect, useState } from 'react';
import { Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { createOrUpdateProfile, getProfile } from '../lib/auth';
import { composeStudentId, normalizeClassNum, normalizeDigits, validateProfileFields } from '../lib/validation';
import { User } from '../types';

interface SettingsViewProps {
  currentUser: User;
  onProfileUpdated: (user: User) => void;
}

const roleLabel = { student: '학생', teacher: '교사', helper: '관리 도우미', admin: '시스템 관리자' } as const;

export default function SettingsView({ currentUser, onProfileUpdated }: SettingsViewProps) {
  const [name, setName] = useState(currentUser.name);
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState(currentUser.classNum || '');
  const [studentNum, setStudentNum] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const needsStudentInfo = currentUser.role === 'student' || currentUser.role === 'helper';
  const needsClass = needsStudentInfo || currentUser.role === 'teacher';

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const profile = await getProfile(currentUser.id);
        if (!active || !profile) return;
        setName(profile.student_name || currentUser.name);
        setGrade(profile.grade || '');
        setClassNum(profile.class_num || '');
        setStudentNum(profile.student_id?.slice(-2) || '');
      } catch (caught) {
        if (active) {
          setErrorMessage(caught instanceof Error ? caught.message : '프로필을 불러오지 못했습니다.');
          setStatus('error');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [currentUser.id, currentUser.name]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const validationError = validateProfileFields({ name, role: currentUser.role, grade, classNum, studentNum });
    if (validationError) {
      setErrorMessage(validationError);
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      const normalizedClass = needsClass ? normalizeClassNum(classNum) : '';
      const studentId = needsStudentInfo ? composeStudentId(grade, classNum, studentNum) : null;
      await createOrUpdateProfile({
        user_id: currentUser.id,
        role: currentUser.role,
        student_id: studentId,
        student_name: name.trim(),
        grade: needsClass ? normalizeDigits(grade) : null,
        class_num: normalizedClass || null,
        metadata: { email: currentUser.email },
      });

      onProfileUpdated({
        ...currentUser,
        name: name.trim(),
        studentId: studentId || undefined,
        grade: needsClass ? normalizeDigits(grade) : undefined,
        classNum: normalizedClass || undefined,
      });
      setStatus('success');
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : '설정 저장 중 오류가 발생했습니다.');
      setStatus('error');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-full text-slate-400" role="status">프로필을 불러오는 중입니다...</div>;

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="mb-8 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center"><SettingsIcon className="w-6 h-6" /></div>
        <div><h1 className="text-3xl font-black text-slate-900">개인 설정</h1><p className="text-slate-500 text-sm mt-1">대여 신청에 사용되는 정보를 관리합니다.</p></div>
      </div>

      <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
          <div><p className="font-black text-blue-900">현재 역할: {roleLabel[currentUser.role]}</p><p className="text-xs text-blue-700 mt-1">역할은 관리자만 변경할 수 있습니다.</p></div>
        </div>

        <TextField label="이름" value={name} onChange={setName} placeholder="홍길동" />

        {needsStudentInfo && (
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">학생 정보</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumberField label="학년" value={grade} onChange={setGrade} placeholder="2" />
              <NumberField label="반" value={classNum} onChange={setClassNum} placeholder="3" />
              <NumberField label="번호" value={studentNum} onChange={setStudentNum} placeholder="17" />
            </div>
          </div>
        )}

        {currentUser.role === 'teacher' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberField label="담당 학년" value={grade} onChange={setGrade} placeholder="2" />
            <NumberField label="담당 반" value={classNum} onChange={setClassNum} placeholder="3" />
          </div>
        )}

        {status === 'error' && errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{errorMessage}</div>}
        {status === 'success' && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">설정이 저장되었습니다.</div>}

        <button type="submit" disabled={status === 'loading'} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-sm hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{status === 'loading' ? '저장 중...' : '설정 저장'}</button>
      </motion.form>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">{label}<input required maxLength={40} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full min-w-0 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>;
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">{label}<input required inputMode="numeric" pattern="[0-9]*" maxLength={2} value={value} onChange={(event) => onChange(normalizeDigits(event.target.value).slice(0, 2))} placeholder={placeholder} className="w-full min-w-0 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>;
}
