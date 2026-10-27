import { useCallback, useEffect, useState } from 'react';
import { Archive, LoaderCircle, ShieldCheck, UserRoundCog, UsersRound } from 'lucide-react';
import { User } from '../types';
import { archiveTeacherClass, ClassArchiveResult, getTeacherClassMembers, setNotebookHelper, ClassMember } from '../lib/roles';

export default function TeacherClassTools({ currentUser }: { currentUser: User }) {
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveResult, setArchiveResult] = useState<ClassArchiveResult | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setMembers(await getTeacherClassMembers()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '담임 반 학생을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleRole = async (member: ClassMember) => {
    const isHelper = member.role !== 'helper';
    const action = isHelper ? '노트북 관리 도우미로 지정' : '관리 도우미 권한 해제';
    if (!window.confirm(`${member.student_name} 학생의 권한을 ${action}할까요?`)) return;
    setWorkingId(member.user_id);
    setError(null);
    try { await setNotebookHelper(member.user_id, isHelper); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '학생 역할을 변경하지 못했습니다.'); }
    finally { setWorkingId(null); }
  };

  const handleArchive = async () => {
    const classLabel = `${currentUser.grade}학년 ${Number(currentUser.classNum)}반`;
    const expected = `${classLabel} 보관`;
    const confirmedText = window.prompt(
      `${classLabel} 학생 계정, 대여 신청 기록, 관련 알림을 사이트에서 숨깁니다. 데이터 행은 DB에 보관됩니다.\n\n진행하려면 아래 문구를 그대로 입력하세요.\n${expected}`,
    );
    if (confirmedText !== expected) return;
    setArchiveBusy(true);
    setError(null);
    setArchiveResult(null);
    try { setArchiveResult(await archiveTeacherClass()); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '학급 데이터를 보관하지 못했습니다.'); }
    finally { setArchiveBusy(false); }
  };

  if (!currentUser.grade || !currentUser.classNum) {
    return <section className="mb-10 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900"><h2 className="font-black">담임 반을 확인할 수 없습니다.</h2><p className="mt-1">로그아웃 후 선생님으로 로그인해 담당 학년·반을 입력해주세요.</p></section>;
  }

  return (
    <section className="mb-10 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800"><UsersRound className="h-4 w-4" />담임 반 관리</p>
          <h2 className="mt-3 text-2xl font-black text-slate-950">{currentUser.grade}학년 {Number(currentUser.classNum)}반</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">담임 반 학생만 관리할 수 있습니다. 도우미에게는 노트북 대여 승인과 장비 확인 권한이 부여됩니다.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><UsersRound className="h-4 w-4" />활성 학생 {members.length}명</div>
      </div>

      {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {archiveResult && <div role="status" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"><strong>학급 보관 완료.</strong> 학생 {archiveResult.profiles}명, 신청 기록 {archiveResult.requests}건, 알림 {archiveResult.notifications}건을 사이트에서 숨겼고 DB에 보존했습니다.</div>}

      {loading ? <div role="status" className="py-10 text-center text-sm font-bold text-slate-500">학생 목록을 불러오는 중입니다...</div> : members.length === 0 ? <div className="mt-5 rounded-2xl bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">담당 반에 활성 학생 계정이 없습니다.</div> : (
        <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {members.map((member) => <div key={member.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><UserRoundCog className="h-5 w-5" /></span>
              <div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{member.student_name}<span className="ml-2 font-mono text-xs text-slate-500">{member.student_id}</span></p><p className="mt-0.5 text-xs text-slate-500">{member.role === 'helper' ? '노트북 관리 도우미' : '학생'}</p></div>
            </div>
            <button type="button" onClick={() => void handleRole(member)} disabled={workingId === member.user_id} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {workingId === member.user_id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{member.role === 'helper' ? '도우미 해제' : '도우미 지정'}
            </button>
          </div>)}
        </div>
      )}

      <div className="mt-7 border-t border-slate-100 pt-6">
        <div className="rounded-2xl border border-amber-200 bg-[#fffaf0] p-4 sm:p-5">
          <div className="flex items-start gap-3"><Archive className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" /><div><h3 className="font-black text-amber-950">학기말 학급 데이터 보관</h3><p className="mt-1 text-xs leading-5 text-amber-900">학생 계정·대여 신청·관련 알림을 사이트에서 숨깁니다. DB에는 보관되며, 반납이 끝나지 않은 노트북이 있으면 실행되지 않습니다. 선생님 계정은 유지됩니다.</p></div></div>
          <button type="button" onClick={() => void handleArchive()} disabled={archiveBusy || loading} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-black text-white hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-50">
            {archiveBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}이 반 데이터 보관하기
          </button>
        </div>
      </div>
    </section>
  );
}
