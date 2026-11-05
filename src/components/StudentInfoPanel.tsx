import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, LoaderCircle, LogOut, RefreshCw, Search, UsersRound } from 'lucide-react';
import { getUserRequests } from '../lib/db';
import { closePage, openNewPage } from '../lib/pageLinks';
import { isSignedOutByTeacher } from '../lib/sessionReset';
import { buildStudentActivity, formatRentalWhen } from '../lib/requestSummary';
import { forceStudentSignOut, getManageableStudents, ManagedStudent } from '../lib/roles';
import { useFocusRefresh } from '../lib/useFocusRefresh';
import { cn } from '../lib/utils';
import { LaptopRequest } from '../types';
import StudentSessionStatus from './StudentSessionStatus';
import { PageBackButton, RequestStatusBadge, RequestTypeBadge, requestTypeTheme } from './approval/RequestParts';

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('ko-KR') : '기록 없음';
const closeToStudentList = () => closePage({ view: 'notifications', tab: 'students' });

// With a studentId this tab is that student's page; without one it is the list.
export default function StudentInfoPanel({ studentId }: { studentId?: string }) {
  const [students, setStudents] = useState<ManagedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutNotice, setSignOutNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setStudents(await getManageableStudents()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '학생 목록을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refreshQuietly = () => getManageableStudents().then(setStudents).catch(() => {});
  useFocusRefresh(() => { void refreshQuietly(); }, 10_000);

  const matchSearch = (list: ManagedStudent[]) => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    if (!query) return list;
    return list.filter((student) => [student.student_name, student.student_id].some((value) => value.toLocaleLowerCase('ko-KR').includes(query)));
  };
  const filtered = matchSearch(students);

  // Students who are already signed out are left alone.
  const findTargets = (list: ManagedStudent[]) => matchSearch(list).filter((student) => !isSignedOutByTeacher(student.session_reset_at, student.last_sign_in_at));
  const signOutTargets = findTargets(students);

  // Uses a fresh list, so someone who signed in a moment ago is not missed.
  const handleSignOutAll = async () => {
    setError(null);
    setSignOutNotice(null);
    let targets: ManagedStudent[];
    try {
      const latest = await getManageableStudents();
      setStudents(latest);
      targets = findTargets(latest);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '학생 목록을 불러오지 못했습니다.');
      return;
    }
    if (targets.length === 0) {
      setSignOutNotice('로그아웃할 학생이 없습니다.');
      return;
    }
    if (!window.confirm(`목록에 보이는 학생 ${targets.length}명을 모두 로그아웃시킬까요?\n\n접속 중인 기기에서 로그인 화면으로 돌아갑니다. 계정이 정지되는 것은 아니며, 다시 로그인하면 바로 이용할 수 있습니다.`)) return;
    setSignOutBusy(true);
    try {
      const result = await forceStudentSignOut(targets.map((student) => student.user_id));
      setSignOutNotice(`학생 ${result.signed_out}명을 로그아웃 처리했습니다. 접속 중인 화면은 10초 안에 로그인 화면으로 돌아갑니다.`);
      await refreshQuietly();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그아웃 처리하지 못했습니다.');
    } finally {
      setSignOutBusy(false);
    }
  };

  const errorBanner = error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>;

  if (studentId) {
    const student = students.find((item) => item.user_id === studentId);
    if (student) return <StudentDetail student={student} onSignedOut={() => void refreshQuietly()} />;
    return (
      <div>
        <PageBackButton label="창 닫고 돌아가기" onClick={closeToStudentList} />
        {errorBanner}
        {loading
          ? <div role="status" className="py-24 text-center text-slate-500">학생 정보를 불러오는 중입니다...</div>
          : !error && <div className="rounded-3xl border-2 border-dashed border-slate-200 py-24 text-center font-bold text-slate-500">학생을 찾지 못했습니다.</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">학생 검색</span>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="이름, 학번 검색" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </label>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw className="h-4 w-4" />새로고침</button>
        <button type="button" onClick={() => void handleSignOutAll()} disabled={loading || signOutBusy || signOutTargets.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50">{signOutBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}{search.trim() ? `검색된 ${signOutTargets.length}명 로그아웃` : `전체 ${signOutTargets.length}명 로그아웃`}</button>
      </div>

      {signOutNotice && <div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">{signOutNotice}</div>}
      {errorBanner}

      {loading ? (
        <div role="status" className="py-24 text-center text-slate-500">학생 목록을 불러오는 중입니다...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 py-24 text-center"><UsersRound className="mx-auto mb-4 h-10 w-10 text-slate-300" /><p className="font-bold text-slate-500">{students.length ? '검색 조건에 맞는 학생이 없습니다.' : '조회할 수 있는 학생이 없습니다.'}</p></div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {filtered.map((student) => (
            <button key={student.user_id} type="button" onClick={() => openNewPage({ view: 'notifications', tab: 'students', student: student.user_id })} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-900">{student.student_name}<span className="ml-2 font-mono text-xs font-bold text-slate-500">{student.student_id}</span>{student.role === 'helper' && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-800">도우미</span>}</span>
                <StudentSessionStatus student={student} />
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentDetail({ student, onSignedOut }: { student: ManagedStudent; onSignedOut: () => void }) {
  const [requests, setRequests] = useState<LaptopRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setRequests(await getUserRequests(student.user_id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '대여 기록을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [student.user_id]);

  useEffect(() => { void load(); }, [load]);

  useFocusRefresh(() => {
    getUserRequests(student.user_id).then(setRequests).catch(() => {});
  });

  const activity = useMemo(() => buildStudentActivity(requests), [requests]);

  const handleSignOut = async () => {
    if (!window.confirm(`${student.student_name} 학생을 로그아웃시킬까요?\n\n접속 중인 기기에서 로그인 화면으로 돌아갑니다. 계정이 정지되는 것은 아니며, 다시 로그인하면 바로 이용할 수 있습니다.`)) return;
    setSigningOut(true);
    setError(null);
    setNotice(null);
    try {
      await forceStudentSignOut([student.user_id]);
      setNotice(`${student.student_name} 학생을 로그아웃 처리했습니다. 접속 중인 화면은 10초 안에 로그인 화면으로 돌아갑니다.`);
      onSignedOut();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그아웃 처리하지 못했습니다.');
    } finally {
      setSigningOut(false);
    }
  };

  const inUse = requests.filter((item) => item.status === 'approved').length;
  const rejected = requests.filter((item) => item.status === 'rejected').length;

  return (
    <div>
      <PageBackButton label="창 닫고 돌아가기" onClick={closeToStudentList} />
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-slate-950">{student.student_name}<span className="ml-3 font-mono text-base font-bold text-slate-500">{student.student_id}</span></h2>
            <p className="mt-1 text-sm text-slate-500">{student.grade}학년 {Number(student.class_num)}반 · {student.role === 'helper' ? '노트북 관리 도우미' : '학생'}</p>
            <StudentSessionStatus student={student} />
          </div>
          <button type="button" onClick={() => void handleSignOut()} disabled={signingOut || isSignedOutByTeacher(student.session_reset_at, student.last_sign_in_at)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50">
            {signingOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}로그아웃시키기
          </button>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-5">
          <div><dt className="text-xs font-bold text-slate-500">전체 신청</dt><dd className="mt-1 text-2xl font-black text-slate-900">{requests.length}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">대여 중</dt><dd className="mt-1 text-2xl font-black text-[#2563eb]">{inUse}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">반려</dt><dd className="mt-1 text-2xl font-black text-red-600">{rejected}</dd></div>
        </dl>
      </section>

      {notice && <div role="status" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">{notice}</div>}
      {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      {loading ? (
        <div role="status" className="py-20 text-center text-slate-500">대여 기록을 불러오는 중입니다...</div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section>
            <h3 className="mb-3 text-lg font-black text-slate-900">대여 기록</h3>
            {requests.length === 0 ? <EmptyBox text="대여 기록이 없습니다." /> : (
              <div className="space-y-2">
                {requests.map((request) => (
                  <button key={request.id} type="button" onClick={() => openNewPage({ view: 'admin-approval', page: 'detail', request: request.id })} className={cn('block w-full rounded-2xl border border-l-[6px] border-slate-200 bg-white p-4 text-left transition-shadow hover:shadow-md', requestTypeTheme[request.type].stripe)}>
                    <span className="flex flex-wrap items-center gap-2"><RequestTypeBadge type={request.type} /><RequestStatusBadge status={request.status} /></span>
                    <span className="mt-2 block text-sm font-bold text-slate-700">{formatRentalWhen(request)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3 className="mb-3 text-lg font-black text-slate-900">활동 내역</h3>
            {activity.length === 0 ? <EmptyBox text="활동 내역이 없습니다." /> : (
              <ol className="rounded-2xl border border-slate-200 bg-white p-4">
                {activity.map((event) => (
                  <li key={event.key} className="relative border-l-2 border-slate-200 pb-4 pl-4 last:pb-0">
                    <span className={cn('absolute -left-[5px] top-1.5 h-2 w-2 rounded-full', event.tone === 'approved' ? 'bg-[#2563eb]' : event.tone === 'rejected' ? 'bg-red-600' : 'bg-slate-400')} aria-hidden="true" />
                    <p className="text-sm font-black text-slate-900">{event.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600 break-words">{event.detail}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{new Date(event.at).toLocaleString('ko-KR')}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-sm font-bold text-slate-500">{text}</div>;
}
