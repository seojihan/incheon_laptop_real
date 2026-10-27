import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, CheckCircle2, ClipboardCheck, Laptop, ShieldCheck, UserRound } from 'lucide-react';
import { User, LaptopRequest } from '../types';
import { createHomeRequest, getUserRequests } from '../lib/db';
import { todayLocalIso, validateHomeRental } from '../lib/validation';

interface HomeRentalViewProps {
  currentUser: User;
  onOpenRecords: (requestId?: string) => void;
  onOpenSettings: () => void;
}

const getInclusiveRentalDays = (start: string, end: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return null;
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
};

export default function HomeRentalView({ currentUser, onOpenRecords, onOpenSettings }: HomeRentalViewProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [request, setRequest] = useState<LaptopRequest | null>(null);
  const [activeRequest, setActiveRequest] = useState<LaptopRequest | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [existingError, setExistingError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const hasStudentId = Boolean(currentUser.studentId);
  const minDate = todayLocalIso();
  const maxDate = (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  })();

  useEffect(() => {
    let active = true;
    const loadActiveRequest = async () => {
      setCheckingExisting(true);
      setExistingError(null);
      try {
        const requests = await getUserRequests(currentUser.id);
        if (active) {
          const openRequest = requests
            .filter((item) => item.type === 'home' && ['pending', 'approved'].includes(item.status))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
          setActiveRequest(openRequest);
        }
      } catch (error) {
        if (active) setExistingError(error instanceof Error ? error.message : '기존 신청 여부를 확인하지 못했습니다.');
      } finally {
        if (active) setCheckingExisting(false);
      }
    };
    void loadActiveRequest();
    return () => { active = false; };
  }, [currentUser.id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasStudentId) {
      setErrorMessage('학생 정보가 등록되지 않아 신청할 수 없습니다. 설정에서 학번을 입력해주세요.');
      setStatus('error');
      return;
    }

    const validationError = validateHomeRental(startDate, endDate, reason);
    if (validationError) {
      setErrorMessage(validationError);
      setStatus('error');
      return;
    }

    setShowConfirm(true);
  };

  const submitRequest = async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const created = await createHomeRequest({
        userId: currentUser.id,
        userName: currentUser.name,
        studentId: currentUser.studentId,
        startDate,
        endDate,
        reason: reason || '가정용 노트북 대여 신청',
      });
      setRequest(created);
      setShowConfirm(false);
      setStatus('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '대여 신청 중 오류가 발생했습니다.');
      setStatus('error');
    }
  };

  const rentalDays = getInclusiveRentalDays(startDate, endDate);

  if (checkingExisting && status === 'idle') {
    return <div className="mx-auto flex min-h-[40vh] max-w-6xl items-center justify-center text-sm font-bold text-slate-500" role="status">기존 가정 대여 신청을 확인하고 있습니다...</div>;
  }

  if (activeRequest && status === 'idle') {
    return <div className="mx-auto flex min-h-[55vh] max-w-6xl items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ClipboardCheck className="h-7 w-7" /></div>
        <p className="text-sm font-black text-blue-800">진행 중인 가정 대여 신청</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900">새 신청 전에 기존 신청을 확인해 주세요</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">한 번에 한 건의 가정 대여만 진행할 수 있어요. 기존 신청이 처리되거나 반납 완료된 뒤 다시 신청할 수 있습니다.</p>
        <div className="my-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
          <p><span className="text-slate-500">상태</span><strong className="float-right text-slate-900">{activeRequest.status === 'pending' ? '승인 대기' : '승인 완료'}</strong></p>
          <p className="mt-3"><span className="text-slate-500">대여 기간</span><strong className="float-right text-right text-slate-900">{activeRequest.startDate} – {activeRequest.endDate}</strong></p>
          {activeRequest.notebookNumber && <p className="mt-3"><span className="text-slate-500">배정 번호</span><strong className="float-right text-slate-900">노트북 {activeRequest.notebookNumber}번</strong></p>}
        </div>
        <button type="button" onClick={() => onOpenRecords(activeRequest.id)} className="w-full rounded-2xl bg-blue-700 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-800">기존 신청 상세 보기</button>
      </section>
    </div>;
  }

  if (status === 'success' && request) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex w-full max-w-lg flex-col items-center rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10"
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="mb-2 text-sm font-bold text-emerald-700">승인 대기 · 신청 접수 완료</p>
          <h2 className="mb-3 text-3xl font-black tracking-tight text-slate-900">신청 내용이 담당자에게 전달됐어요</h2>
          <p className="mb-7 text-sm leading-7 text-slate-600">아직 장비 대여가 확정된 것은 아니에요. 승인 결과와 배정 번호는 알림 또는 신청 내역에서 확인해 주세요.</p>
          <div className="mb-7 w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">신청 내용</p>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">요청 번호</dt><dd className="break-all text-right font-bold text-slate-800">{request.id}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">대여 기간</dt><dd className="text-right font-bold text-slate-800">{request.startDate} – {request.endDate}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">대여 일수</dt><dd className="text-right font-bold text-slate-800">{getInclusiveRentalDays(request.startDate, request.endDate || request.startDate)}일 (시작일·반납일 포함)</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">신청 사유</dt><dd className="text-right font-bold text-slate-800">{request.reason}</dd></div>
            </dl>
          </div>
          <button type="button" onClick={() => onOpenRecords(request.id)} className="w-full rounded-2xl bg-blue-700 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-800">신청 내역에서 진행 상황 확인</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800"><Laptop className="h-4 w-4" />가정 대여</span>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">가정 대여 신청</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">학습에 필요한 대여 기간과 내용을 확인하고 신청해 주세요.</p>
        </div>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-600"><ClipboardCheck className="h-4 w-4 shrink-0 text-blue-700" />신청 후 담당자 승인 결과를 알림에서 확인할 수 있어요.</p>
      </header>

      {existingError && <div role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">기존 신청 여부를 확인하지 못했어요. 제출할 때 중복 여부를 다시 확인합니다. <span className="font-bold">{existingError}</span></div>}

      <form onSubmit={handleSubmit} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-7">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-800">01</span>
              <div><h2 className="font-black text-slate-900">신청자 정보</h2><p className="mt-0.5 text-xs text-slate-500">내 계정의 학생 정보로 접수됩니다.</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-500"><UserRound className="h-4 w-4" />학생 이름</p>
                <p className="truncate font-black text-slate-900">{currentUser.name}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="mb-1.5 text-xs font-bold text-slate-500">학번</p>
                <p className="font-mono font-black text-slate-900">{currentUser.studentId || '설정에서 등록해 주세요'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-800">02</span>
                <div><h2 className="font-black text-slate-900">대여 기간</h2><p className="mt-0.5 text-xs text-slate-500">신청 가능한 기간은 최대 30일입니다.</p></div>
              </div>
              <CalendarDays className="hidden h-5 w-5 text-blue-700 sm:block" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="home-start-date" className="text-sm font-bold text-slate-700">대여 시작일</label>
                <input
                  type="date"
                  id="home-start-date"
                  value={startDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    if (endDate && endDate < event.target.value) setEndDate(event.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  required
                  className="w-full min-w-0 rounded-2xl border border-slate-200 bg-[#fbfaf7] px-4 py-3.5 text-sm text-slate-800 transition focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="home-end-date" className="text-sm font-bold text-slate-700">반납 예정일</label>
                <input
                  type="date"
                  id="home-end-date"
                  value={endDate}
                  min={startDate || minDate}
                  max={maxDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  required
                  className="w-full min-w-0 rounded-2xl border border-slate-200 bg-[#fbfaf7] px-4 py-3.5 text-sm text-slate-800 transition focus:bg-white"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-800">03</span><label htmlFor="home-reason" className="font-black text-slate-900">전달 사항 <span className="font-medium text-slate-500">(선택)</span></label></div>
              <span className="text-xs font-medium text-slate-500" aria-live="polite">{reason.length}/500</span>
            </div>
            <textarea
              id="home-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="담당자에게 미리 전달할 내용이 있다면 적어주세요."
              className="min-h-32 w-full resize-y rounded-2xl border border-slate-200 bg-[#fbfaf7] p-4 text-sm leading-6 text-slate-800 transition focus:bg-white"
            />
          </section>

          {!hasStudentId && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"><p>학생 정보가 등록되어 있지 않아 신청할 수 없습니다.</p><button type="button" onClick={onOpenSettings} className="mt-2 font-black underline underline-offset-4">개인 설정에서 학번 입력하기</button></div>}
          {status === 'error' && errorMessage && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700">{errorMessage}</div>}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-800"><ClipboardCheck className="h-5 w-5" /></div><div><h2 className="font-black text-slate-900">신청 요약</h2><p className="text-xs text-slate-500">제출 전 내용을 확인해 주세요.</p></div></div>
            <dl className="mb-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50 px-4">
              <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">신청자</dt><dd className="font-bold text-slate-800">{currentUser.name}</dd></div>
              <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">대여 시작일</dt><dd className="font-bold text-slate-800">{startDate || '날짜 선택'}</dd></div>
              <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">반납 예정일</dt><dd className="font-bold text-slate-800">{endDate || '날짜 선택'}</dd></div>
              {rentalDays !== null && <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">총 대여 일수</dt><dd className="text-right font-black text-slate-900">{rentalDays}일 <span className="text-[11px] font-medium text-slate-500">(양 끝 날짜 포함)</span></dd></div>}
            </dl>
            <p className="mb-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />학습 목적으로 사용하고, 대여 기간 안에 반납해 주세요.</p>
            <button type="submit" disabled={status === 'loading' || !hasStudentId} className="w-full rounded-2xl bg-blue-700 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
              {status === 'loading' ? '접수 중...' : '대여 신청 접수'}
            </button>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900"><ShieldCheck className="h-4 w-4 text-blue-700" />대여 준수 사항</h2>
            <ul className="space-y-3">
              {[
                '학습 목적 이외의 사용을 금지합니다.',
                '파손이나 이상이 있으면 담당 교사에게 알려주세요.',
                '반납 예정일을 지켜주세요.',
              ].map((text) => <li key={text} className="flex gap-2.5 text-xs leading-5 text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />{text}</li>)}
            </ul>
          </section>
        </aside>
      </form>
      {showConfirm && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="home-confirm-title">
        <button type="button" aria-label="확인 창 닫기" onClick={() => setShowConfirm(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
        <section className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><CalendarDays className="h-6 w-6" /></div>
          <h2 id="home-confirm-title" className="text-xl font-black text-slate-900">이 내용으로 신청할까요?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">신청 후 담당자 승인과 장비 배정이 완료되어야 대여할 수 있어요.</p>
          <dl className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">대여 기간</dt><dd className="text-right font-black text-slate-900">{startDate} – {endDate}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">총 대여 일수</dt><dd className="font-black text-slate-900">{rentalDays}일</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">신청자</dt><dd className="font-black text-slate-900">{currentUser.name}</dd></div>
          </dl>
          {errorMessage && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{errorMessage}</p>}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setShowConfirm(false)} disabled={status === 'loading'} className="min-h-12 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 disabled:opacity-50">다시 확인</button>
            <button type="button" onClick={() => void submitRequest()} disabled={status === 'loading'} className="min-h-12 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50">{status === 'loading' ? '접수 중...' : '신청 접수'}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
