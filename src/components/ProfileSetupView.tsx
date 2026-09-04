import { FormEvent, useState } from 'react';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { motion } from 'motion/react';
import { createOrUpdateProfile } from '../lib/auth';
import { composeStudentId, normalizeClassNum, normalizeDigits, validateProfileFields } from '../lib/validation';
import { User, UserRole } from '../types';

interface ProfileSetupViewProps {
  pendingUser: { id: string; email: string; name: string };
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
      await createOrUpdateProfile({
        user_id: pendingUser.id,
        role: assignedRole,
        student_id: studentId,
        student_name: name.trim(),
        grade: needsStudentInfo ? normalizeDigits(grade) : null,
        class_num: normalizedClass || null,
        metadata: { email: pendingUser.email },
      });

      onProfileSaved({
        id: pendingUser.id,
        name: name.trim(),
        email: pendingUser.email,
        role: assignedRole,
        studentId: studentId || undefined,
        classNum: normalizedClass || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[32px] p-6 sm:p-10 shadow-2xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-white text-slate-950 flex items-center justify-center mb-5">
              <UserRound className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black">처음 사용할 정보를 입력해주세요</h1>
            <p className="text-sm text-slate-400 mt-3">입력한 정보는 대여 신청과 담당 반 조회에 사용됩니다.</p>
          </div>
          <button type="button" onClick={onLogout} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm hover:bg-white/10">
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 mb-7 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-cyan-100">할당된 역할: {roleLabel[assignedRole]}</p>
            <p className="text-xs text-cyan-100/70 mt-1">역할은 보안을 위해 사용자가 직접 변경할 수 없습니다. 변경이 필요하면 관리자에게 문의하세요.</p>
          </div>
        </div>

        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-bold text-slate-300">
            이름
            <input required maxLength={40} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="rounded-2xl bg-slate-950 border border-white/10 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="홍길동" />
          </label>

          {needsStudentInfo && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="학년" value={grade} onChange={setGrade} placeholder="2" />
              <NumberField label="반" value={classNum} onChange={setClassNum} placeholder="3" />
              <NumberField label="번호" value={studentNum} onChange={setStudentNum} placeholder="17" />
            </div>
          )}

          {assignedRole === 'teacher' && (
            <NumberField label="담당 반" value={classNum} onChange={setClassNum} placeholder="3" />
          )}

          {error && <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

          <button type="submit" disabled={isSaving} className="rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60">
            {isSaving ? '저장 중...' : '저장하고 시작하기'}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-300">
      {label}
      <input
        required
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={value}
        onChange={(event) => onChange(normalizeDigits(event.target.value).slice(0, 2))}
        className="rounded-2xl bg-slate-950 border border-white/10 px-4 py-3 text-white outline-none focus:border-cyan-400"
        placeholder={placeholder}
      />
    </label>
  );
}
