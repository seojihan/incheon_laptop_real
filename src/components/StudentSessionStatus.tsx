import { isSignedOutByTeacher } from '../lib/sessionReset';

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('ko-KR') : '기록 없음';

// Lets a teacher see the result of a sign-out: the class list itself never changes,
// because signing out does not remove the student's account.
export default function StudentSessionStatus({ student }: { student: { last_sign_in_at: string | null; session_reset_at: string | null } }) {
  if (isSignedOutByTeacher(student.session_reset_at, student.last_sign_in_at)) {
    return <span className="mt-1 inline-flex w-fit rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-xs font-black text-red-700">로그아웃됨 · {formatDateTime(student.session_reset_at)}</span>;
  }
  return <span className="mt-0.5 block text-xs text-slate-500">최근 로그인: {formatDateTime(student.last_sign_in_at)}</span>;
}
