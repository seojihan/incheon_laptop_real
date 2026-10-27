import { FormEvent, useState } from 'react';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { motion } from 'motion/react';
import { clearLoginIntent, createOrUpdateProfile, reactivateArchivedStudent } from '../lib/auth';
import { composeStudentId, normalizeClassNum, normalizeDigits, validateProfileFields } from '../lib/validation';
import { User, UserRole } from '../types';

interface ProfileSetupViewProps {
  pendingUser: { id: string; email: string; name: string; isArchived?: boolean; switchingFromTeacher?: boolean };
  assignedRole: UserRole;
  onProfileSaved: (user: User) => void;
  onLogout: () => Promise<void>;
}

const roleLabel: Record<UserRole, string> = {
  student: '학생',
  teacher: '교사',
  helper: '관리 도우미',
  admin: '시스템 관리자',
};

export default function ProfileSetupView({ pendingUser, assignedRole, onProfileSaved, onLogout }: ProfileSetupViewProps) {
  const [name, setName] = useState(pendingUser.name || '');
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState('');
  const [studentNum, setStudentNum] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const needsStudentInfo = assignedRole === 'student' || assignedRole === 'helper';
  const needsClass = needsStudentInfo || assignedRole === 'teacher';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const validationError = validateProfileFields({ name, role: assignedRole, grade, classNum, studentNum });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const normalizedClass = needsClass ? normalizeClassNum(classNum) : '';
      const studentId = needsStudentInfo ? composeStudentId(grade, classNum, studentNum) : null;
      if (pendingUser.isArchived && studentId) {
        await reactivateArchivedStudent({ name, studentId, grade: normalizeDigits(grade), classNum: normalizedClass });
      } else {
      await createOrUpdateProfile({
        user_id: pendingUser.id,
        role: assignedRole,
        student_id: studentId,
        student_name: name.trim(),
        // Teachers do not have a student number, but their grade is required
        // to scope the teacher role to one homeroom.
        grade: needsClass ? normalizeDigits(grade) : null,
        class_num: normalizedClass || null,
        metadata: { email: pendingUser.email },
      });
      }

      clearLoginIntent();

      onProfileSaved({
        id: pendingUser.id,
        name: name.trim(),
        email: pendingUser.email,
        role: assignedRole,
        studentId: studentId || undefined,
        classNum: normalizedClass || undefined,
        grade: needsClass ? normalizeDigits(grade) : undefined,
      });
    } catch (caught) {
      const code = typeof caught === 'object' && caught !== null && 'code' in caught
        ? String((caught as { code?: unknown }).code || '')
        : '';
      if (assignedRole === 'teacher' && code === '42501') {
        setError('교사 정보가 데이터베이스 보호 규칙에 맞지 않아 저장되지 않았습니다. 이름, 담당 학년과 반을 확인한 뒤 다시 시도해주세요. 문제가 계속되면 관리자에게 알려주세요.');
      } else {
        setError(caught instanceof Error ? caught.message : '프로필 저장 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f0] text-slate-900 flex items-center justify-center px-4 py-10">
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mb-5">
              <UserRound className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black">처음 사용할 정보를 입력해주세요</h1>
            <p className="text-sm text-slate-600 mt-3">입력한 정보는 대여 신청과 담당 반 조회에 사용됩니다.</p>
          </div>
          <button type="button" onClick={onLogout} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 mb-7 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-blue-900">할당된 역할: {roleLabel[assignedRole]}</p>
            <p className="text-xs text-blue-800 mt-1">{assignedRole === 'teacher' ? '담당 학년과 반을 입력하면 교사 메뉴로 바로 들어갑니다.' : '학생 계정은 대여 신청을 위해 학년, 반, 번호를 등록합니다.'}</p>
          </div>
        </div>

        {pendingUser.switchingFromTeacher && (
          <div role="note" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold leading-6 text-amber-900">
            현재 계정은 교사로 등록되어 있습니다. 학생으로 저장하면 이 계정의 교사 권한과 담당 반 메뉴가 해제됩니다.
          </div>
        )}

        {pendingUser.isArchived && assignedRole === 'student' && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900"><p className="font-black">이전 학기 계정이 보관되어 있습니다.</p><p className="mt-1">새 학년 정보를 입력하면 학생 계정만 다시 활성화됩니다. 이전 대여 기록은 계속 보관됩니다.</p></div>}

        <div className="grid gap-5">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            이름
            <input required maxLength={40} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="w-full min-w-0 rounded-2xl bg-white border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500" placeholder="홍길동" />
          </label>

          {needsStudentInfo && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="학년" value={grade} onChange={setGrade} placeholder="2" />
              <NumberField label="반" value={classNum} onChange={setClassNum} placeholder="3" />
              <NumberField label="번호" value={studentNum} onChange={setStudentNum} placeholder="17" />
            </div>
          )}

          {assignedRole === 'teacher' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="담당 학년" value={grade} onChange={setGrade} placeholder="2" />
              <NumberField label="담당 반" value={classNum} onChange={setClassNum} placeholder="3" />
            </div>
          )}

          {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

          <button type="submit" disabled={isSaving} className="rounded-2xl bg-blue-700 px-6 py-4 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
            {isSaving ? '저장 중...' : assignedRole === 'teacher' ? '교사로 바로 시작하기' : pendingUser.isArchived ? '새 학년 정보로 계정 다시 활성화' : '저장하고 시작하기'}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        required
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={value}
        onChange={(event) => onChange(normalizeDigits(event.target.value).slice(0, 2))}
        className="w-full min-w-0 rounded-2xl bg-white border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
        placeholder={placeholder}
      />
    </label>
  );
}
